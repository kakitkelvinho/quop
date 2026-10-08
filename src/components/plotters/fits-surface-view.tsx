"use client";

// The Surface view: one frame drawn as a landscape, pixel position across the
// ground and value as elevation, in the Image view's colormap. The shared FITS
// image viewer owns every setting (colormap, slice, exaggeration, camera
// preset) and shows this in place of its flat canvas; the arrays come from
// surface-geometry.ts.

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Bvh, Html, Line, OrbitControls } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DataTexture,
  DoubleSide,
  LinearFilter,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Mesh,
  type PerspectiveCamera,
  type Texture,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import {
  interpolateColor,
  renderColormappedFrame,
  type ColorMapName,
} from "@/components/plotters/colormaps";
import {
  buildSurfaceArrays,
  chooseSurfaceStep,
  localX,
  localY,
  niceTicks,
  normaliseValue,
  pixelFromLocal,
  pixelTicks,
  reduceFrame,
  surfaceLayout,
  type SurfaceLayout,
} from "@/components/plotters/surface-geometry";

export type SurfaceFrame = {
  height: number;
  max: number;
  min: number;
  pixels: Float32Array;
  width: number;
};

export type CameraPreset = "isometric" | "top" | "side-x" | "side-y";

export type SurfaceSlice = { axis: "horizontal" | "vertical"; index: number };

/** What the viewer's PNG export needs from the Surface view. */
export type SurfaceExport = {
  /** renders the scene once at `scaleFactor` and draws it into `rect` */
  drawInto: (
    context: CanvasRenderingContext2D,
    rect: { height: number; width: number; x: number; y: number },
    scaleFactor: number,
  ) => void;
};

/** The landscape's height at exaggeration 1, against a footprint whose longer side is 1. */
const RELIEF = 0.4;
const INK = "#8a94a3";
const SLICE_COLOR = "#ffd54f";
const TICK = 0.02;
const NO_RAYCAST = () => null;

const PRESET_DIRECTIONS: Record<CameraPreset, [number, number, number]> = {
  isometric: [0.85, -1.3, 1.05],
  // a hair off the pole, so "up" on screen is the last row, as in the Image view
  top: [0, -0.001, 1],
  "side-x": [0, -1, 0],
  "side-y": [-1, 0, 0],
};

function formatTick(value: number) {
  const absolute = Math.abs(value);

  if (absolute !== 0 && (absolute >= 1e5 || absolute < 1e-3)) {
    return value.toExponential(1);
  }

  return String(Number(value.toPrecision(6)));
}

