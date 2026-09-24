"use client";

import {
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
} from "@react-three/drei";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { EffectComposer, N8AO, Vignette } from "@react-three/postprocessing";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  BackSide,
  CanvasTexture,
  MOUSE,
  Matrix4,
  Mesh,
  NeutralToneMapping,
  OrthographicCamera,
  Quaternion,
  SRGBColorSpace,
  TOUCH,
  Vector3,
} from "three";

import { ComponentMesh } from "@/components/builder/component-models";
import type { ScenePalette } from "@/components/builder/scene-theme";
import {
  BEAM_HEIGHT_MM,
  BEAM_WIDTH_MM,
  TABLE_DEPTH_MM,
  TABLE_WIDTH_MM,
  componentById,
  type Beam,
  type BuilderComponent,
} from "@/components/builder/types";

export type CameraView = "iso" | "top";

const GRID_CELL_MM = 25;
const GRID_SECTION_MM = 100;
const CLICK_SLOP_PX = 4;
const TABLE_THICKNESS_MM = 14;

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

type ControlsLike = { target: Vector3; update: () => void };

/**
 * Frames the whole breadboard. Rather than guessing a zoom constant, the rig
 * projects the table's bounding box into camera space and solves for the zoom
 * that fits it — so the table fills the canvas at any viewport size, in both
 * the isometric and the top-down view.
 */
/** Screen margins the fit keeps clear for the floating HUD (see builder-hud.tsx). */
const FIT_INSET_X_PX = 24;
const FIT_INSET_Y_PX = 64;

