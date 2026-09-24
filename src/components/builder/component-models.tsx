"use client";

import { Html, RoundedBox } from "@react-three/drei";
import {
  CatmullRomCurve3,
  DoubleSide,
  ExtrudeGeometry,
  Mesh,
  MeshPhysicalMaterial,
  Path,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
  type Group,
  type Side,
} from "three";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";

import type { ScenePalette } from "@/components/builder/scene-theme";
import {
  CAVITY_LENGTH_RANGE_MM,
  COMPONENT_SPECS,
  DEFAULT_CAVITY_LENGTH_MM,
  DEFAULT_FOCAL_LENGTH_MM,
  DEFAULT_MOUNT_COLOR,
  FOCAL_LENGTH_RANGE_MM,
  OPTICAL_AXIS_MM,
  clamp,
  componentDisplayName,
  componentRadius,
  type BuilderComponent,
  type LensShape,
} from "@/components/builder/types";

const GLASS_BLUE = "#bfe3ff";
const GLASS_CYAN = "#9fd8e0";
const PLATE_AMBER = "#f4e2b0";
const FILTER_TEAL = "#79b5a4";
const SENSOR_GREEN = "#7be08a";
const EMITTER_RED = "#ff5c5c";
const SAMPLE_COPPER = "#c98a53";
const ACRYLIC = "#f3efe4";
const CERAMIC = "#f2eee6";
const FIBER_JACKET = "#f2c200";
/** Light held in place — a cavity's mode and a trapped particle share it. */
const MODE_COLOR = "#ff5a36";

type ModelProps = { palette: ScenePalette; color?: string };

/** Glow and the parts inside a host must not catch the pointer. */
const NO_RAYCAST = () => null;

/** Height of a part above the table, mm — label offsets and beam height. */
export function componentHeight(type: BuilderComponent["type"]): number {
  return COMPONENT_SPECS[type].height;
}

/**
 * Every optic on this bench shares one beam height (OPTICAL_AXIS_MM), the way
 * a real table does — posts lift each element to the same axis so a straight
 * beam actually hits them. Models are built around that: a base, a post, then
 * the optic centred on the axis.
 *
 * The hardware drawn here is the lab's own: LIOP-TEC opto-mechanics (STAR /
 * PLANET series kinematic mounts, Optomechanics catalogue 2018). That means
 * rounded-square anodised plates roughly twice the optic across, a bored front
 * plate, and 170-TPI fine-thread adjusters standing proud of the back plate.
 * Dimensions below follow the SR100 (1 inch optic) sample drawing: 49 mm
 * plate, 25.4 mm clear bore. The mirror mount and the rotation mount follow
 * Radiant Dyes instead (the open-back MARS mount, their rotation mounts), and
 * everything on a post stands on a 1-inch pedestal pillar.
 */
const AXIS = OPTICAL_AXIS_MM;

/** Nominal optic size on this bench, mm — everything is drawn around 1 inch. */
const OPTIC_D = 25.4;
/** SR100 plate footprint, mm. Roughly 2x the optic, with soft corners. */
const PLATE = 49;
const PLATE_CORNER = 6;

// ---------------------------------------------------------------------------
// Shared hardware
// ---------------------------------------------------------------------------

/**
 * A rounded square with a central bore, extruded — the front plate of a STAR
 * mount. Built once at module scope: geometry construction needs no GL
 * context, and every mount on the bench shares the same casting.
 */
function boredPlate(size: number, corner: number, bore: number, depth: number) {
  const half = size / 2;
  const shape = new Shape();
  shape.moveTo(-half + corner, -half);
  shape.lineTo(half - corner, -half);
  shape.quadraticCurveTo(half, -half, half, -half + corner);
  shape.lineTo(half, half - corner);
  shape.quadraticCurveTo(half, half, half - corner, half);
  shape.lineTo(-half + corner, half);
  shape.quadraticCurveTo(-half, half, -half, half - corner);
  shape.lineTo(-half, -half + corner);
  shape.quadraticCurveTo(-half, -half, -half + corner, -half);

  const hole = new Path();
  hole.absarc(0, 0, bore / 2, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  return new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 24,
  });
}

