"use client";

// The Dry Run's 3D view: the setup drawn by the Tabletop's own canvas, models,
// lights and palette (so it follows the site's day and night as the Tabletop
// does), with what the physics model says laid over it. The pump beam glows
// with the pump; the beam to the spectrometer glows with the leakage, wide and
// faint from the thermal polaritons and with a bright core from k = 0; a
// monitor beside the spectrometer shows the current capture; the laser's
// indicator lights count the pump power. Clicking an instrument asks the page
// to open its panel. Everything here is in mm on the table, like the setup.

import type { ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  Color,
  DataTexture,
  NormalBlending,
  Quaternion,
  RGBAFormat,
  SRGBColorSpace,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
} from "three";

import BuilderCanvas, { CLICK_SLOP_PX } from "@/components/builder/builder-canvas";
import type { GraphicsQuality } from "@/components/builder/graphics-quality";
import { ComponentMesh } from "@/components/builder/component-models";
import { LASER_ARROW, LASER_BODY_MM, LASER_EMITTER } from "@/components/builder/model-dimensions";
import type { ScenePalette } from "@/components/builder/scene-theme";
import {
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type Vec3,
  beamPoints,
  componentById,
  componentReferenceX,
} from "@/components/builder/types";
import type { Frame } from "@/components/simulator/camera";

/** What a click in the scene opens in the side panel. */
export type PanelTab = "capture" | "curves" | "pump" | "optics" | "model";

/** Which panel each instrument opens. */
const PICKS: Partial<Record<BuilderComponent["type"], PanelTab>> = {
  "laser-source": "pump",
  camera: "capture",
  spectrometer: "optics",
  objective: "optics",
  lens: "optics",
  sample: "model",
};

export type BenchLight = {
  /** pump power along the series, 0 (its lowest) … 1 (its highest) */
  pump: number;
  /** leakage reaching the spectrometer, 0 (dark) … 1 (the series' brightest), on a log scale */
  leakage: number;
  /** the share of the leakage from k = 0, 0…1 */
  condensate: number;
};

type Props = {
  setup: BuilderSceneData;
  /** the beam the physics runs along (sample → spectrometer), if any */
  leakageBeamId: string | null;
  /** the beam that brings the pump to the sample, if any */
  pumpBeamId: string | null;
  light: BenchLight;
  capture: Frame | null;
  palette: ScenePalette;
  quality: GraphicsQuality;
  /** a click on an instrument: the panel to open */
  onPick: (tab: PanelTab) => void;
  /** bumped to refit the view */
  fitToken: number;
  /** the Tabletop's part labels: off on a phone, where they would cover the bench */
  showLabels: boolean;
};

const NOOP = () => {};

// ---------------------------------------------------------------------------
// Glowing beam
// ---------------------------------------------------------------------------

const GLOW_VERTEX = /* glsl */ `
  varying float vFacing;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // guarded: a zero vector through normalize is NaN on some GPUs, and the bloom spreads one NaN pixel over the whole frame
    vec3 n = normalMatrix * normal;
    vec3 v = isOrthographic ? vec3(0.0, 0.0, 1.0) : -mvPosition.xyz;
    float ln = length(n);
    float lv = length(v);
    vFacing = ln > 1e-6 && lv > 1e-6 ? clamp(abs(dot(n, v)) / (ln * lv), 0.0, 1.0) : 0.0;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// colour × power, brightest where the tube faces the view: a round glow, as
// the Tabletop's halo is, but unmapped so the bloom can take what passes white
const GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  uniform float power;
  uniform float core;
  uniform float day;
  varying float vFacing;
  void main() {
    // pow(0, y) is undefined in GLSL: keep the base off zero
    float f = pow(max(vFacing, 1e-4), max(core, 1e-3));
    // by day a glow can't outshine the sweep: the beam keeps its colour and the power sets how much of it shows
    gl_FragColor = day > 0.5
      ? vec4(color * (0.8 + 0.2 * f), clamp(power * (0.35 + 0.65 * f), 0.0, 1.0))
      : vec4(color * power * (0.3 + 1.4 * f), clamp(power * f, 0.0, 1.0));
  }
`;

/** One per glowing mesh; every copy shares the compiled program. Props go through R3F, which redraws. */
function GlowMaterial({ color, power, core, dark }: { color: Color; power: number; core: number; dark: boolean }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { color: { value: new Color() }, power: { value: 0 }, core: { value: 1 }, day: { value: 0 } },
        vertexShader: GLOW_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <primitive
      object={material}
      attach="material"
      uniforms-color-value={color}
      uniforms-power-value={Number.isFinite(power) ? Math.max(0, power) : 0}
      uniforms-core-value={core}
      uniforms-day-value={dark ? 0 : 1}
      // light adds up on the night table; by day it would wash the sweep out, so it lies over it
      blending={dark ? AdditiveBlending : NormalBlending}
    />
  );
}