function CameraRig({ view, fitToken }: { view: CameraView; fitToken: number }) {
  // `get()` reaches the live camera imperatively; the size selector is here so
  // the fit re-runs when the panel is resized.
  const get = useThree((state) => state.get);
  const size = useThree((state) => state.size);

  useEffect(() => {
    const store = get();
    const cam = store.camera as OrthographicCamera;
    const controls = store.controls as ControlsLike | null;
    const distance = 1400;

    if (view === "top") {
      cam.position.set(0, distance, 0.001);
    } else {
      cam.position.set(distance, distance * 0.82, distance);
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();

    const inverse = new Matrix4().copy(cam.matrixWorld).invert();
    const halfWidth = TABLE_WIDTH_MM / 2 + 20;
    const halfDepth = TABLE_DEPTH_MM / 2 + 20;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const x of [-halfWidth, halfWidth]) {
      for (const z of [-halfDepth, halfDepth]) {
        // up to just above the beam height, where most parts top out
        for (const y of [0, BEAM_HEIGHT_MM + 30]) {
          const point = new Vector3(x, y, z).applyMatrix4(inverse);
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        }
      }
    }

    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    // The HUD islands float over the canvas edges; fit into what they leave.
    const usableWidth = Math.max(size.width - 2 * FIT_INSET_X_PX, 1);
    const usableHeight = Math.max(size.height - 2 * FIT_INSET_Y_PX, 1);
    cam.zoom = Math.min(usableWidth / spanX, usableHeight / spanY) * 0.96;
    cam.updateProjectionMatrix();

    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [get, size.width, size.height, view, fitToken]);

  return null;
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

type TableProps = {
  palette: ScenePalette;
  onSurfaceClick: (x: number, z: number) => void;
  onSurfaceDrag: (
    x: number,
    z: number,
    event: ThreeEvent<PointerEvent>,
  ) => void;
};

function TableSurface({ palette, onSurfaceClick, onSurfaceDrag }: TableProps) {
  const downAt = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    downAt.current = {
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY,
    };
  }, []);

  // A click is a press that didn't travel — so left-drag can pan the table
  // without also dropping a component wherever the drag ended.
  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const start = downAt.current;
      downAt.current = null;
      if (!start) return;
      const travelled = Math.hypot(
        event.nativeEvent.clientX - start.x,
        event.nativeEvent.clientY - start.y,
      );
      if (travelled > CLICK_SLOP_PX) return;
      onSurfaceClick(event.point.x, event.point.z);
    },
    [onSurfaceClick],
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      onSurfaceDrag(event.point.x, event.point.z, event);
    },
    [onSurfaceDrag],
  );

  // The table is never drawn — parts stand on the studio sweep — but it is
  // still the click/drag target, and it catches the key light's shadow so
  // parts stay grounded. One solid slab rather than a plane: a plane at y = 0
  // z-fights the grid on some GPUs. The top face sits exactly at y = 0, which
  // is what the drag maths assumes.
  return (
    <mesh
      receiveShadow
      position={[0, -TABLE_THICKNESS_MM / 2, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <boxGeometry
        args={[TABLE_WIDTH_MM, TABLE_THICKNESS_MM, TABLE_DEPTH_MM]}
      />
      <shadowMaterial
        color={palette.shadow}
        opacity={palette.shadowOpacity}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

/**
 * One high key light casts the only real shadows — short and crisp, like a
 * ceiling fixture. A rim from behind the view lifts white parts off the
 * backdrop. Its shadow camera spans the board plus a margin.
 */
function Lights({ palette }: { palette: ScenePalette }) {
  return (
    <>
      <ambientLight intensity={palette.ambient} />
      <directionalLight
        castShadow
        position={[420, 1000, 520]}
        intensity={palette.keyLight}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-650}
        shadow-camera-right={650}
        shadow-camera-top={650}
        shadow-camera-bottom={-650}
        shadow-camera-near={1}
        shadow-camera-far={3000}
        shadow-bias={-0.0004}
        shadow-normalBias={0.8}
      />
      <directionalLight
        position={[-700, 380, -600]}
        intensity={palette.rimLight}
        color={palette.rimColor}
      />
    </>
  );
}

/**
 * What the enamel and glass reflect: the Discovery corridor — concentric
 * ring lights overhead, one bright wall and one dim so every part keeps a lit
 * side and a shaded side. Built from Lightformers, so there is no HDR to
 * download. The surround is a back-faced sphere rather than a
 * `<color attach="background">`, which would leak onto the main scene.
 *
 * Memoised: drei's Environment re-renders its cube map whenever its children
 * change identity, so without this every drag step, hover and selection
 * re-rendered six faces of the room.
 */
const RingRoom = memo(function RingRoom({ dark }: { dark: boolean }) {
  return (
    <Environment resolution={256} frames={1}>
      <mesh scale={100}>
        <sphereGeometry />
        <meshBasicMaterial
          color={dark ? "#000000" : "#8d9096"}
          side={BackSide}
        />
      </mesh>
      <Lightformer
        form="ring"
        intensity={dark ? 2.5 : 2.4}
        position={[0, 6, 0]}
        rotation-x={Math.PI / 2}
        scale={6}
      />
      <Lightformer
        form="ring"
        intensity={dark ? 1.5 : 1.6}
        position={[0, 6, 0]}
        rotation-x={Math.PI / 2}
        scale={10}
      />
      <Lightformer
        intensity={dark ? 0.4 : 1.2}
        rotation-y={Math.PI / 2}
        position={[-6, 1, 0]}
        scale={[20, 6, 1]}
      />
      <Lightformer
        intensity={dark ? 0.2 : 0.35}
        rotation-y={-Math.PI / 2}
        position={[6, 1, 0]}
        scale={[20, 6, 1]}
      />
    </Environment>
  );
});

/**
 * The studio sweep behind the parts: a radial gradient on a plane pinned
 * behind the camera. Not `scene.background`, which the post pipeline tone
 * maps into a flat grey; this plane opts out of tone mapping so the gradient
 * lands exactly. It ignores the pointer, so clicks reach the table.
 */
function Backdrop({ stops }: { stops: ScenePalette["backdrop"] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(512, 460, 40, 512, 512, 760);
      gradient.addColorStop(0, stops[0]);
      gradient.addColorStop(0.58, stops[1]);
      gradient.addColorStop(1, stops[2]);
      context.fillStyle = gradient;
      context.fillRect(0, 0, 1024, 1024);
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [stops]);
  useEffect(() => () => texture.dispose(), [texture]);

  const plane = useRef<Mesh>(null);
  const forward = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const mesh = plane.current;
    if (!mesh || !(camera instanceof OrthographicCamera)) return;
    camera.getWorldDirection(forward);
    mesh.position
      .copy(camera.position)
      .addScaledVector(forward, camera.far * 0.9);
    mesh.quaternion.copy(camera.quaternion);
    mesh.scale.set(
      (camera.right - camera.left) / camera.zoom,
      (camera.top - camera.bottom) / camera.zoom,
      1,
    );
  });

  return (
    <mesh ref={plane} raycast={() => {}} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Beams
// ---------------------------------------------------------------------------

const UP = new Vector3(0, 1, 0);

/**
 * A fat line in millimetres. Not drei's <Line>: that one disposes its
 * material whenever its points change, so every drag step threw the compiled
 * shader away and the next frame recompiled it — about a second per step.
 * Here the material lives as long as the line; only the geometry is swapped.
 */
function BeamLine({
  points,
  color,
  width,
  opacity,
  depthWrite,
}: {
  points: [number, number, number][];
  color: string;
  width: number;
  opacity: number;
  depthWrite: boolean;
}) {
  const size = useThree((state) => state.size);
  const line = useMemo(() => new Line2(), []);
  const material = useMemo(
    () => new LineMaterial({ worldUnits: true, transparent: true }),
    [],
  );
  const geometry = useMemo(() => {
    const next = new LineGeometry();
    next.setPositions(points.flat());
    return next;
  }, [points]);
  // three objects are mutated in place; the ref is how the effect reaches this one
  const ref = useRef<Line2>(null);

  useLayoutEffect(() => {
    ref.current?.computeLineDistances();
    return () => geometry.dispose();
  }, [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <primitive ref={ref} object={line}>
      <primitive object={geometry} attach="geometry" />
      <primitive
        object={material}
        attach="material"
        color={color}
        linewidth={width}
        opacity={opacity}
        depthWrite={depthWrite}
        resolution={[size.width, size.height]}
      />
    </primitive>
  );
}

/**
 * A beam, drawn in millimetres on the table: its width scales with the zoom
 * like the parts do. A selected beam draws fully opaque with a stronger halo,
 * so even a faint one can be found by clicking its chip.
 */
function BeamPath({
  points,
  color,
  width = BEAM_WIDTH_MM,
  opacity = 1,
  selected = false,
}: {
  points: Vector3[];
  color: string;
  width?: number;
  opacity?: number;
  selected?: boolean;
}) {
  const alpha = selected ? 1 : opacity;
  const arrowRadius = Math.max(3.5, width * 1.9);
  const arrows = useMemo(() => {
    const result: {
      position: [number, number, number];
      quaternion: Quaternion;
    }[] = [];
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const direction = new Vector3().subVectors(to, from);
      if (direction.length() < 40) continue;
      const mid = new Vector3().addVectors(from, to).multiplyScalar(0.5);
      const quaternion = new Quaternion().setFromUnitVectors(
        UP,
        direction.clone().normalize(),
      );
      result.push({ position: [mid.x, mid.y, mid.z], quaternion });
    }
    return result;
  }, [points]);

  const flat = useMemo(
    () =>
      points.map(
        (point) => [point.x, point.y, point.z] as [number, number, number],
      ),
    [points],
  );

  return (
    <group>
      {/* soft halo under a crisp core — a beam should glow, not just be a stroke */}
      <BeamLine
        points={flat}
        color={color}
        width={width * (selected ? 4 : 2.9)}
        opacity={(selected ? 0.34 : 0.18) * alpha}
        depthWrite={false}
      />
      {/* always transparent: three.js ignores a later flip of `transparent`
          on a compiled material, so a beam faded after drawing would stay solid */}
      <BeamLine
        points={flat}
        color={color}
        width={width}
        opacity={alpha}
        depthWrite={alpha === 1}
      />
      {arrows.map((arrow, index) => (
        <mesh
          key={index}
          position={arrow.position}
          quaternion={arrow.quaternion}
          renderOrder={2}
        >
          <coneGeometry args={[arrowRadius, arrowRadius * 2.7, 14]} />
          <meshBasicMaterial color={color} transparent opacity={alpha} depthWrite={alpha === 1} />
        </mesh>
      ))}
    </group>
  );
}

function beamPoints(components: BuilderComponent[], path: string[]): Vector3[] {
  return path
    .map((id) => componentById(components, id))
    .filter((component): component is BuilderComponent => Boolean(component))
    .map(
      (component) =>
        new Vector3(...component.position),
    );
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export type BuilderCanvasProps = {
  components: BuilderComponent[];
  beams: Beam[];
  palette: ScenePalette;
  selectedId: string | null;
  selectedBeamId: string | null;
  hoveredId: string | null;
  beamDraft: string[];
  showLabels: boolean;
  showGrid: boolean;
  view: CameraView;
  fitToken: number;
  dragging: boolean;
  onSurfaceClick: (x: number, z: number) => void;
  onSurfaceDrag: (
    x: number,
    z: number,
    event: ThreeEvent<PointerEvent>,
  ) => void;
  onComponentPointerDown: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onComponentHover: (id: string | null) => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  /** a part is armed in the palette, waiting to be dropped */
  placing: boolean;
};

function CanvasHandle({
  onReady,
}: {
  onReady: (canvas: HTMLCanvasElement) => void;
}) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    onReady(gl.domElement);
  }, [gl, onReady]);
  return null;
}

