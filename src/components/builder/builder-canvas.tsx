"use client";

import {
  Environment,
  Grid,
  Lightformer,
  Line,
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
  type RefObject,
} from "react";
import {
  BackSide,
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  MOUSE,
  Matrix4,
  Mesh,
  NeutralToneMapping,
  type Object3D,
  OrthographicCamera,
  Plane,
  Quaternion,
  type Ray,
  Raycaster,
  SRGBColorSpace,
  ShaderMaterial,
  TOUCH,
  Vector2,
  Vector3,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { ComponentMesh } from "@/components/builder/component-models";
import { ConnectionPath } from "@/components/builder/connection-path";
import { FrameMesh } from "@/components/builder/frame-mesh";
import type { ScenePalette } from "@/components/builder/scene-theme";
import {
  BEAM_HEIGHT_MM,
  BEAM_WIDTH_MM,
  beamPoints,
  COMPONENT_SPECS,
  CONNECTION_KINDS,
  TABLE_GUARD_MM,
  componentById,
  componentRadius,
  type Beam,
  type Frame,
  type BuilderComponent,
  type Connection,
  type Vec3,
} from "@/components/builder/types";

export type CameraView = "iso" | "top";

const GRID_CELL_MM = 25;
const GRID_SECTION_MM = 100;
/** how far from under the camera the grid fades out, mm: past the edge of the widest zoom */
const GRID_FADE_MM = 9000;
/** the beam-line snap guide lies on the table, just above the grid (0.4 mm) */
const SNAP_GUIDE_Y_MM = 0.8;
/** a press that travels further than this, in screen pixels, is a drag, not a click */
export const CLICK_SLOP_PX = 4;
const TABLE_THICKNESS_MM = 14;
/**
 * The surface reaches far past the guard: its edge must stay off-screen even
 * when a part at the guard is seen at the widest zoom.
 */
const TABLE_SPAN_MM = 2 * (TABLE_GUARD_MM + 10000);

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

type ControlsLike = { target: Vector3; update: () => void };

/**
 * The box the components fill: their footprints on the table, from the table
 * up to the top of the tallest part. An empty table frames the 800 × 600 mm
 * breadboard the builder used to be bounded by, so a fresh scene looks the
 * same as it always has.
 */
function layoutBox(components: BuilderComponent[]): Box3 {
  if (components.length === 0) {
    return new Box3(
      new Vector3(-420, 0, -320),
      new Vector3(420, BEAM_HEIGHT_MM + 30, 320),
    );
  }
  const box = new Box3();
  for (const component of components) {
    const [x, y, z] = component.position;
    const radius = componentRadius(component);
    box.expandByPoint(new Vector3(x - radius, 0, z - radius));
    box.expandByPoint(
      new Vector3(x + radius, y + COMPONENT_SPECS[component.type].top, z + radius),
    );
  }
  return box;
}

/**
 * Frames the layout. Rather than guessing a zoom constant, the rig projects
 * the layout's box into camera space, solves for the zoom that fits it and
 * centres it on screen — so the components fill the canvas at any viewport
 * size, in both the isometric and the top-down view, however tall they
 * stand. It fits on mount, on Fit, on a change of view or panel size, and
 * when a scene is loaded; never as components move.
 */
/** Screen margins the fit keeps clear for the floating HUD (see builder-hud.tsx). */
const FIT_INSET_X_PX = 24;
const FIT_INSET_Y_PX = 64;
/** the name tags stand above the parts in screen pixels, not millimetres */
const FIT_LABEL_PX = 28;

function CameraRig({
  view,
  fitToken,
  components,
  pivotRef,
}: {
  view: CameraView;
  fitToken: number;
  components: BuilderComponent[];
  pivotRef: RefObject<Vector3 | null>;
}) {
  // `get()` reaches the live camera imperatively; the size selector is here so
  // the fit re-runs when the panel is resized.
  const get = useThree((state) => state.get);
  const size = useThree((state) => state.size);
  // read at fit time, not a dependency: a drag must not reframe the view
  const latest = useRef(components);
  useLayoutEffect(() => {
    latest.current = components;
  }, [components]);

  useEffect(() => {
    const store = get();
    const cam = store.camera as OrthographicCamera;
    const controls = store.controls as ControlsLike | null;
    const distance = 1400;
    const box = layoutBox(latest.current);
    const centre = box.getCenter(new Vector3()).setY(0);

    if (view === "top") {
      cam.position.set(centre.x, distance, centre.z + 0.001);
    } else {
      cam.position.set(centre.x + distance, distance * 0.82, centre.z + distance);
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(centre);
    cam.updateMatrixWorld();

    const inverse = new Matrix4().copy(cam.matrixWorld).invert();
    const margin = 20;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const x of [box.min.x - margin, box.max.x + margin]) {
      for (const z of [box.min.z - margin, box.max.z + margin]) {
        for (const y of [box.min.y, box.max.y]) {
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
    const usableHeight = Math.max(size.height - 2 * FIT_INSET_Y_PX - FIT_LABEL_PX, 1);
    cam.zoom = Math.min(usableWidth / spanX, usableHeight / spanY) * 0.96;
    cam.updateProjectionMatrix();

    // Slide the view so the box sits mid-screen (a little low, leaving the
    // tags room above), then back along the line of sight so the orbit
    // target stays on the table.
    const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const forward = cam.getWorldDirection(new Vector3());
    const target = centre
      .clone()
      .addScaledVector(right, (minX + maxX) / 2)
      .addScaledVector(up, (minY + maxY) / 2 + FIT_LABEL_PX / 2 / cam.zoom);
    target.addScaledVector(forward, -target.y / forward.y);
    cam.position.add(target).sub(centre);
    cam.lookAt(target);
    cam.updateMatrixWorld();

    // a snap-back is not an orbit: let go of the last drag's pivot first
    pivotRef.current = null;
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [get, pivotRef, size.width, size.height, view, fitToken]);

  return null;
}

/**
 * Which presses the controls turn into an orbit (see OrbitControls'
 * `onMouseDown`): middle or right, or Shift / Ctrl / ⌘ with the left button,
 * which is otherwise a pan. A modifier on middle or right pans instead. While
 * selecting, a Ctrl / ⌘ left press never gets here: box select takes it first
 * (use-box-select.ts), so Shift is the left-button orbit. Placing a part or
 * drawing a beam, it still orbits.
 */
function isOrbitPress(event: PointerEvent): boolean {
  if (event.pointerType === "touch") return false;
  const modified = event.shiftKey || event.ctrlKey || event.metaKey;
  if (event.button === 1 || event.button === 2) return !modified;
  return event.button === 0 && modified;
}

function isShown(object: Object3D | null): boolean {
  for (let node = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

const TABLE_PLANE = new Plane(new Vector3(0, 1, 0), 0);

/**
 * Where a pointer ray meets the table top (y = 0), mm, as [x, z]; null when
 * it never does. A drag follows this plane, so its grab offset is measured
 * here too, not at the point the press hit, which on a part sits up at its
 * height and, seen at a slant, lies over a different spot on the table.
 */
export function tablePoint(ray: Ray): [number, number] | null {
  const hit = ray.intersectPlane(TABLE_PLANE, new Vector3());
  return hit ? [hit.x, hit.z] : null;
}

/**
 * While something is dragged, each pointer move over the canvas is turned into
 * the table point under it. It listens on the canvas rather than on the table
 * mesh: the part under the pointer stops its hover from propagating, so the
 * table hears no moves until the pointer has left the part it picked up.
 */
function SurfaceDrag({
  dragging,
  onSurfaceDrag,
}: {
  dragging: boolean;
  onSurfaceDrag: BuilderCanvasProps["onSurfaceDrag"];
}) {
  const gl = useThree((state) => state.gl);
  const get = useThree((state) => state.get);
  const latest = useRef(onSurfaceDrag);
  useLayoutEffect(() => {
    latest.current = onSurfaceDrag;
  }, [onSurfaceDrag]);

  useEffect(() => {
    if (!dragging) return;
    const element = gl.domElement;
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, get().camera);
      const point = tablePoint(raycaster.ray);
      if (point) latest.current(point[0], point[1], event);
    };
    element.addEventListener("pointermove", onMove);
    return () => element.removeEventListener("pointermove", onMove);
  }, [dragging, get, gl]);

  return null;
}

/**
 * CAD-style orbit: a drag turns the view about the point under the cursor
 * when it starts (a part, or else the table), not about the controls' target
 * in the middle of the screen. OrbitControls can only turn about its target,
 * and moving the target to the pivot would jump the view, so instead each
 * step's rotation is re-centred: after the controls turn the camera about the
 * target, camera and target shift together by `(q − I)(target − pivot)`,
 * which is the same turn taken about the pivot. The pivot holds for the whole
 * drag and its damped tail; a pan or a zoom has no rotation, so no shift.
 */
function OrbitPivot({
  pivotRef,
  selected,
}: {
  pivotRef: RefObject<Vector3 | null>;
  selected: Vec3 | null;
}) {
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const get = useThree((state) => state.get);
  // read at press time, not a dependency: re-binding mid-drag would drop it
  const latestSelected = useRef(selected);
  useLayoutEffect(() => {
    latestSelected.current = selected;
  }, [selected]);

  useEffect(() => {
    const element = controls?.domElement;
    if (!controls || !element) return;
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const lastQuaternion = get().camera.quaternion.clone();
    const step = new Quaternion();
    const shift = new Vector3();

    const pickPivot = (event: PointerEvent): Vector3 => {
      const { camera, scene } = get();
      const rect = element.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(scene.children, true)
        .find((entry) => isShown(entry.object));
      if (hit) return hit.point.clone();
      const onTable = raycaster.ray.intersectPlane(TABLE_PLANE, new Vector3());
      if (onTable) return onTable;
      const part = latestSelected.current;
      return part ? new Vector3(...part) : controls.target.clone();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (isOrbitPress(event)) pivotRef.current = pickPivot(event);
    };

    const onChange = () => {
      const camera = get().camera;
      const centre = pivotRef.current;
      step.copy(lastQuaternion).invert().premultiply(camera.quaternion);
      if (centre && 1 - Math.abs(step.w) > 1e-10) {
        shift
          .copy(controls.target)
          .sub(centre)
          .applyQuaternion(step)
          .add(centre)
          .sub(controls.target);
        controls.target.add(shift);
        camera.position.add(shift);
        camera.updateMatrixWorld();
      }
      lastQuaternion.copy(camera.quaternion);
    };

    // capture, so the pivot is set before the controls see the press
    element.addEventListener("pointerdown", onPointerDown, true);
    controls.addEventListener("change", onChange);
    return () => {
      element.removeEventListener("pointerdown", onPointerDown, true);
      controls.removeEventListener("change", onChange);
    };
  }, [controls, get, pivotRef]);

  return null;
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

type TableProps = {
  palette: ScenePalette;
  onSurfaceClick: (x: number, z: number) => void;
};

function TableSurface({ palette, onSurfaceClick }: TableProps) {
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

  // The table is never drawn — parts stand on the studio sweep — but it is
  // still the click target, and it catches the key light's shadow so
  // parts stay grounded. It spans the whole guard, so there is no edge to
  // find. One solid slab rather than a plane: a plane at y = 0 z-fights the
  // grid on some GPUs. The top face sits exactly at y = 0, on TABLE_PLANE,
  // which a drag follows.
  return (
    <mesh
      receiveShadow
      position={[0, -TABLE_THICKNESS_MM / 2, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <boxGeometry
        args={[TABLE_SPAN_MM, TABLE_THICKNESS_MM, TABLE_SPAN_MM]}
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

const KEY_LIGHT_OFFSET = new Vector3(420, 1000, 520);
/** the shadow camera's smallest half-width, mm: a small layout keeps crisp shadows */
const MIN_SHADOW_REACH_MM = 650;
/** past the footprints: a 300 mm part's shadow falls about 200 mm from its base */
const SHADOW_MARGIN_MM = 250;

/**
 * One high key light casts the only real shadows — short and crisp, like a
 * ceiling fixture. A rim from behind the view lifts white parts off the
 * backdrop. The key light's shadow camera follows the layout, live while a
 * part is dragged: sharp on a small layout, softer on a sprawling one.
 */
function Lights({
  palette,
  components,
}: {
  palette: ScenePalette;
  components: BuilderComponent[];
}) {
  const invalidate = useThree((state) => state.invalidate);
  // mutated in place; the ref is how the effect reaches it
  const keyRef = useRef<DirectionalLight>(null);

  useLayoutEffect(() => {
    const key = keyRef.current;
    if (!key) return;
    const box = layoutBox(components);
    const centre = box.getCenter(new Vector3()).setY(0);
    const size = box.getSize(new Vector3());
    const reach = Math.max(
      MIN_SHADOW_REACH_MM,
      Math.hypot(size.x, size.z) / 2 + SHADOW_MARGIN_MM,
    );

    key.position.copy(centre).add(KEY_LIGHT_OFFSET);
    key.target.position.copy(centre);
    key.target.updateMatrixWorld();
    const camera = key.shadow.camera;
    camera.left = -reach;
    camera.right = reach;
    camera.top = reach;
    camera.bottom = -reach;
    // the tilted frustum sees ground up to `reach` nearer or further than the target
    camera.near = -reach;
    camera.far = KEY_LIGHT_OFFSET.length() + reach + 500;
    camera.updateProjectionMatrix();
    invalidate();
  }, [components, invalidate]);

  return (
    <>
      <ambientLight intensity={palette.ambient} />
      <directionalLight
        ref={keyRef}
        castShadow
        intensity={palette.keyLight}
        shadow-mapSize={[2048, 2048]}
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
 * The halo is a wider translucent tube around the core. It is densest where
 * its surface faces the camera and fades to nothing at the silhouette, so it
 * reads as a round glow with depth rather than a flat band of one colour.
 */
const HALO_VERTEX = /* glsl */ `
  varying float vFacing;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewNormal = normalize(normalMatrix * normal);
    vec3 toCamera = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-mvPosition.xyz);
    vFacing = abs(dot(viewNormal, toCamera));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  varying float vFacing;
  void main() {
    gl_FragColor = vec4(color, opacity * vFacing * vFacing);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** One per halo mesh; every copy shares the same compiled shader program. */
function HaloMaterial({ color, opacity }: { color: string; opacity: number }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { color: { value: new Color() }, opacity: { value: 1 } },
        vertexShader: HALO_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  const tint = useMemo(() => new Color(color), [color]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <primitive
      object={material}
      attach="material"
      uniforms-color-value={tint}
      uniforms-opacity-value={opacity}
    />
  );
}

/**
 * The halo's width (× the beam's) and opacity (× its alpha). Under a core it
 * is a faint glow; alone it has to carry the beam, so it is stronger.
 */
const HALO = {
  underCore: { width: 3, opacity: 0.35 },
  underCoreSelected: { width: 4, opacity: 0.55 },
  alone: { width: 2.6, opacity: 0.8 },
  aloneSelected: { width: 3.6, opacity: 1 },
};

/** A selected hidden beam's glow, × the halo's own opacity: enough to see where it runs, far short of a shown beam. */
const GHOST_OPACITY = 0.5;

/**
 * A beam, drawn in millimetres on the table: its width scales with the zoom
 * like the parts do. The core is a lit tube, one per leg with a ball at each
 * turn, so it reads as a round beam passing through the parts rather than a
 * flat stroke. A selected beam draws fully opaque with a stronger halo, so
 * even a faint one can be found by clicking its row.
 */
function BeamPath({
  points,
  color,
  width = BEAM_WIDTH_MM,
  opacity = 1,
  selected = false,
  core: coreWanted = true,
  ghost = false,
}: {
  points: Vector3[];
  color: string;
  width?: number;
  opacity?: number;
  selected?: boolean;
  /** off leaves only the halo: no tube core and no arrows */
  core?: boolean;
  /** a hidden beam that is selected: only a faint glow, so it can be found and edited */
  ghost?: boolean;
}) {
  const core = coreWanted && !ghost;
  const alpha = ghost ? GHOST_OPACITY : selected ? 1 : opacity;
  const halo = core
    ? selected
      ? HALO.underCoreSelected
      : HALO.underCore
    : selected
      ? HALO.aloneSelected
      : HALO.alone;
  const radius = width / 2;
  const haloRadius = radius * halo.width;
  const haloMaterial = <HaloMaterial color={color} opacity={halo.opacity * alpha} />;
  const arrowRadius = Math.max(3.5, width * 1.9);
  const legs = useMemo(() => {
    const result: {
      position: [number, number, number];
      quaternion: Quaternion;
      length: number;
    }[] = [];
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const direction = new Vector3().subVectors(to, from);
      const length = direction.length();
      if (length < 1e-6) continue;
      const mid = new Vector3().addVectors(from, to).multiplyScalar(0.5);
      const quaternion = new Quaternion().setFromUnitVectors(
        UP,
        direction.normalize(),
      );
      result.push({ position: [mid.x, mid.y, mid.z], quaternion, length });
    }
    return result;
  }, [points]);
  const arrows = legs.filter((leg) => leg.length >= 40);
  const turns = points.slice(1, -1);


  // keyed so a fade rebuilds the material: three.js ignores a flip of `transparent`
  const coreMaterial = (
    <meshStandardMaterial
      key={alpha < 1 ? "faded" : "solid"}
      color={color}
      emissive={color}
      emissiveIntensity={0.18}
      roughness={0.15}
      metalness={0}
      transparent={alpha < 1}
      opacity={alpha}
    />
  );

  return (
    <group>
      {/* soft halo around a round core — a beam should glow, not just be a stroke */}
      {legs.map((leg, index) => (
        <mesh
          key={`halo-${index}`}
          position={leg.position}
          quaternion={leg.quaternion}
        >
          <cylinderGeometry args={[haloRadius, haloRadius, leg.length, 20, 1, true]} />
          {haloMaterial}
        </mesh>
      ))}
      {turns.map((point, index) => (
        <mesh key={`halo-turn-${index}`} position={point}>
          <sphereGeometry args={[haloRadius, 20, 14]} />
          {haloMaterial}
        </mesh>
      ))}
      {core
        ? legs.map((leg, index) => (
            <mesh
              key={`leg-${index}`}
              position={leg.position}
              quaternion={leg.quaternion}
            >
              <cylinderGeometry args={[radius, radius, leg.length, 16, 1, true]} />
              {coreMaterial}
            </mesh>
          ))
        : null}
      {core
        ? turns.map((point, index) => (
            <mesh key={`turn-${index}`} position={point}>
              <sphereGeometry args={[radius, 16, 12]} />
              {coreMaterial}
            </mesh>
          ))
        : null}
      {(core ? arrows : []).map((arrow, index) => (
        <mesh
          key={`arrow-${index}`}
          position={arrow.position}
          quaternion={arrow.quaternion}
          renderOrder={2}
        >
          <coneGeometry args={[arrowRadius, arrowRadius * 2.7, 14]} />
          {coreMaterial}
        </mesh>
      ))}
    </group>
  );
}

function beamVectors(components: BuilderComponent[], path: string[]): Vector3[] {
  return beamPoints(components, path).map((point) => new Vector3(...point));
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export type BuilderCanvasProps = {
  components: BuilderComponent[];
  beams: Beam[];
  connections: Connection[];
  frames: Frame[];
  palette: ScenePalette;
  /** the selected parts; the last is the one the orbit falls back to */
  selection: string[];
  selectedBeamId: string | null;
  /** the one hidden beam drawn as a faint ghost, if any; every other hidden beam is not drawn */
  ghostBeamId: string | null;
  selectedConnectionId: string | null;
  selectedFrameId: string | null;
  /** the one hidden frame drawn as a faint ghost, if any; every other hidden frame is not drawn */
  ghostFrameId: string | null;
  /** the edges of frames take presses: off while placing a part or drawing a beam or connection */
  framesInteractive: boolean;
  hoveredId: string | null;
  beamDraft: string[];
  showLabels: boolean;
  showGrid: boolean;
  /** draw posts; off, the parts float at their heights over their shadows */
  showPosts: boolean;
  view: CameraView;
  fitToken: number;
  dragging: boolean;
  /** the beam line a dragged part is locked onto, drawn faintly while it is */
  snapGuide: [Vec3, Vec3] | null;
  onSurfaceClick: (x: number, z: number) => void;
  /** the table point under the pointer, mm, on each move while dragging */
  onSurfaceDrag: (x: number, z: number, event: PointerEvent) => void;
  onComponentPointerDown: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onComponentHover: (id: string | null) => void;
  onConnectionPointerDown: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onFramePointerDown: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onCanvasReady: (handle: CanvasApi) => void;
};

export type CanvasApi = {
  canvas: HTMLCanvasElement;
  /** where a point in the scene, mm, is on screen now, in client pixels */
  project: (point: Vec3) => [number, number];
};

function CanvasHandle({ onReady }: { onReady: (handle: CanvasApi) => void }) {
  const gl = useThree((state) => state.gl);
  const get = useThree((state) => state.get);
  useEffect(() => {
    const scratch = new Vector3();
    onReady({
      canvas: gl.domElement,
      project: (point) => {
        const rect = gl.domElement.getBoundingClientRect();
        scratch.set(...point).project(get().camera);
        return [
          rect.left + ((scratch.x + 1) / 2) * rect.width,
          rect.top + ((1 - scratch.y) / 2) * rect.height,
        ];
      },
    });
  }, [get, gl, onReady]);
  return null;
}

export default function BuilderCanvas({
  components,
  beams,
  connections,
  frames,
  palette,
  selection,
  selectedBeamId,
  ghostBeamId,
  selectedConnectionId,
  selectedFrameId,
  ghostFrameId,
  framesInteractive,
  hoveredId,
  beamDraft,
  showLabels,
  showGrid,
  showPosts,
  view,
  fitToken,
  dragging,
  snapGuide,
  onSurfaceClick,
  onSurfaceDrag,
  onComponentPointerDown,
  onComponentHover,
  onConnectionPointerDown,
  onFramePointerDown,
  onCanvasReady,
}: BuilderCanvasProps) {
  // the orbit pivot: set when an orbit drag starts, cleared by a snap-back
  const pivotRef = useRef<Vector3 | null>(null);
  const selected = useMemo(() => new Set(selection), [selection]);
  const primary = selection.at(-1);
  const selectedPosition = useMemo(
    () => (primary ? (componentById(components, primary)?.position ?? null) : null),
    [components, primary],
  );
  const draftOrder = useMemo(() => {
    const map = new Map<string, number>();
    beamDraft.forEach((id, index) => map.set(id, index + 1));
    return map;
  }, [beamDraft]);
  const fiberEnds = useMemo(
    () =>
      new Set(
        connections
          .filter((connection) => CONNECTION_KINDS[connection.kind].usesFiberStub)
          .flatMap((connection) => [connection.from, connection.to]),
      ),
    [connections],
  );
  return (
    <Canvas
      orthographic
      // PCF: three r18x dropped PCFSoftShadowMap (R3F's "soft"); PCF is now the soft one.
      shadows="percentage"
      frameloop="demand"
      // deep enough for a layout reaching the guard, in any view
      camera={{ position: [1400, 1150, 1400], near: -16000, far: 20000, zoom: 1 }}
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
      <Lights palette={palette} components={components} />
      <RingRoom dark={palette.mode === "dark"} />
      <Backdrop stops={palette.backdrop} />

      <TableSurface palette={palette} onSurfaceClick={onSurfaceClick} />
      <SurfaceDrag dragging={dragging} onSurfaceDrag={onSurfaceDrag} />

      {/* with no table drawn, the grid is the one sign of the breadboard: it
          shows while the toolbar's grid toggle is on, follows the view, and
          fades out away from it */}
      {showGrid ? (
        <Grid
          cellSize={GRID_CELL_MM}
          cellThickness={0.8}
          cellColor={palette.gridCell}
          sectionSize={GRID_SECTION_MM}
          sectionThickness={1}
          sectionColor={palette.gridSection}
          fadeDistance={GRID_FADE_MM}
          fadeStrength={1}
          infiniteGrid
          followCamera
          position={[0, 0.4, 0]}
        />
      ) : null}

      {frames.map((frame) => {
        const ghost = Boolean(frame.hidden) && frame.id === ghostFrameId;
        if (frame.hidden && !ghost) return null;
        return (
          <FrameMesh
            key={frame.id}
            frame={frame}
            selected={frame.id === selectedFrameId}
            ghost={ghost}
            showLabel={showLabels}
            interactive={framesInteractive}
            onPointerDown={(event) => {
              event.stopPropagation();
              onFramePointerDown(frame.id, event);
            }}
          />
        );
      })}

      {components.map((component) => (
        <ComponentMesh
          key={component.id}
          component={component}
          palette={palette}
          selected={selected.has(component.id)}
          hovered={component.id === hoveredId}
          showLabel={showLabels}
          showPosts={showPosts}
          beamOrder={draftOrder.get(component.id)}
          fiberConnected={fiberEnds.has(component.id)}
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
        const ghost = beam.hidden && beam.id === ghostBeamId;
        if (beam.hidden && !ghost) return null;
        const points = beamVectors(components, beam.path);
        if (points.length < 2) return null;
        return (
          <BeamPath
            key={beam.id}
            points={points}
            color={beam.color}
            width={beam.width}
            opacity={beam.opacity}
            selected={beam.id === selectedBeamId}
            core={beam.arrows !== false}
            ghost={ghost}
          />
        );
      })}

      {beamDraft.length >= 2 ? (
        <BeamPath
          points={beamVectors(components, beamDraft)}
          color={palette.accent}
        />
      ) : null}

      {snapGuide ? (
        // Laid on the table under the beam, not along it, where the beam's own
        // tube would hide it, and drawn over the posts so it reads from above.
        <Line
          points={snapGuide.map(([x, , z]): Vec3 => [x, SNAP_GUIDE_Y_MM, z])}
          color={palette.accent}
          lineWidth={1.5}
          transparent
          opacity={0.85}
          dashed
          dashSize={10}
          gapSize={6}
          depthTest={false}
          renderOrder={3}
        />
      ) : null}

      {connections.map((connection) => (
        <ConnectionPath
          key={connection.id}
          connection={connection}
          components={components}
          selected={connection.id === selectedConnectionId}
          showLabel={showLabels}
          onPointerDown={(event) => onConnectionPointerDown(connection.id, event)}
        />
      ))}

      <OrbitControls
        makeDefault
        enabled={!dragging}
        enableRotate
        // a turntable: it orbits all the way round, but never under the table
        maxPolarAngle={Math.PI / 2 - 0.05}
        enableZoom
        // the wheel zooms toward the point under the cursor
        zoomToCursor
        enablePan
        zoomSpeed={0.9}
        minZoom={0.2}
        maxZoom={14}
        // left pans; Shift + left orbits (the controls' own modifier swap),
        // which is the one orbit a Magic Mouse can make. Middle and right orbit.
        mouseButtons={{
          LEFT: MOUSE.PAN,
          MIDDLE: MOUSE.ROTATE,
          RIGHT: MOUSE.ROTATE,
        }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      />
      <OrbitPivot pivotRef={pivotRef} selected={selectedPosition} />
      <CameraRig
        view={view}
        fitToken={fitToken}
        components={components}
        pivotRef={pivotRef}
      />

      {/* the miniature finish: contact occlusion grounds every part, the
          vignette pulls the eye to the middle of the layout */}
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
