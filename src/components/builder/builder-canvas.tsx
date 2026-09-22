"use client";

import { Edges, Grid, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  MOUSE,
  Matrix4,
  OrthographicCamera,
  Quaternion,
  TOUCH,
  Vector3,
} from "three";

import { ComponentMesh } from "@/components/builder/component-models";
import type { ScenePalette } from "@/components/builder/scene-theme";
import {
  OPTICAL_AXIS_MM,
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
 * that fits it — so the table fills the panel at any viewport size, in both
 * the isometric and the top-down view.
 */
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
        for (const y of [0, 70]) {
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
    cam.zoom = Math.min(size.width / spanX, size.height / spanY) * 0.96;
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
  onSurfaceDrag: (x: number, z: number, event: ThreeEvent<PointerEvent>) => void;
};

function TableSurface({ palette, onSurfaceClick, onSurfaceDrag }: TableProps) {
  const downAt = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    downAt.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
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

  // One solid slab rather than a plane plus a rim: two coplanar faces at y = 0
  // z-fight, and the grid drops out over half the board on some GPUs. The top
  // face sits exactly at y = 0, which is what the drag maths assumes.
  return (
    <mesh
      position={[0, -TABLE_THICKNESS_MM / 2, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      <boxGeometry args={[TABLE_WIDTH_MM, TABLE_THICKNESS_MM, TABLE_DEPTH_MM]} />
      <meshStandardMaterial color={palette.table} roughness={0.95} metalness={0.05} />
      <Edges color={palette.tableEdge} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Beams
// ---------------------------------------------------------------------------

const UP = new Vector3(0, 1, 0);

function BeamPath({ points, color }: { points: Vector3[]; color: string }) {
  const arrows = useMemo(() => {
    const result: { position: [number, number, number]; quaternion: Quaternion }[] = [];
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const direction = new Vector3().subVectors(to, from);
      if (direction.length() < 40) continue;
      const mid = new Vector3().addVectors(from, to).multiplyScalar(0.5);
      const quaternion = new Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
      result.push({ position: [mid.x, mid.y, mid.z], quaternion });
    }
    return result;
  }, [points]);

  const flat = useMemo(
    () => points.map((point) => [point.x, point.y, point.z] as [number, number, number]),
    [points],
  );

  return (
    <group>
      {/* soft halo under a crisp core — a beam should glow, not just be a stroke */}
      <Line points={flat} color={color} lineWidth={7} transparent opacity={0.18} />
      <Line points={flat} color={color} lineWidth={2.4} />
      {arrows.map((arrow, index) => (
        <mesh
          key={index}
          position={arrow.position}
          quaternion={arrow.quaternion}
          renderOrder={2}
        >
          <coneGeometry args={[4.5, 12, 14]} />
          <meshBasicMaterial color={color} />
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
        new Vector3(component.position[0], OPTICAL_AXIS_MM, component.position[2]),
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
  hoveredId: string | null;
  beamDraft: string[];
  showLabels: boolean;
  showGrid: boolean;
  view: CameraView;
  fitToken: number;
  dragging: boolean;
  onSurfaceClick: (x: number, z: number) => void;
  onSurfaceDrag: (x: number, z: number, event: ThreeEvent<PointerEvent>) => void;
  onComponentPointerDown: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onComponentHover: (id: string | null) => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
};

function CanvasHandle({ onReady }: { onReady: (canvas: HTMLCanvasElement) => void }) {
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
  hoveredId,
  beamDraft,
  showLabels,
  showGrid,
  view,
  fitToken,
  dragging,
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
      camera={{ position: [1400, 1150, 1400], near: -4000, far: 8000, zoom: 1 }}
      gl={{ alpha: false, antialias: true, preserveDrawingBuffer: true }}
      dpr={[1, 2]}
    >
      <CanvasHandle onReady={onCanvasReady} />
      <color attach="background" args={[palette.background]} />
      <ambientLight intensity={palette.ambient} />
      <directionalLight position={[400, 700, 300]} intensity={palette.keyLight} />
      <directionalLight position={[-350, 400, -400]} intensity={palette.fillLight} />
      <hemisphereLight intensity={0.25} groundColor={palette.table} />

      <TableSurface
        palette={palette}
        onSurfaceClick={onSurfaceClick}
        onSurfaceDrag={onSurfaceDrag}
      />

      {showGrid ? (
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
        return <BeamPath key={beam.id} points={points} color={beam.color} />;
      })}

      {beamDraft.length >= 2 ? (
        <BeamPath points={beamPoints(components, beamDraft)} color={palette.accent} />
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
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      />
      <CameraRig view={view} fitToken={fitToken} />
    </Canvas>
  );
}