function buildColormapTexture(colorMap: ColorMapName) {
  const data = new Uint8Array(256 * 4);

  for (let index = 0; index < 256; index += 1) {
    const [red, green, blue] = interpolateColor(colorMap, index / 255);
    data.set([red, green, blue, 255], index * 4);
  }

  const texture = new DataTexture(data, 256, 1, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function buildImageTexture(frame: SurfaceFrame, colorMap: ColorMapName) {
  const canvas = document.createElement("canvas");
  renderColormappedFrame(canvas, frame, colorMap);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  return texture;
}

type HoverSample = { value: number; x: number; y: number };

function Landscape({
  colorMap,
  frame,
  layout,
  onHover,
  shading,
}: {
  colorMap: ColorMapName;
  frame: SurfaceFrame;
  layout: SurfaceLayout;
  onHover: (sample: HoverSample | null) => void;
  shading: boolean;
}) {
  const step = chooseSurfaceStep(frame.width, frame.height);
  const reduced = useMemo(
    () => reduceFrame(frame.pixels, frame.width, frame.height, step),
    [frame, step],
  );
  // the mesh is built once at true pixels and stretched to the pixel aspect by
  // its group's scale, so dragging the aspect slider never rebuilds a 320k-vertex
  // grid (three.js lights a non-uniformly scaled mesh through its normal matrix)
  const baseLayout = useMemo(() => surfaceLayout(frame.width, frame.height), [frame]);
  const stretch: [number, number, number] = [
    layout.scaleX / baseLayout.scaleX,
    layout.scaleY / baseLayout.scaleY,
    1,
  ];
  const geometry = useMemo(() => {
    const arrays = buildSurfaceArrays(reduced, frame.width, frame.height, frame.min, frame.max, baseLayout);
    const result = new BufferGeometry();
    result.setAttribute("position", new BufferAttribute(arrays.position, 3));
    // full resolution looks each value up in the colormap; a downsampled mesh
    // wears the full-resolution image instead, so top-down still shows every pixel
    result.setAttribute("uv", new BufferAttribute(step === 1 ? arrays.valueUv : arrays.imageUv, 2));
    result.setIndex(new BufferAttribute(arrays.index, 1));
    result.computeVertexNormals();
    return result;
  }, [baseLayout, frame, reduced, step]);
  const texture = useMemo<Texture>(
    () => (step === 1 ? buildColormapTexture(colorMap) : buildImageTexture(frame, colorMap)),
    [colorMap, frame, step],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => texture.dispose(), [texture]);

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    // in the mesh's own (unstretched) coordinates
    const local = (event.object as Mesh).worldToLocal(event.point.clone());
    const { column, row } = pixelFromLocal(local.x, local.y, frame.width, frame.height, baseLayout);
    // the original pixel, not the (maybe downsampled) mesh vertex
    onHover({ value: frame.pixels[row * frame.width + column] ?? Number.NaN, x: column, y: row });
  }

  return (
    // keyed on the geometry: drei's Bvh builds its bounds tree once, on mount
    <Bvh firstHitOnly key={geometry.uuid}>
      <group scale={stretch}>
        <mesh geometry={geometry} onPointerMove={handlePointerMove} onPointerOut={() => onHover(null)}>
          {shading ? (
            <meshLambertMaterial map={texture} side={DoubleSide} />
          ) : (
            <meshBasicMaterial map={texture} side={DoubleSide} />
          )}
        </mesh>
      </group>
    </Bvh>
  );
}

function Label({ position, text, title = false }: { position: [number, number, number]; text: string; title?: boolean }) {
  return (
    <Html center position={position} style={{ pointerEvents: "none" }} zIndexRange={[3, 0]}>
      <span
        className={`fitsSurfaceLabel ${title ? "fitsSurfaceLabel--title" : ""}`}
        data-surface-label=""
      >
        {text}
      </span>
    </Html>
  );
}

function Axes({
  frame,
  layout,
  valueLabel,
  xLabel,
  yLabel,
}: {
  frame: SurfaceFrame;
  layout: SurfaceLayout;
  valueLabel: string;
  xLabel: string;
  yLabel: string;
}) {
  const { halfX, halfY } = layout;
  // memoised so a hover re-render doesn't rebuild the tick geometry; the
  // shorter side of a long strip gets fewer ticks so its labels don't collide
  const { valueTicks, xTicks, yTicks } = useMemo(() => {
    const longest = Math.max(halfX, halfY);

    return {
      valueTicks: niceTicks(frame.min, frame.max, 4),
      xTicks: pixelTicks(frame.width, Math.max(2, Math.round((5 * halfX) / longest))),
      yTicks: pixelTicks(frame.height, Math.max(2, Math.round((5 * halfY) / longest))),
    };
  }, [frame, halfX, halfY]);
  const segments = useMemo(() => {
    const points: number[] = [];
    const push = (a: [number, number, number], b: [number, number, number]) => points.push(...a, ...b);

    // the floor outline, and the value axis up the far left corner, clear of the x = 0 tick
    push([-halfX, -halfY, 0], [halfX, -halfY, 0]);
    push([halfX, -halfY, 0], [halfX, halfY, 0]);
    push([halfX, halfY, 0], [-halfX, halfY, 0]);
    push([-halfX, halfY, 0], [-halfX, -halfY, 0]);
    push([-halfX, halfY, 0], [-halfX, halfY, 1]);

    for (const tick of xTicks) {
      const x = localX(tick, frame.width, layout);
      push([x, -halfY, 0], [x, -halfY - TICK, 0]);
    }

    for (const tick of yTicks) {
      const y = localY(tick, frame.height, layout);
      push([halfX, y, 0], [halfX + TICK, y, 0]);
    }

    for (const tick of valueTicks) {
      const z = normaliseValue(tick, frame.min, frame.max);
      push([-halfX, halfY, z], [-halfX - TICK, halfY, z]);
    }

    const result = new BufferGeometry();
    result.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    return result;
  }, [frame, halfX, halfY, layout, valueTicks, xTicks, yTicks]);

  useEffect(() => () => segments.dispose(), [segments]);

  return (
    <group>
      <lineSegments geometry={segments} raycast={NO_RAYCAST}>
        <lineBasicMaterial color={INK} />
      </lineSegments>
      {xTicks.map((tick) => (
        <Label
          key={`x${tick}`}
          position={[localX(tick, frame.width, layout), -halfY - 3 * TICK, 0]}
          text={formatTick(tick)}
        />
      ))}
      {yTicks.map((tick) => (
        <Label
          key={`y${tick}`}
          position={[halfX + 3 * TICK, localY(tick, frame.height, layout), 0]}
          text={formatTick(tick)}
        />
      ))}
      {valueTicks.map((tick) => (
        <Label
          key={`v${tick}`}
          position={[-halfX - 3.5 * TICK, halfY, normaliseValue(tick, frame.min, frame.max)]}
          text={formatTick(tick)}
        />
      ))}
      {xLabel ? <Label position={[0, -halfY - 7 * TICK, 0]} text={xLabel} title /> : null}
      {yLabel ? <Label position={[halfX + 7 * TICK, 0, 0]} text={yLabel} title /> : null}
      {valueLabel ? <Label position={[-halfX, halfY, 1.28]} text={valueLabel} title /> : null}
    </group>
  );
}

function SlicePlane({ frame, layout, slice }: { frame: SurfaceFrame; layout: SurfaceLayout; slice: SurfaceSlice }) {
  const horizontal = slice.axis === "horizontal";
  const points = useMemo(() => {
    const count = horizontal ? frame.width : frame.height;

    return Array.from({ length: count }, (_, index) => {
      const column = horizontal ? index : slice.index;
      const row = horizontal ? slice.index : index;
      const value = frame.pixels[row * frame.width + column];

      return new Vector3(
        localX(column, frame.width, layout),
        localY(row, frame.height, layout),
        normaliseValue(value, frame.min, frame.max) + 0.002,
      );
    });
  }, [frame, horizontal, layout, slice.index]);
  const position: [number, number, number] = horizontal
    ? [0, localY(slice.index, frame.height, layout), 0.5]
    : [localX(slice.index, frame.width, layout), 0, 0.5];
  const size: [number, number, number] = horizontal
    ? [2 * layout.halfX, 0.0015, 1]
    : [0.0015, 2 * layout.halfY, 1];

  return (
    <group>
      <mesh position={position} raycast={NO_RAYCAST} renderOrder={1}>
        <boxGeometry args={size} />
        <meshBasicMaterial color={SLICE_COLOR} depthWrite={false} opacity={0.22} side={DoubleSide} transparent />
      </mesh>
      <Line color={SLICE_COLOR} lineWidth={2.5} points={points} raycast={NO_RAYCAST} renderOrder={2} />
    </group>
  );
}

/** How far back the camera sits to fit the landscape's bounding sphere in the narrower field of view. */
function fitDistance(camera: PerspectiveCamera, layout: SurfaceLayout, relief: number) {
  const radius = Math.hypot(layout.halfX, layout.halfY, relief / 2);
  const halfFov = Math.min(
    (camera.fov * Math.PI) / 360,
    Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect),
  );

  return (radius / Math.sin(halfFov)) * 1.08;
}