/** SR100 front plate: 49 mm square, 25.4 mm clear aperture, 8 mm thick. */
/** Filter holder: smaller plate, square window cut by a generous bore. */
const FILTER_PLATE_GEOMETRY = boredPlate(38, 5, 22, 6);

/**
 * The MARS front plate: the bore opens out into a notch over its top quarter,
 * so the plate holds the mirror round only three quarters of its rim.
 */
function openBorePlate(size: number, corner: number, bore: number, depth: number) {
  const half = size / 2;
  const r = bore / 2;
  const outer = r + 7;
  const shape = new Shape();
  shape.moveTo(-half + corner, -half);
  shape.lineTo(half - corner, -half);
  shape.quadraticCurveTo(half, -half, half, -half + corner);
  shape.lineTo(half, half - corner);
  shape.quadraticCurveTo(half, half, half - corner, half);
  shape.lineTo(-half + corner, half);
  shape.quadraticCurveTo(-half, half, -half, half - corner);
  shape.lineTo(-half, -half + corner);
  shape.quadraticCurveTo(-half, -half, -half + corner, -half);
  const start = Math.PI / 4;
  const end = (3 * Math.PI) / 4;
  const hole = new Path();
  hole.absarc(0, 0, r, end, start + 2 * Math.PI, false);
  hole.lineTo(outer * Math.cos(start), outer * Math.sin(start));
  hole.absarc(0, 0, outer, start, end, false);
  hole.closePath();
  shape.holes.push(hole);
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 });
}

/** A flat ring, extruded along +z: mount bodies, dials, trap holders. */
function annulus(outerRadius: number, innerRadius: number, depth: number) {
  const shape = new Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 });
}

const MARS_FRONT_GEOMETRY = openBorePlate(PLATE, PLATE_CORNER, OPTIC_D, 8);
/** The open back: a frame with a window behind the mirror. */
const MARS_BACK_GEOMETRY = boredPlate(PLATE, PLATE_CORNER, 30, 10);
const ROTATION_BODY_GEOMETRY = annulus(24, OPTIC_D / 2 + 0.6, 10);
const ROTATION_DIAL_GEOMETRY = annulus(21, OPTIC_D / 2 + 1.2, 3);
const TRAP_HOLDER_GEOMETRY = annulus(15, 5, 3);
const MIRROR_RING_GEOMETRY = annulus(15.5, OPTIC_D / 2, 8);
const COLLIMATOR_PLATE_GEOMETRY = boredPlate(32, 4, 12, 8);

/** The fiber jacket: out of the collimator's back and down to the table. */
const FIBER_JACKET_GEOMETRY = new TubeGeometry(
  new CatmullRomCurve3([
    new Vector3(-44, OPTICAL_AXIS_MM, 0),
    new Vector3(-60, OPTICAL_AXIS_MM - 4, 0),
    new Vector3(-72, OPTICAL_AXIS_MM - 22, 6),
    new Vector3(-78, OPTICAL_AXIS_MM - 50, 14),
    new Vector3(-86, 4, 26),
    new Vector3(-104, 1.8, 40),
  ]),
  48,
  1.6,
  10,
);

/**
 * Everything that isn't bare steel or glass is drawn as glossy enamel: a
 * dielectric, so its colour stays saturated instead of being darkened by a
 * metallic term, with a tight highlight from the overhead ring lights.
 */
const ENAMEL_ROUGHNESS = 0.18;
const ENAMEL_METALNESS = 0.04;

function Enamel({ color, side }: { color: string; side?: Side }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={ENAMEL_ROUGHNESS}
      metalness={ENAMEL_METALNESS}
      side={side}
    />
  );
}

/** Mount plates: the anodised colour, carried in enamel. */
function Anodised({ color, side }: { color: string; side?: Side }) {
  return <Enamel color={color} side={side} />;
}

/**
 * Real transmission rather than alpha: the glass refracts what's behind it,
 * its edges pick up the ring lights, and its tint deepens with thickness
 * (attenuation). Coloured optics — waveplates, filters — are dense glass that
 * tints strongly; plain optics carry a faint body tint and a strong clearcoat
 * so a clear cube still reads as a block in front of a dark void.
 */