export default function BuilderCanvas({
  components,
  beams,
  palette,
  selectedId,
  selectedBeamId,
  hoveredId,
  beamDraft,
  showLabels,
  showGrid,
  view,
  fitToken,
  dragging,
  placing,
  onSurfaceClick,
  onSurfaceDrag,
  onComponentPointerDown,
  onComponentHover,
  onCanvasReady,
}: BuilderCanvasProps) {
  const draftOrder = useMemo(() => {
    const map = new Map<string, number>();
    beamDraft.forEach((id, index) => map.set(id, index + 1));
    return map;
  }, [beamDraft]);
  return (
    <Canvas
      orthographic
      // PCF: three r18x dropped PCFSoftShadowMap (R3F's "soft"); PCF is now the soft one.
      shadows="percentage"
      frameloop="demand"
      camera={{ position: [1400, 1150, 1400], near: -4000, far: 8000, zoom: 1 }}
      gl={{
        alpha: false,
        antialias: true,
        preserveDrawingBuffer: true,
        toneMapping: NeutralToneMapping,
      }}
      dpr={[1, 2]}
    >
      <CanvasHandle onReady={onCanvasReady} />
      {/* the edge colour, for the instant before the backdrop plane is placed */}
      <color attach="background" args={[palette.backdrop[2]]} />
      <Lights palette={palette} />
      <RingRoom dark={palette.mode === "dark"} />
      <Backdrop stops={palette.backdrop} />

      <TableSurface
        palette={palette}
        onSurfaceClick={onSurfaceClick}
        onSurfaceDrag={onSurfaceDrag}
      />

      {/* with no table drawn, the grid is a working aid, not scenery: it shows
          only while a part is being placed or dragged */}
      {showGrid && (placing || dragging) ? (
        <Grid
          args={[TABLE_WIDTH_MM, TABLE_DEPTH_MM]}
          cellSize={GRID_CELL_MM}
          cellThickness={0.8}
          cellColor={palette.gridCell}
          sectionSize={GRID_SECTION_MM}
          sectionThickness={1}
          sectionColor={palette.gridSection}
          fadeDistance={6000}
          fadeStrength={0}
          infiniteGrid={false}
          position={[0, 0.4, 0]}
        />
      ) : null}

      {components.map((component) => (
        <ComponentMesh
          key={component.id}
          component={component}
          palette={palette}
          selected={component.id === selectedId}
          hovered={component.id === hoveredId}
          showLabel={showLabels}
          beamOrder={draftOrder.get(component.id)}
          onPointerDown={(event) => {
            event.stopPropagation();
            onComponentPointerDown(component.id, event);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            onComponentHover(component.id);
          }}
          onPointerOut={() => onComponentHover(null)}
        />
      ))}

      {beams.map((beam) => {
        const points = beamPoints(components, beam.path);
        if (points.length < 2) return null;
        return (
          <BeamPath
            key={beam.id}
            points={points}
            color={beam.color}
            width={beam.width}
            opacity={beam.opacity}
            selected={beam.id === selectedBeamId}
          />
        );
      })}

      {beamDraft.length >= 2 ? (
        <BeamPath
          points={beamPoints(components, beamDraft)}
          color={palette.accent}
        />
      ) : null}

      <OrbitControls
        makeDefault
        enabled={!dragging}
        enableRotate={false}
        enableZoom
        enablePan
        zoomSpeed={0.9}
        minZoom={0.2}
        maxZoom={14}
        mouseButtons={{
          LEFT: MOUSE.PAN,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.PAN,
        }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      />
      <CameraRig view={view} fitToken={fitToken} />

      {/* the miniature finish: contact occlusion grounds every part, the
          vignette pulls the eye to the middle of the board */}
      <EffectComposer multisampling={4}>
        <N8AO
          aoRadius={30}
          distanceFalloff={1}
          intensity={palette.occlusion}
          color="#000000"
          halfRes
        />
        <Vignette offset={0.35} darkness={palette.vignette} />
      </EffectComposer>
    </Canvas>
  );
}