function CameraRig({
  layout,
  preset,
  relief,
  token,
}: {
  layout: SurfaceLayout;
  preset: CameraPreset;
  relief: number;
  token: number;
}) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((state) => state.invalidate);
  // the framing reads these when a preset is picked, not every time they change,
  // so dragging the exaggeration slider doesn't yank the camera
  const framingRef = useRef({ layout, relief });

  useEffect(() => {
    framingRef.current = { layout, relief };
  }, [layout, relief]);

  useEffect(() => {
    if (!controls) {
      return;
    }

    const framing = framingRef.current;
    const target = new Vector3(0, 0, framing.relief / 2);
    const direction = new Vector3(...PRESET_DIRECTIONS[preset]).normalize();

    camera.position.copy(target).addScaledVector(direction, fitDistance(camera, framing.layout, framing.relief));
    controls.target.copy(target);
    controls.update();
    invalidate();
  }, [camera, controls, invalidate, preset, token]);

  // a new pixel aspect changes the footprint's diagonal: refit the distance
  // but keep the angle the camera has been orbited to
  useEffect(() => {
    if (!controls) {
      return;
    }

    const direction = camera.position.clone().sub(controls.target).normalize();
    camera.position
      .copy(controls.target)
      .addScaledVector(direction, fitDistance(camera, layout, framingRef.current.relief));
    controls.update();
    invalidate();
  }, [camera, controls, invalidate, layout]);

  return null;
}