function Glass({ tint, dense = false }: { tint: string; dense?: boolean }) {
  return (
    <meshPhysicalMaterial
      color={tint}
      metalness={0}
      roughness={0.03}
      transmission={0.96}
      ior={1.5}
      thickness={12}
      attenuationColor={tint}
      attenuationDistance={dense ? 8 : 18}
      specularIntensity={1}
      clearcoat={1}
      clearcoatRoughness={0.02}
      envMapIntensity={2}
    />
  );
}

function Stainless({ palette }: { palette: ScenePalette }) {
  return (
    <meshStandardMaterial
      color={palette.metal}
      roughness={0.3}
      metalness={0.85}
    />
  );
}

/**
 * Posts and pedestals are stainless too, but there is a lot of them — left at
 * full brightness they out-shout the optics, which is the opposite of how a
 * bench reads. Knurled screw heads keep the brighter `Stainless`.
 */
function Hardware({ palette }: { palette: ScenePalette }) {
  return (
    <meshStandardMaterial
      color={palette.mode === "dark" ? "#6b727e" : "#a7aeb8"}
      roughness={0.42}
      metalness={0.75}
    />
  );
}

/**
 * A 170-TPI fine-thread adjuster: knurled head standing proud of the back
 * plate on a slim shaft. These are the tell that a mount is kinematic.
 */