type Leg = { position: Vec3; quaternion: Quaternion; length: number };

function legsOf(points: Vec3[]): Leg[] {
  const up = new Vector3(0, 1, 0);
  const legs: Leg[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = new Vector3(...points[i - 1]);
    const b = new Vector3(...points[i]);
    const d = b.clone().sub(a);
    const length = d.length();
    if (length < 1e-6) continue;
    const mid = a.add(b).multiplyScalar(0.5);
    legs.push({ position: [mid.x, mid.y, mid.z], quaternion: new Quaternion().setFromUnitVectors(up, d.normalize()), length });
  }
  return legs;
}

/**
 * A beam whose brightness is the physics': a thin bright core and a wider,
 * fainter glow, each with its own power. Drawn instead of the Tabletop's beam.
 */
function GlowBeam({
  points,
  color,
  core,
  halo,
  haloWidth,
  dark,
}: {
  points: Vec3[];
  color: string;
  /** brightness of the core and of the glow round it: 1 is white-level, more blooms */
  core: number;
  halo: number;
  /** the glow's radius, mm */
  haloWidth: number;
  dark: boolean;
}) {
  const legs = useMemo(() => legsOf(points), [points]);
  const tint = useMemo(() => new Color(color), [color]);
  const whiter = useMemo(() => new Color(color).lerp(new Color("#ffffff"), 0.35), [color]);
  const haloMaterial = <GlowMaterial color={tint} power={halo} core={2.2} dark={dark} />;
  const coreMaterial = <GlowMaterial color={dark ? whiter : tint} power={core} core={0.6} dark={dark} />;
  return (
    <group>
      {legs.map((leg, index) => (
        <group key={index} position={leg.position} quaternion={leg.quaternion}>
          <mesh raycast={NOOP} renderOrder={4}>
            <cylinderGeometry args={[haloWidth, haloWidth, leg.length, 24, 1, true]} />
            {haloMaterial}
          </mesh>
          <mesh raycast={NOOP} renderOrder={5}>
            <cylinderGeometry args={[1.1, 1.1, leg.length, 12, 1, true]} />
            {coreMaterial}
          </mesh>
        </group>
      ))}
      {points.slice(1, -1).map((point, index) => (
        <mesh key={`turn-${index}`} position={point} raycast={NOOP} renderOrder={4}>
          <sphereGeometry args={[haloWidth, 20, 14]} />
          {haloMaterial}
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// The monitor
// ---------------------------------------------------------------------------

/** The screen's colour scale, as the lab's: black, deep blue, cyan, white. */
function ramp(x: number): [number, number, number] {
  const s = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  let c = mix([0, 0, 0], [0.05, 0.12, 0.55], s(0, 0.3, x));
  c = mix(c, [0.2, 0.85, 0.85], s(0.3, 0.7, x));
  c = mix(c, [1, 1, 1], s(0.7, 1, x));
  return [c[0] * 255, c[1] * 255, c[2] * 255];
}

const RAMP = Array.from({ length: 256 }, (_, i) => ramp(i / 255));

/**
 * The capture as the monitor shows it: emission angle across, energy up (as
 * the lab's screen reads a dispersion), on a square-root scale so the thermal
 * branch still shows beside a bright condensate.
 */
export function captureTexture(capture: Frame): DataTexture {
  const { width: columns, height: rows, pixels } = capture;
  let min = Infinity;
  let max = -Infinity;
  for (const v of pixels) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = Math.max(max - min, 1);
  const data = new Uint8Array(rows * columns * 4);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      // a column is a wavelength, and energy falls along the columns: the first is the top
      const v = columns - 1 - j;
      const level = Math.sqrt(Math.max(0, (pixels[i * columns + j] - min) / span));
      const [r, g, b] = RAMP[Math.min(255, Math.round(level * 255))];
      const at = (v * rows + i) * 4;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
      data[at + 3] = 255;
    }
  }
  // a faint line at normal emission, as the lab's live view draws one
  const centre = Math.floor(rows / 2);
  for (let v = 0; v < columns; v++) {
    const at = (v * rows + centre) * 4;
    for (let c = 0; c < 3; c++) data[at + c] = Math.min(255, data[at + c] + 26);
  }
  const texture = new DataTexture(data, rows, columns, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const SCREEN_W = 230;
const SCREEN_H = 150;
const MONITOR_Y = 250;

function Monitor({
  position,
  yaw,
  capture,
  palette,
  hovered,
  onHover,
  onPick,
}: {
  position: Vec3;
  /** degrees about the vertical; 0 faces +z */
  yaw: number;
  capture: Frame | null;
  palette: ScenePalette;
  hovered: boolean;
  onHover: (on: boolean) => void;
  onPick: () => void;
}) {
  const texture = useMemo(() => (capture ? captureTexture(capture) : null), [capture]);
  useEffect(() => () => texture?.dispose(), [texture]);
  const dark = palette.mode === "dark";
  const down = useRef<[number, number] | null>(null);
  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.nativeEvent.button !== 0) return;
    event.stopPropagation();
    down.current = [event.nativeEvent.clientX, event.nativeEvent.clientY];
  };
  const handleUp = (event: ThreeEvent<PointerEvent>) => {
    const start = down.current;
    down.current = null;
    if (!start) return;
    if (Math.hypot(event.nativeEvent.clientX - start[0], event.nativeEvent.clientY - start[1]) <= CLICK_SLOP_PX) onPick();
  };
  const [x, , z] = position;
  return (
    <group
      position={[x, 0, z]}
      rotation={[0, (yaw * Math.PI) / 180, 0]}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
    >
      {/* the post and its foot, in the Tabletop's post grey */}
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[90, 6, 60]} />
        <meshStandardMaterial color={palette.anodise} roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0, (MONITOR_Y - SCREEN_H / 2) / 2, -8]} castShadow receiveShadow>
        <cylinderGeometry args={[7, 7, MONITOR_Y - SCREEN_H / 2, 20]} />
        <meshStandardMaterial color={palette.post} roughness={0.42} metalness={0.6} />
      </mesh>
      {/* the bezel: black anodised, as the instruments' hardware */}
      <RoundedBox args={[SCREEN_W + 14, SCREEN_H + 14, 10]} radius={1.5} smoothness={3} position={[0, MONITOR_Y, -6]} castShadow receiveShadow>
        <meshStandardMaterial color={dark ? "#26282d" : "#1b1c1f"} roughness={0.3} metalness={0.2} />
      </RoundedBox>
      <mesh position={[0, MONITOR_Y, -0.5]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        {texture ? (
          // the screen gives its own light: no shading, and a touch past white at night so a condensate glows
          <meshBasicMaterial key="on" map={texture} toneMapped={false} color={dark ? "#ffffff" : "#e6e6e6"} />
        ) : (
          <meshBasicMaterial key="off" color={dark ? "#06070a" : "#101216"} toneMapped={false} />
        )}
      </mesh>
      {hovered ? (
        <mesh position={[0, MONITOR_Y, -12]}>
          <planeGeometry args={[SCREEN_W + 26, SCREEN_H + 26]} />
          <meshBasicMaterial color={palette.hover} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

// ---------------------------------------------------------------------------
// The laser's lights
// ---------------------------------------------------------------------------

const BARS = 10;

/**
 * Over the Tabletop's laser model: the pump's blue at its aperture (the model
 * is any laser, drawn red) and a row of indicator lights along its top that
 * count the pump power.
 */
function LaserLights({ laser, pump, color, dark }: { laser: BuilderComponent; pump: number; color: string; dark: boolean }) {
  const [x, axis, z] = laser.position;
  const lit = Math.round(pump * BARS);
  const glow = useMemo(() => new Color(color), [color]);
  const off = dark ? "#2a2c33" : "#9da1a8";
  return (
    <group position={[x, 0, z]} rotation={[0, (laser.rotation * Math.PI) / 180, 0]}>
      <group position={[-componentReferenceX(laser), 0, 0]}>
        <mesh position={[LASER_EMITTER.x, axis, 0]} rotation={[0, 0, Math.PI / 2]} raycast={NOOP}>
          <cylinderGeometry args={[7.4, 7.4, LASER_EMITTER.length + 0.4, 22]} />
          <meshBasicMaterial color={glow.clone().multiplyScalar(0.6 + 1.4 * pump)} toneMapped={false} />
        </mesh>
        {/* the +x arrow the Tabletop draws past the emitter: covered in the pump's colour too */}
        <mesh position={[LASER_ARROW.x + 0.3, axis, 0]} rotation={[0, 0, -Math.PI / 2]} raycast={NOOP}>
          <coneGeometry args={[5.5, LASER_ARROW.length + 1.2, 16]} />
          <meshBasicMaterial color={glow.clone().multiplyScalar(0.5 + 0.8 * pump)} toneMapped={false} />
        </mesh>
        {/* a dark panel on the top, and the bars on it */}
        <mesh position={[LASER_BODY_MM / 4, axis + 20.4, 0]} raycast={NOOP}>
          <boxGeometry args={[LASER_BODY_MM / 2 - 4, 0.8, 22]} />
          <meshStandardMaterial color="#16171b" roughness={0.3} />
        </mesh>
        {Array.from({ length: BARS }, (_, i) => (
          <mesh key={i} position={[6 + i * 3.9, axis + 21, 0]} raycast={NOOP}>
            <boxGeometry args={[2.4, 0.8, 14]} />
            {i < lit ? (
              <meshBasicMaterial color={glow.clone().multiplyScalar(i < BARS / 2 ? 1.3 : 1.8)} toneMapped={false} />
            ) : (
              <meshStandardMaterial color={off} roughness={0.4} />
            )}
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

/** Where the monitor stands: behind the spectrometer, turned to the view. */
function monitorPlace(setup: BuilderSceneData): { position: Vec3; yaw: number } | null {
  const spectrometer = setup.components.find((c) => c.type === "spectrometer");
  if (!spectrometer) return null;
  const [x, , z] = spectrometer.position;
  return { position: [x - 40, 0, z - 210], yaw: 35 };
}

export default function BenchScene({ setup, leakageBeamId, pumpBeamId, light, capture, palette, quality, onPick, fitToken, showLabels }: Props) {
  const dark = palette.mode === "dark";
  const [hovered, setHovered] = useState<string | null>(null);
  const [monitorHovered, setMonitorHovered] = useState(false);
  const down = useRef<{ id: string; x: number; y: number } | null>(null);

  // A press on a part that comes up where it went down is a click: drags still pan and orbit.
  useEffect(() => {
    const up = (event: PointerEvent) => {
      const start = down.current;
      down.current = null;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
      const part = componentById(setup.components, start.id);
      const tab = part ? PICKS[part.type] : undefined;
      if (tab) onPick(tab);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [onPick, setup.components]);

  const handleDown = useCallback((id: string, event: ThreeEvent<PointerEvent>) => {
    if (event.nativeEvent.button !== 0) return;
    down.current = { id, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
  }, []);
  const handleHover = useCallback((id: string | null) => setHovered(id), []);
  const hoveredPick = hovered ? PICKS[componentById(setup.components, hovered)?.type ?? "block"] : undefined;
  const pointing = Boolean(hoveredPick) || monitorHovered;
  useEffect(() => {
    document.body.style.cursor = pointing ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [pointing]);

  // A camera on a spectrometer's port is drawn here without its label, which
  // would sit on the spectrometer's: the spectrometer's label names them both.
  const mounted = useMemo(() => {
    const spectrometers = setup.components.filter((c) => c.type === "spectrometer");
    return new Set(
      setup.components
        .filter((c) => c.type === "camera" && spectrometers.some((s) => Math.hypot(s.position[0] - c.position[0], s.position[2] - c.position[2]) < 200))
        .map((c) => c.id),
    );
  }, [setup.components]);
  const drawn = useMemo(() => setup.components.filter((c) => !mounted.has(c.id)), [setup.components, mounted]);
  const handleOver = useCallback((id: string) => setHovered(id), []);
  const handleOut = useCallback(() => setHovered(null), []);

  // The beams the physics lights are drawn here; the rest stay the Tabletop's, faded.
  const beams = useMemo<Beam[]>(
    () =>
      setup.beams
        .filter((beam) => beam.id !== leakageBeamId && beam.id !== pumpBeamId)
        .map((beam) => ({ ...beam, opacity: Math.min(beam.opacity ?? 1, 0.3) })),
    [setup.beams, leakageBeamId, pumpBeamId],
  );
  const leakageBeam = setup.beams.find((beam) => beam.id === leakageBeamId) ?? null;
  const pumpBeam = setup.beams.find((beam) => beam.id === pumpBeamId) ?? null;
  const leakagePoints = useMemo(() => (leakageBeam ? beamPoints(setup.components, leakageBeam.path) : []), [leakageBeam, setup.components]);
  const pumpPoints = useMemo(() => (pumpBeam ? beamPoints(setup.components, pumpBeam.path) : []), [pumpBeam, setup.components]);
  const laser = pumpBeam ? componentById(setup.components, pumpBeam.path[0]) : undefined;
  const monitor = monitorPlace(setup);
  const sample = pumpBeam ? setup.components.find((c) => c.type === "sample" && pumpBeam.path.includes(c.id)) : undefined;
  const spotColor = useMemo(
    () => new Color(pumpBeam?.color ?? "#ffffff").lerp(new Color(leakageBeam?.color ?? "#ffffff"), Math.min(1, light.leakage * light.condensate * 1.5)),
    [pumpBeam?.color, leakageBeam?.color, light.leakage, light.condensate],
  );
  const full = quality === "full";

  // By day the glow lies over a pale sweep, so it is held back and the core carries the beam; at night it is the light in the room.
  const gain = dark ? 1 : 0.55;
  const coreFloor = dark ? 0 : 0.45;
  const { pump, leakage, condensate } = light;
  const thermal = leakage * (1 - condensate);

  return (
    <BuilderCanvas
      components={drawn}
      beams={beams}
      connections={setup.connections}
      frames={setup.frames}
      groups={setup.groups}
      outlinedGroup={null}
      palette={palette}
      lighting={{ brightness: 1, shadows: full }}
      quality={quality}
      selection={[]}
      selectedBeamId={null}
      ghostBeamId={null}
      selectedConnectionId={null}
      selectedFrameId={null}
      ghostFrameId={null}
      framesInteractive={false}
      beamsInteractive={false}
      onBeamClick={NOOP}
      frameDraft={null}
      hoveredId={hoveredPick ? hovered : null}
      beamDraft={[]}
      showLabels={showLabels}
      showDistances={false}
      // the breadboard's holes at night, as a dark bench; by day the Tabletop's plain sweep
      showGrid={dark}
      showPosts
      view="iso"
      fitToken={fitToken}
      dragging={false}
      snapGuide={null}
      onSurfaceClick={NOOP}
      onSurfaceDrag={NOOP}
      onComponentPointerDown={handleDown}
      onComponentHover={handleHover}
      rotationHandle={null}
      onRotationHandlePointerDown={NOOP}
      stageHandle={null}
      onStageHandlePointerDown={NOOP}
      onConnectionPointerDown={NOOP}
      onFramePointerDown={NOOP}
      onCanvasReady={NOOP}
      bloom={full ? (dark ? 0.9 : 0.35) : undefined}
    >
      {setup.components
        .filter((c) => mounted.has(c.id))
        .map((c) => (
          <ComponentMesh
            key={c.id}
            component={c}
            palette={palette}
            selected={false}
            hovered={c.id === hovered}
            showLabel={false}
            showPosts
            onPointerDown={handleDown}
            onPointerOver={handleOver}
            onPointerOut={handleOut}
          />
        ))}
      {/* the far end of the table falls into the room: deep at night, a haze by day */}
      <fog attach="fog" args={[palette.backdrop[dark ? 1 : 2], dark ? 1900 : 2300, dark ? 4200 : 6500]} />
      {pumpPoints.length >= 2 && pumpBeam ? (
        <GlowBeam points={pumpPoints} color={pumpBeam.color} core={coreFloor + gain * (0.5 + 1.3 * pump)} halo={gain * (0.12 + 0.35 * pump)} haloWidth={4} dark={dark} />
      ) : null}
      {leakagePoints.length >= 2 && leakageBeam ? (
        <GlowBeam
          points={leakagePoints}
          color={leakageBeam.color}
          // the condensate is the bright core; the thermal polaritons a wide, faint glow
          core={coreFloor + gain * (0.3 + 2.2 * leakage * condensate)}
          halo={gain * (0.06 + 0.6 * thermal + 0.25 * leakage * condensate)}
          haloWidth={7}
          dark={dark}
        />
      ) : null}
      {sample && pumpBeam ? (
        // where the pump lands: its blue, turning to the leakage's colour as the condensate takes over
        <mesh position={sample.position} raycast={NOOP} renderOrder={6}>
          <sphereGeometry args={[4 + 5 * leakage * condensate, 20, 14]} />
          <GlowMaterial
            color={spotColor}
            power={(dark ? 1 : 0.7) * (0.35 + 0.6 * pump + 1.6 * leakage * condensate)}
            core={1.5}
            dark={dark}
          />
        </mesh>
      ) : null}
      {laser && laser.type === "laser-source" ? <LaserLights laser={laser} pump={0.1 + 0.9 * pump} color={pumpBeam!.color} dark={dark} /> : null}
      {monitor ? (
        <Monitor
          position={monitor.position}
          yaw={monitor.yaw}
          capture={capture}
          palette={palette}
          hovered={monitorHovered}
          onHover={setMonitorHovered}
          onPick={() => onPick("capture")}
        />
      ) : null}
    </BuilderCanvas>
  );
}