function ExportBridge({ exportRef }: { exportRef: RefObject<SurfaceExport | null> }) {
  const get = useThree((state) => state.get);

  useEffect(() => {
    exportRef.current = {
      drawInto(context, rect, scaleFactor) {
        const { camera, gl, invalidate, scene } = get();
        const size = gl.getSize(new Vector2());
        const pixelRatio = gl.getPixelRatio();

        // render and copy in the same task: without preserveDrawingBuffer the
        // buffer is only readable until the browser composites it
        gl.setPixelRatio(scaleFactor);
        gl.setSize(size.x, size.y, false);
        gl.render(scene, camera);
        context.drawImage(gl.domElement, rect.x, rect.y, rect.width, rect.height);
        gl.setPixelRatio(pixelRatio);
        gl.setSize(size.x, size.y, false);
        invalidate();
      },
    };

    return () => {
      exportRef.current = null;
    };
  }, [exportRef, get]);

  return null;
}

function formatReadoutValue(value: number) {
  if (!Number.isFinite(value)) {
    return "NaN";
  }

  const absolute = Math.abs(value);
  return absolute >= 10000 || (absolute > 0 && absolute < 0.001) ? value.toExponential(3) : value.toFixed(4);
}

export type FitsSurfaceViewProps = {
  cameraPreset: CameraPreset;
  /** bumped to re-apply `cameraPreset`, even when it is already the current one */
  cameraToken: number;
  colorMap: ColorMapName;
  exaggeration: number;
  exportRef: RefObject<SurfaceExport | null>;
  frame: SurfaceFrame;
  /** how tall one pixel is drawn relative to its width; 1 is true pixels */
  pixelAspect: number;
  shading: boolean;
  slice: SurfaceSlice | null;
  valueLabel: string;
  xLabel: string;
  yLabel: string;
};

export default function FitsSurfaceView({
  cameraPreset,
  cameraToken,
  colorMap,
  exaggeration,
  exportRef,
  frame,
  pixelAspect,
  shading,
  slice,
  valueLabel,
  xLabel,
  yLabel,
}: FitsSurfaceViewProps) {
  const [hover, setHover] = useState<HoverSample | null>(null);
  const layout = useMemo(() => surfaceLayout(frame.width, frame.height, pixelAspect), [frame, pixelAspect]);
  const relief = RELIEF * exaggeration;
  const hoverPoint = hover
    ? new Vector3(
        localX(hover.x, frame.width, layout),
        localY(hover.y, frame.height, layout),
        normaliseValue(hover.value, frame.min, frame.max),
      )
    : null;

  return (
    <div className="fitsSurfaceCanvas" onPointerLeave={() => setHover(null)}>
      <Canvas
        camera={{ fov: 35, near: 0.01, far: 50, position: [1.2, -1.8, 1.4], up: [0, 0, 1] }}
        dpr={[1, 2]}
        flat
        frameloop="demand"
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.62 * Math.PI} />
        <directionalLight intensity={0.42 * Math.PI} position={[0.5, -0.7, 1]} />
        <group scale={[1, 1, relief]}>
          <Landscape colorMap={colorMap} frame={frame} layout={layout} onHover={setHover} shading={shading} />
          <Axes frame={frame} layout={layout} valueLabel={valueLabel} xLabel={xLabel} yLabel={yLabel} />
          {slice ? <SlicePlane frame={frame} layout={layout} slice={slice} /> : null}
          {hoverPoint ? (
            <mesh position={hoverPoint} raycast={NO_RAYCAST} scale={[1, 1, 1 / relief]}>
              <sphereGeometry args={[0.007, 12, 8]} />
              <meshBasicMaterial color="#9cff8f" depthTest={false} />
            </mesh>
          ) : null}
        </group>
        <OrbitControls enableDamping={false} makeDefault maxDistance={12} minDistance={0.15} />
        <CameraRig layout={layout} preset={cameraPreset} relief={relief} token={cameraToken} />
        <ExportBridge exportRef={exportRef} />
      </Canvas>
      {hover ? (
        <div className="fitsReadout">
          <span>x {hover.x}</span>
          <span>y {hover.y}</span>
          <span>value {formatReadoutValue(hover.value)}</span>
        </div>
      ) : null}
    </div>
  );
}