function Adjuster({
  palette,
  position,
}: {
  palette: ScenePalette;
  position: [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[2.2, 2.2, 10, 12]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[-7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[4.6, 4.6, 6, 18]} />
        <meshStandardMaterial
          color={palette.metal}
          roughness={0.55}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
}

/**
 * A 1-inch pedestal pillar: a flanged base clamped to the breadboard and a
 * plain stainless pillar up to `top`. Raising a component lengthens the pillar
 * only; the base never changes. The clamping fork and tapped hole are left out.
 */
const PILLAR_RADIUS = 12.7;
const PILLAR_BASE_HEIGHT = 6;

function Pillar({ palette, top = AXIS }: ModelProps & { top?: number }) {
  const length = Math.max(1, top - PILLAR_BASE_HEIGHT);
  return (
    <group>
      <mesh position={[0, PILLAR_BASE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[18, 19.5, PILLAR_BASE_HEIGHT, 36]} />
        <Hardware palette={palette} />
      </mesh>
      <mesh position={[0, PILLAR_BASE_HEIGHT + length / 2, 0]}>
        <cylinderGeometry args={[PILLAR_RADIUS, PILLAR_RADIUS, length, 32]} />
        <Hardware palette={palette} />
      </mesh>
    </group>
  );
}

/**
 * A lens stands on a slim rod with a small pedestal instead: a holder would
 * hide the glass, and the rod still makes the height read as a post.
 */
function SlimRod({ palette, top }: ModelProps & { top: number }) {
  return (
    <group>
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[9.5, 11, 5, 28]} />
        <Hardware palette={palette} />
      </mesh>
      <mesh position={[0, top / 2, 0]}>
        <cylinderGeometry args={[3, 3, top, 16]} />
        <Hardware palette={palette} />
      </mesh>
      {/* the collar that grips the lens edge */}
      <mesh position={[0, top - 2, 0]}>
        <cylinderGeometry args={[4.6, 4.6, 6, 16]} />
        <Stainless palette={palette} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function LaserSource({ palette }: ModelProps) {
  return (
    <group>
      {/* head sits on two feet, aperture on the shared axis */}
      <mesh position={[-24, (AXIS - 20) / 2 + 6, 0]}>
        <boxGeometry args={[22, AXIS - 20, 34]} />
        <Enamel color={palette.body} />
      </mesh>
      <mesh position={[26, (AXIS - 20) / 2 + 6, 0]}>
        <boxGeometry args={[22, AXIS - 20, 34]} />
        <Enamel color={palette.body} />
      </mesh>
      <RoundedBox
        args={[96, 40, 40]}
        radius={0.8}
        smoothness={3}
        position={[0, AXIS, 0]}
      >
        <Enamel color={palette.body} />
      </RoundedBox>
      <mesh position={[50, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[7, 7, 12, 22]} />
        <meshStandardMaterial
          color={EMITTER_RED}
          emissive={EMITTER_RED}
          emissiveIntensity={0.6}
          roughness={ENAMEL_ROUGHNESS}
        />
      </mesh>
      {/* the +x arrow: which way this source fires */}
      <mesh position={[64, AXIS, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[5, 12, 16]} />
        <meshStandardMaterial
          color={EMITTER_RED}
          emissive={EMITTER_RED}
          emissiveIntensity={0.35}
          roughness={ENAMEL_ROUGHNESS}
        />
      </mesh>
    </group>
  );
}

/**
 * A Radiant Dyes MARS fine-adjustment mount: open at the back, and the front
 * plate holds the mirror round three quarters of its rim.
 */
function MirrorMount({ palette, color }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  const corner = PLATE / 2 - 8;
  return (
    <group>
      <Pillar palette={palette} top={AXIS - PLATE / 2 + 4} />
      <mesh
        geometry={MARS_FRONT_GEOMETRY}
        position={[4, AXIS, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Anodised color={mount} />
      </mesh>
      <mesh
        geometry={MARS_BACK_GEOMETRY}
        position={[-8, AXIS, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Anodised color={mount} />
      </mesh>
      <mesh position={[-18, AXIS + corner, -corner]}>
        <sphereGeometry args={[3.2, 14, 12]} />
        <Stainless palette={palette} />
      </mesh>
      <Adjuster palette={palette} position={[-22, AXIS - corner, -corner]} />
      <Adjuster palette={palette} position={[-22, AXIS + corner, corner]} />
      {/* the mirror, seen from behind through the open back */}
      <mesh position={[0, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[OPTIC_D / 2, OPTIC_D / 2, 6, 36]} />
        <meshStandardMaterial
          color="#e8eef5"
          roughness={0.05}
          metalness={0.95}
        />
      </mesh>
    </group>
  );
}

function BeamSplitter({ palette, color }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  const cube = 25.4;
  return (
    <group>
      <Pillar palette={palette} top={AXIS - cube / 2 - 6} />
      {/* cube platform: a plain anodised plate, the way a PBS actually sits */}
      <RoundedBox
        args={[44, 8, 44]}
        radius={0.8}
        smoothness={3}
        position={[0, AXIS - cube / 2 - 4, 0]}
      >
        <Anodised color={mount} />
      </RoundedBox>
      <mesh position={[0, AXIS, 0]}>
        <boxGeometry args={[cube, cube, cube]} />
        <Glass tint={GLASS_CYAN} />
      </mesh>
      {/* the internal 45 degree coating plane; polarizing or not, it looks the same */}
      <mesh position={[0, AXIS, 0]} rotation={[0, Math.PI / 4, 0]}>
        <planeGeometry args={[cube * 1.41, cube]} />
        <meshStandardMaterial
          color="#5fd0e0"
          transparent
          opacity={0.4}
          side={DoubleSide}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
}

/**
 * The lens profile, revolved: a flat or curved face each side of a thin edge.
 * Curvature follows the lensmaker's equation (n = 1.5) but is exaggerated
 * threefold, because a real f = 100 mm lens bulges by under 2 mm; it is capped
 * at a hemisphere.
 */
function lensProfile(shape: LensShape, focalLength: number): Vector2[] {
  const a = OPTIC_D / 2;
  const f = clamp(focalLength, FOCAL_LENGTH_RANGE_MM);
  const curvedFaces = shape === "biconvex" ? 2 : 1;
  const realRadius = 0.5 * f * curvedFaces;
  const radius = Math.max(a, realRadius / 3);
  const sag = radius - Math.sqrt(radius * radius - a * a);
  const edge = 1;
  const steps = 16;
  const face = (sign: 1 | -1) =>
    Array.from({ length: steps + 1 }, (_, index) => {
      const r = (a * index) / steps;
      const y = edge + sag - (radius - Math.sqrt(radius * radius - r * r));
      return new Vector2(r, sign * y);
    });
  const front = face(1).reverse();
  const back =
    shape === "biconvex"
      ? face(-1)
      : [new Vector2(0, -edge), new Vector2(a, -edge)];
  // bottom (back face) to top (front face) keeps the lathe's normals outward
  return [...back, ...front];
}

function Lens({
  palette,
  shape,
  focalLength,
}: ModelProps & { shape: LensShape; focalLength: number }) {
  const profile = useMemo(() => lensProfile(shape, focalLength), [shape, focalLength]);
  return (
    <group>
      <SlimRod palette={palette} top={AXIS - OPTIC_D / 2 + 1} />
      <mesh position={[0, AXIS, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry args={[profile, 48]} />
        <Glass tint={GLASS_BLUE} />
      </mesh>
    </group>
  );
}

/** Every 10 degrees; every 30th tick runs longer. */
const DIAL_TICKS = Array.from({ length: 36 }, (_, index) => ({
  angle: (index * Math.PI) / 18,
  major: index % 3 === 0,
}));

/**
 * A Radiant Dyes-style rotation mount: a round body on the pillar, a
 * graduated dial on its face, and the waveplate dropped in the 1-inch bore.
 * The dial is drawn, not a setting; note the angle in the label.
 */
function Waveplate({ palette, color }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  const tickColor = palette.mode === "dark" ? "#e9e4d8" : "#1b1f26";
  return (
    <group>
      <Pillar palette={palette} top={AXIS - 30} />
      <mesh position={[0, AXIS - 26, 0]}>
        <boxGeometry args={[12, 8, 20]} />
        <Anodised color={mount} />
      </mesh>
      <mesh
        geometry={ROTATION_BODY_GEOMETRY}
        position={[5, AXIS, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Anodised color={mount} />
      </mesh>
      <mesh
        geometry={ROTATION_DIAL_GEOMETRY}
        position={[8, AXIS, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Enamel color={palette.body} />
      </mesh>
      {DIAL_TICKS.map(({ angle, major }) => {
        const length = major ? 4 : 2.2;
        const r = 21 - length / 2 - 0.4;
        return (
          <mesh
            key={angle}
            position={[8.2, AXIS + r * Math.sin(angle), r * Math.cos(angle)]}
            rotation={[-angle, 0, 0]}
          >
            <boxGeometry args={[0.4, 0.6, length]} />
            <meshBasicMaterial color={tickColor} />
          </mesh>
        );
      })}
      {/* index mark on the body, and the locking screw on top */}
      <mesh position={[5.5, AXIS + 22.5, 0]}>
        <boxGeometry args={[1, 3, 1.2]} />
        <meshBasicMaterial color={tickColor} />
      </mesh>
      <mesh position={[0, AXIS + 26, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 5, 14]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[2, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[OPTIC_D / 2, OPTIC_D / 2, 2, 32]} />
        <Glass tint={PLATE_AMBER} dense />
      </mesh>
    </group>
  );
}

function Filter({ palette, color }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  return (
    <group>
      <Pillar palette={palette} top={AXIS - 19} />
      <mesh
        geometry={FILTER_PLATE_GEOMETRY}
        position={[3, AXIS, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Anodised color={mount} />
      </mesh>
      <mesh position={[0, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[12, 12, 3, 32]} />
        <Glass tint={FILTER_TEAL} dense />
      </mesh>
    </group>
  );
}

function Iris({ palette, color }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  return (
    <group>
      <Pillar palette={palette} top={AXIS - 21} />
      <mesh position={[0, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[15, 5, 12, 36]} />
        <Anodised color={mount} />
      </mesh>
      {/* blade stack seen through the aperture */}
      <mesh position={[0, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <ringGeometry args={[4, 15, 32]} />
        <meshStandardMaterial
          color={palette.mode === "dark" ? "#7b828e" : "#b3b9c3"}
          roughness={0.45}
          metalness={0.7}
          side={DoubleSide}
        />
      </mesh>
      {/* the closing lever — every iris on the bench has one sticking out */}
      <mesh position={[0, AXIS + 13, 13]} rotation={[-Math.PI / 4, 0, 0]}>
        <boxGeometry args={[3, 18, 3]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[0, AXIS - 19, 0]}>
        <boxGeometry args={[14, 8, 14]} />
        <Anodised color={mount} />
      </mesh>
    </group>
  );
}

/**
 * The sample: a thin, semi-transparent acrylic slab, floating on the axis and
 * facing the beam like a lens. The real one is 10 x 10 x 1 mm, too small to
 * see, so it is drawn at beam-splitter size.
 */
function Sample() {
  return (
    <mesh position={[0, AXIS, 0]}>
      <boxGeometry args={[3, OPTIC_D, OPTIC_D]} />
      <meshPhysicalMaterial
        color={ACRYLIC}
        metalness={0}
        roughness={0.35}
        transmission={0.6}
        ior={1.49}
        thickness={3}
        clearcoat={0.6}
        clearcoatRoughness={0.2}
      />
    </mesh>
  );
}

/**
 * A fiber collimator: the barrel through a small plate on the pillar, its
 * connector out the back and the jacket curling down to the table. A beam can
 * start here (fiber out) or end here (fiber in).
 */
function FiberCollimator({ palette, color }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  return (
    <group>
      <Pillar palette={palette} top={AXIS - 16 + 2} />
      <mesh
        geometry={COLLIMATOR_PLATE_GEOMETRY}
        position={[4, AXIS, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Anodised color={mount} />
      </mesh>
      <mesh position={[-6, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[6, 6, 32, 24]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[10.2, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[4.5, 4.5, 0.6, 24]} />
        <Enamel color="#1b1f26" />
      </mesh>
      <mesh position={[-27, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[4, 4, 10, 18]} />
        <Hardware palette={palette} />
      </mesh>
      <mesh position={[-38, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[2.2, 3, 12, 14]} />
        <Enamel color={FIBER_JACKET} />
      </mesh>
      <mesh geometry={FIBER_JACKET_GEOMETRY}>
        <Enamel color={FIBER_JACKET} />
      </mesh>
    </group>
  );
}

/** Rod offset from the trap axis, mm — a schematic size, not a real trap's. */
const TRAP_ROD_OFFSET = 8;
const TRAP_ROD_LENGTH = 56;
const TRAP_ENDCAP_GAP = 12;

/**
 * An Innsbruck-style linear Paul trap, floating: four rods along +Y (the trap
 * axis), a ring endcap above and below the centre, and a ceramic holder at
 * each end. Drawn about the size of a cryostat so it can be seen; the centre,
 * where a particle sits, is on the component's height.
 */
function PaulTrap({ palette }: ModelProps) {
  const holderY = TRAP_ROD_LENGTH / 2;
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[sx * TRAP_ROD_OFFSET, AXIS, sz * TRAP_ROD_OFFSET]}
          >
            <cylinderGeometry args={[1.6, 1.6, TRAP_ROD_LENGTH, 16]} />
            <Stainless palette={palette} />
          </mesh>
        )),
      )}
      {[-1, 1].map((side) => (
        <mesh
          key={`cap${side}`}
          position={[0, AXIS + side * TRAP_ENDCAP_GAP, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={NO_RAYCAST}
        >
          <torusGeometry args={[4.5, 1.1, 12, 36]} />
          <meshStandardMaterial
            color={SAMPLE_COPPER}
            roughness={0.3}
            metalness={0.85}
          />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`holder${side}`}
          geometry={TRAP_HOLDER_GEOMETRY}
          position={[0, AXIS + side * holderY + (side > 0 ? 0 : 3), 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <Enamel color={CERAMIC} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The cavity's mode: a TEM00 Gaussian envelope between the mirrors, its waist
 * at the centre. Schematic widths; it is a glow, not a beam.
 */
function modeProfile(length: number, radius: number): Vector2[] {
  const half = length / 2 - 3;
  const waist = 1.4 * radius;
  const edge = 4 * radius;
  const rayleigh = half / Math.sqrt((edge / waist) ** 2 - 1);
  const steps = 32;
  const points = [new Vector2(0, -half)];
  for (let index = 0; index <= steps; index += 1) {
    const x = -half + (2 * half * index) / steps;
    points.push(new Vector2(waist * Math.sqrt(1 + (x / rayleigh) ** 2), x));
  }
  points.push(new Vector2(0, half));
  return points;
}

/** Two facing mirrors along local x, floating, with the mode standing between. */
function Cavity({ color, length }: ModelProps & { length: number }) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  const span = clamp(length, CAVITY_LENGTH_RANGE_MM);
  const halo = useMemo(() => modeProfile(span, 1), [span]);
  const core = useMemo(() => modeProfile(span, 0.45), [span]);
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[(side * span) / 2, AXIS, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[OPTIC_D / 2, OPTIC_D / 2, 6, 36]} />
            <meshStandardMaterial
              color="#e8eef5"
              roughness={0.05}
              metalness={0.95}
            />
          </mesh>
          <mesh
            geometry={MIRROR_RING_GEOMETRY}
            position={[-side * 4, 0, 0]}
            rotation={[0, (side * Math.PI) / 2, 0]}
          >
            <Anodised color={mount} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, AXIS, 0]} rotation={[0, 0, -Math.PI / 2]} raycast={NO_RAYCAST}>
        <latheGeometry args={[halo, 32]} />
        <meshBasicMaterial
          color={MODE_COLOR}
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, AXIS, 0]} rotation={[0, 0, -Math.PI / 2]} raycast={NO_RAYCAST}>
        <latheGeometry args={[core, 24]} />
        <meshBasicMaterial
          color={MODE_COLOR}
          transparent
          opacity={0.75}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * A particle: a small glowing sphere in the mode's colour, inside a soft halo
 * that makes it big enough to see and to click. In a host it sits at the
 * host's centre; alone it floats on the axis.
 */
function Particle() {
  return (
    <group position={[0, AXIS, 0]}>
      <mesh>
        <sphereGeometry args={[1.6, 20, 14]} />
        <meshStandardMaterial
          color={MODE_COLOR}
          emissive={MODE_COLOR}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[4.5, 20, 14]} />
        <meshBasicMaterial
          color={MODE_COLOR}
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Photodiode({ palette }: ModelProps) {
  return (
    <group>
      <Pillar palette={palette} top={AXIS - 14} />
      <RoundedBox
        args={[26, 26, 22]}
        radius={0.8}
        smoothness={3}
        position={[2, AXIS, 0]}
      >
        <Enamel color={palette.body} />
      </RoundedBox>
      <mesh position={[-11.5, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[8, 8, 3, 24]} />
        <meshStandardMaterial
          color={SENSOR_GREEN}
          emissive={SENSOR_GREEN}
          emissiveIntensity={0.35}
          roughness={ENAMEL_ROUGHNESS}
        />
      </mesh>
      {/* BNC stub out the back */}
      <mesh position={[17, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[4, 4, 8, 16]} />
        <Stainless palette={palette} />
      </mesh>
    </group>
  );
}

function CameraBody({ palette }: ModelProps) {
  return (
    <group>
      <Pillar palette={palette} top={AXIS - 22} />
      <RoundedBox
        args={[46, 44, 44]}
        radius={0.8}
        smoothness={3}
        position={[14, AXIS, 0]}
      >
        <Enamel color={palette.body} />
      </RoundedBox>
      {/* C-mount barrel on the axis */}
      <mesh position={[-12, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[13, 15, 20, 28]} />
        <Hardware palette={palette} />
      </mesh>
      <mesh position={[-22, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[11, 11, 2, 28]} />
        <Enamel color="#12161d" />
      </mesh>
    </group>
  );
}

function Spectrometer({ palette }: ModelProps) {
  const body = AXIS + 20;
  return (
    <group>
      <mesh position={[0, body / 2, 0]}>
        <boxGeometry args={[110, body, 80]} />
        <Enamel color={palette.body} />
      </mesh>
      {/* input slit / fibre port, on the shared axis */}
      <mesh position={[-57, AXIS, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[7, 7, 10, 20]} />
        <Enamel color="#1b1f26" />
      </mesh>
      <mesh position={[0, body + 1, 0]}>
        <boxGeometry args={[100, 2, 70]} />
        <Hardware palette={palette} />
      </mesh>
    </group>
  );
}

function SelectionRing({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]}>
      <ringGeometry args={[radius, radius + 3, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </mesh>
  );
}

function HoverRing({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 0]}>
      <ringGeometry args={[radius, radius + 1.6, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Small index chip shown on a component while a beam is being drawn. */
function BeamOrderBadge({ order, height }: { order: number; height: number }) {
  // Two things this Html must not do: scale with distance (distanceFactor is a
  // perspective idea — under an orthographic camera it inflates the element to
  // thousands of pixels), and swallow pointer events (drei's wrapper div sits
  // over the canvas and would eat every click meant for a part; the
  // builderHtmlLayer class disables that).
  return (
    <Html
      position={[0, height + 26, 0]}
      center
      zIndexRange={[0, 0]}
      className="builderHtmlLayer"
    >
      <span className="builderOrderBadge">{order}</span>
    </Html>
  );
}

export type ComponentMeshProps = {
  component: BuilderComponent;
  palette: ScenePalette;
  selected: boolean;
  hovered: boolean;
  showLabel: boolean;
  /** 1-based position in the beam currently being drawn, if any */
  beamOrder?: number;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (event: ThreeEvent<PointerEvent>) => void;
};

export function ComponentMesh({
  component,
  palette,
  selected,
  hovered,
  showLabel,
  beamOrder,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}: ComponentMeshProps) {
  const spec = COMPONENT_SPECS[component.type];
  const radius = componentRadius(component);
  const modelProps = useMemo<ModelProps>(
    () => ({ palette, color: component.color }),
    [palette, component.color],
  );

  // Every solid part casts and catches the key light's shadow; glass and the
  // flat selection rings don't (a transmissive optic throwing a solid shadow
  // is exactly the fake look the glass is there to avoid).
  const group = useRef<Group>(null);
  useLayoutEffect(() => {
    group.current?.traverse((object) => {
      if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
      const solid =
        !(object.material instanceof MeshPhysicalMaterial) &&
        !object.material.transparent;
      object.castShadow = solid;
      object.receiveShadow = solid;
    });
  }, [component]);

  return (
    <group
      ref={group}
      position={component.position}
      rotation={[0, (component.rotation * Math.PI) / 180, 0]}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {component.type === "laser-source" ? (
        <LaserSource {...modelProps} />
      ) : null}
      {component.type === "fiber-collimator" ? (
        <FiberCollimator {...modelProps} />
      ) : null}
      {component.type === "mirror-mount" ? (
        <MirrorMount {...modelProps} />
      ) : null}
      {component.type === "beam-splitter" ? (
        <BeamSplitter {...modelProps} />
      ) : null}
      {component.type === "lens" ? (
        <Lens
          {...modelProps}
          shape={component.lensShape ?? "plano-convex"}
          focalLength={component.focalLength ?? DEFAULT_FOCAL_LENGTH_MM}
        />
      ) : null}
      {component.type === "waveplate" ? <Waveplate {...modelProps} /> : null}
      {component.type === "filter" ? <Filter {...modelProps} /> : null}
      {component.type === "iris" ? <Iris {...modelProps} /> : null}
      {component.type === "sample" ? <Sample /> : null}
      {component.type === "paul-trap" ? <PaulTrap {...modelProps} /> : null}
      {component.type === "cavity" ? (
        <Cavity
          {...modelProps}
          length={component.cavityLength ?? DEFAULT_CAVITY_LENGTH_MM}
        />
      ) : null}
      {component.type === "particle" ? <Particle /> : null}
      {component.type === "photodiode" ? <Photodiode {...modelProps} /> : null}
      {component.type === "camera" ? <CameraBody {...modelProps} /> : null}
      {component.type === "spectrometer" ? (
        <Spectrometer {...modelProps} />
      ) : null}

      {hovered && !selected ? (
        <HoverRing radius={radius} color={palette.hover} />
      ) : null}
      {selected ? (
        <SelectionRing radius={radius} color={palette.accent} />
      ) : null}
      {beamOrder ? (
        <BeamOrderBadge order={beamOrder} height={spec.height} />
      ) : null}

      {showLabel && !component.host ? (
        <Html
          position={[0, spec.height + 12, 0]}
          center
          zIndexRange={[0, 0]}
          className="builderHtmlLayer"
        >
          <span className={`builderLabel${selected ? " is-selected" : ""}`}>
            {componentDisplayName(component)}
          </span>
        </Html>
      ) : null}
    </group>
  );
}
