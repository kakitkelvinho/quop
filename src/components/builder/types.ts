// Data model for the Experiment Builder. See BUILDER.md at the repo root.
//
// Conventions (carried over from the original builder, kept deliberately):
//   * Real-world millimetre scale. The table plane is XZ, +Y is height.
//   * Beams are author-drawn paths through component centres, NOT a physical
//     ray trace. The builder is a layout notebook, not a simulator — a drawn
//     beam records the author's intent, which is what a lab diagram needs.
//   * Yaw snaps to ROTATION_STEP_DEG so mirrors land on sane bench angles.

export type ComponentType =
  | "laser-source"
  | "fiber-collimator"
  | "mirror-mount"
  | "beam-splitter"
  | "lens"
  | "waveplate"
  | "filter"
  | "iris"
  | "sample"
  | "paul-trap"
  | "cavity"
  | "particle"
  | "photodiode"
  | "camera"
  | "spectrometer";

export type LensShape = "plano-convex" | "biconvex";

/** Components a particle can be placed in — its host. */
export const HOST_TYPES: ReadonlySet<ComponentType> = new Set(["paul-trap", "cavity"]);

export type Vec3 = [number, number, number];

export type BuilderComponent = {
  id: string;
  type: ComponentType;
  /** millimetres; table plane is XZ, Y is the component's height (its optical centre above the breadboard) */
  position: Vec3;
  /** degrees, yaw around the vertical axis */
  rotation: number;
  /** hex colour — body tint; on a mirror mount it marks which beam line it serves */
  color?: string;
  /** sample only, 0.1–1; missing means SAMPLE_OPACITY */
  opacity?: number;
  label?: string;
  /** lens only */
  lensShape?: LensShape;
  /** lens only, mm — drives the drawn curvature */
  focalLength?: number;
  /** cavity only, mm between the two mirrors */
  cavityLength?: number;
  /** particle only: the trap or cavity it sits in; it sits at the host's centre */
  host?: string;
};

export type Beam = {
  id: string;
  /** ordered component ids the beam visits, source to end */
  path: string[];
  color: string;
  label?: string;
  /** drawn diameter, mm; missing means BEAM_WIDTH_MM */
  width?: number;
  /** 0.1–1; missing means fully opaque */
  opacity?: number;
  /** false hides the direction arrows; missing means shown */
  arrows?: boolean;
};

export const SCENE_VERSION = 2 as const;

export type BuilderSceneData = {
  version: typeof SCENE_VERSION;
  components: BuilderComponent[];
  beams: Beam[];
};

// ---------------------------------------------------------------------------
// Component library
// ---------------------------------------------------------------------------

export type ComponentSpec = {
  label: string;
  /** short name drawn as the in-scene tag */
  tag: string;
  /** how far the part reaches above its optical centre, mm — where its label sits */
  top: number;
  /** lowest height, mm: where its post runs out, or where a floating part meets the table */
  minHeight: number;
  /** set when the instrument fixes its own height and it cannot be raised */
  fixedHeight?: number;
  /** radius of the selection ring, mm */
  radius: number;
  /** one line of plain-language help for a visitor who has never met a bench */
  hint: string;
};

export const COMPONENT_SPECS: Record<ComponentType, ComponentSpec> = {
  "laser-source": {
    label: "Laser source",
    tag: "Laser",
    top: 20,
    minHeight: 20,
    radius: 60,
    hint: "Where a beam starts. Points along its own +x axis.",
  },
  "fiber-collimator": {
    label: "Fiber collimator",
    tag: "Fiber",
    top: 20,
    minHeight: 20,
    radius: 30,
    hint: "Where light enters or leaves a fiber: a beam can start or end here.",
  },
  "mirror-mount": {
    label: "Mirror + mount",
    tag: "Mirror",
    top: 25,
    minHeight: 27,
    radius: 34,
    hint: "Steers the beam. Colour the mount to mark which beam line it serves.",
  },
  "beam-splitter": {
    label: "Beam splitter",
    tag: "BS",
    top: 13,
    minHeight: 25,
    radius: 30,
    hint: "Splits one beam into two arms. Note in the label if it splits by polarisation.",
  },
  lens: {
    label: "Lens",
    tag: "Lens",
    top: 20,
    minHeight: 17,
    radius: 26,
    hint: "Focuses or collimates. Set its shape and focal length below.",
  },
  waveplate: {
    label: "Waveplate",
    tag: "λ/2",
    top: 30,
    minHeight: 36,
    radius: 26,
    hint: "Rotates polarisation — λ/2 for angle, λ/4 for circular.",
  },
  filter: {
    label: "Filter",
    tag: "Filter",
    top: 19,
    minHeight: 25,
    radius: 24,
    hint: "Blocks part of the spectrum, e.g. rejecting the pump before a detector.",
  },
  iris: {
    label: "Iris",
    tag: "Iris",
    top: 20,
    minHeight: 27,
    radius: 24,
    hint: "Clips the beam — an alignment reference and a stray-light cut.",
  },
  sample: {
    label: "Sample",
    tag: "Sample",
    top: 18,
    minHeight: 13,
    radius: 24,
    hint: "The thing under study, here a thin film on a slab. Drawn larger than life.",
  },
  "paul-trap": {
    label: "Paul trap",
    tag: "Trap",
    top: 31,
    minHeight: 28,
    radius: 26,
    hint: "Holds a charged particle in oscillating fields: four rods along the trap axis, ring endcaps.",
  },
  cavity: {
    label: "Cavity",
    tag: "Cavity",
    top: 20,
    minHeight: 16,
    radius: 30,
    hint: "Two facing mirrors with light standing between them. The glow is its mode, not a beam.",
  },
  particle: {
    label: "Particle",
    tag: "Particle",
    top: 10,
    minHeight: 5,
    radius: 10,
    hint: "Drop it on a Paul trap or cavity to place it inside; it then moves with it.",
  },
  photodiode: {
    label: "Photodiode",
    tag: "PD",
    top: 13,
    minHeight: 20,
    radius: 22,
    hint: "Reads total power. Good for a reference arm.",
  },
  camera: {
    label: "Camera",
    tag: "Camera",
    top: 25,
    minHeight: 31,
    radius: 30,
    hint: "Images the beam or the sample plane — the source of FITS frames.",
  },
  spectrometer: {
    label: "Spectrometer",
    tag: "Spec",
    top: 22,
    minHeight: 100,
    fixedHeight: 100,
    radius: 70,
    hint: "Disperses the light and records a spectrum.",
  },
};

export type ComponentGroup = { name: string; types: ComponentType[] };

/** Palette grouping — reads as a bench walk-through: make it, steer it, shape it, read it. */
export const COMPONENT_GROUPS: ComponentGroup[] = [
  { name: "Source", types: ["laser-source", "fiber-collimator"] },
  { name: "Steering", types: ["mirror-mount", "beam-splitter"] },
  { name: "Shaping", types: ["lens", "waveplate", "filter", "iris"] },
  { name: "Target", types: ["sample", "paul-trap", "cavity", "particle"] },
  { name: "Detection", types: ["photodiode", "camera", "spectrometer"] },
];

export const COMPONENT_LIBRARY = (
  Object.keys(COMPONENT_SPECS) as ComponentType[]
).map((type) => ({ type, label: COMPONENT_SPECS[type].label }));

// ---------------------------------------------------------------------------
// Table geometry
// ---------------------------------------------------------------------------

export const GRID_SIZE_MM = 25;
export const FINE_GRID_MM = 5;
/**
 * The table has no edge. This guard, mm either side of the origin in X and Z,
 * only stops a runaway drag or a hand-edited file flinging a component off to
 * infinity; no real layout comes near it.
 */
export const TABLE_GUARD_MM = 5000;
export const ROTATION_STEP_DEG = 15;
/**
 * The beam height, mm: the height a component gets when it is placed. The
 * lab's posts are cut so a mount's centre sits at 100 mm. A convention for
 * straight beams, not a constraint: any component can be raised or lowered.
 */
export const BEAM_HEIGHT_MM = 100;
export const MAX_HEIGHT_MM = 300;
export const DEFAULT_MOUNT_COLOR = "#8b1e3f";
export const DEFAULT_SAMPLE_COLOR = "#f2c94c";
export const SAMPLE_OPACITY = 0.8;
export const SAMPLE_OPACITY_RANGE: [number, number] = [0.1, 1];

/** A beam's drawn width, mm, and its range — wide enough to tell overlapping beams apart. */
export const BEAM_WIDTH_MM = 2;
export const BEAM_WIDTH_RANGE_MM: [number, number] = [0.5, 10];
export const BEAM_OPACITY_RANGE: [number, number] = [0.1, 1];

export const DEFAULT_FOCAL_LENGTH_MM = 100;
export const FOCAL_LENGTH_RANGE_MM: [number, number] = [10, 2000];
export const DEFAULT_CAVITY_LENGTH_MM = 50;
export const CAVITY_LENGTH_RANGE_MM: [number, number] = [10, 300];
/** A particle dropped within this distance of a host's centre snaps into it, mm. */
export const HOST_CAPTURE_MM = 20;

export function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, value));
}

/** The heights a component can take, mm. */
export function heightRange(type: ComponentType): [number, number] {
  const spec = COMPONENT_SPECS[type];
  if (spec.fixedHeight !== undefined) return [spec.fixedHeight, spec.fixedHeight];
  return [spec.minHeight, MAX_HEIGHT_MM];
}

export function clampHeight(type: ComponentType, height: number): number {
  return clamp(height, heightRange(type));
}

export function defaultHeight(type: ComponentType): number {
  return clampHeight(type, BEAM_HEIGHT_MM);
}

/** mm per nanosecond in vacuum — beam path length doubles as an optical delay. */
export const C_MM_PER_NS = 299.792458;

export const BEAM_COLORS = [
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#16a34a",
  "#ea580c",
  "#db2777",
] as const;

export function snapToGrid(value: number, step = GRID_SIZE_MM): number {
  return Math.round(value / step) * step;
}

export function clampToTable(x: number, z: number): [number, number] {
  const guard: [number, number] = [-TABLE_GUARD_MM, TABLE_GUARD_MM];
  return [clamp(x, guard), clamp(z, guard)];
}

export function createComponentId(type: ComponentType): string {
  return `${type}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBeamId(): string {
  return `beam-${Math.random().toString(36).slice(2, 8)}`;
}

export function componentById(
  components: BuilderComponent[],
  id: string,
): BuilderComponent | undefined {
  return components.find((component) => component.id === id);
}

/** Straight-line 3D length through the beam's waypoints (optical centres), in mm. */
export function beamLengthMm(components: BuilderComponent[], beam: Beam): number {
  const points = beam.path
    .map((id) => componentById(components, id))
    .filter((component): component is BuilderComponent => Boolean(component));

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay, az] = points[index - 1].position;
    const [bx, by, bz] = points[index].position;
    total += Math.hypot(bx - ax, by - ay, bz - az);
  }
  return total;
}

/** Vacuum time-of-flight along a path length, in picoseconds. */
export function lengthToPicoseconds(lengthMm: number): number {
  return (lengthMm / C_MM_PER_NS) * 1000;
}

/** The in-scene tag when there is no label. A lens carries its focal length. */
export function componentTag(component: BuilderComponent): string {
  if (component.type === "lens") {
    return `f ${Math.round(component.focalLength ?? DEFAULT_FOCAL_LENGTH_MM)}`;
  }
  return COMPONENT_SPECS[component.type].tag;
}

export function componentDisplayName(component: BuilderComponent): string {
  return component.label?.trim() || componentTag(component);
}

export function beamDisplayName(beam: Beam): string {
  return beam.label?.trim() || `${beam.path.length}-stop beam`;
}

/** Selection-ring radius: a cavity grows with its length. */
export function componentRadius(component: BuilderComponent): number {
  if (component.type === "cavity") {
    return Math.max(COMPONENT_SPECS.cavity.radius, (component.cavityLength ?? DEFAULT_CAVITY_LENGTH_MM) / 2 + 12);
  }
  return COMPONENT_SPECS[component.type].radius;
}

/** The nearest trap or cavity whose centre is within capture range of (x, z). */
export function findHost(
  components: BuilderComponent[],
  x: number,
  z: number,
): BuilderComponent | undefined {
  let best: BuilderComponent | undefined;
  let bestDistance = HOST_CAPTURE_MM;
  for (const component of components) {
    if (!HOST_TYPES.has(component.type)) continue;
    const distance = Math.hypot(component.position[0] - x, component.position[2] - z);
    if (distance <= bestDistance) {
      best = component;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Keep every hosted particle at its host's centre, and let go of hosts that no
 * longer exist. Run after every edit, so moving a trap carries its particle
 * and deleting it leaves the particle floating where it was.
 */
export function settleHosts(scene: BuilderSceneData): BuilderSceneData {
  let changed = false;
  const components = scene.components.map((component) => {
    if (!component.host) return component;
    const host = componentById(scene.components, component.host);
    if (!host || !HOST_TYPES.has(host.type)) {
      changed = true;
      return { ...component, host: undefined };
    }
    const [x, y, z] = component.position;
    if (x === host.position[0] && y === host.position[1] && z === host.position[2]) {
      return component;
    }
    changed = true;
    return { ...component, position: [...host.position] as Vec3 };
  });
  return changed ? { ...scene, components } : scene;
}

// ---------------------------------------------------------------------------
// Beam path edits
// ---------------------------------------------------------------------------
//
// Each returns the new path, or null when the edit isn't allowed: a beam
// keeps at least 2 stops, and a part may appear more than once but never
// twice in a row, the same rule as drawing.

function repeatsInARow(path: string[]): boolean {
  return path.some((id, index) => index > 0 && path[index - 1] === id);
}

export function removeStop(path: string[], index: number): string[] | null {
  const next = path.filter((_, at) => at !== index);
  return next.length < 2 || repeatsInARow(next) ? null : next;
}

/** Swap a stop with its neighbour: -1 moves it toward the start. */
export function moveStop(path: string[], index: number, direction: 1 | -1): string[] | null {
  const other = index + direction;
  if (other < 0 || other >= path.length) return null;
  const next = [...path];
  [next[index], next[other]] = [next[other], next[index]];
  return repeatsInARow(next) ? null : next;
}

export function insertStop(path: string[], index: number, id: string): string[] | null {
  const next = [...path.slice(0, index), id, ...path.slice(index)];
  return repeatsInARow(next) ? null : next;
}

/**
 * Where a part at (x, z) joins a beam: between the two consecutive stops
 * whose segment passes nearest it, measured in the table plane. A part past
 * either end, whose nearest point is that end stop, is prepended (0) or
 * appended (path.length) instead.
 */
export function insertionIndex(
  components: BuilderComponent[],
  path: string[],
  x: number,
  z: number,
): number {
  let best = path.length;
  let bestDistance = Infinity;
  for (let index = 1; index < path.length; index += 1) {
    const a = componentById(components, path[index - 1]);
    const b = componentById(components, path[index]);
    if (!a || !b) continue;
    const [ax, , az] = a.position;
    const dx = b.position[0] - ax;
    const dz = b.position[2] - az;
    const lengthSq = dx * dx + dz * dz;
    const t = lengthSq === 0 ? 0 : ((x - ax) * dx + (z - az) * dz) / lengthSq;
    const clamped = Math.min(1, Math.max(0, t));
    const distance = Math.hypot(ax + clamped * dx - x, az + clamped * dz - z);
    if (distance >= bestDistance) continue;
    bestDistance = distance;
    if (index === 1 && t < 0) best = 0;
    else if (index === path.length - 1 && t > 1) best = path.length;
    else best = index;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Mirror angles
// ---------------------------------------------------------------------------

/**
 * Where a mirror's angle comes from: its first interior stop (not a beam's
 * first or last) in the first beam, in scene order, that has one.
 */
function mirrorAngleStop(
  beams: Beam[],
  component: BuilderComponent,
): { beam: Beam; index: number } | undefined {
  if (component.type !== "mirror-mount") return undefined;
  for (const beam of beams) {
    const index = beam.path.indexOf(component.id, 1);
    if (index > 0 && index < beam.path.length - 1) return { beam, index };
  }
  return undefined;
}

/**
 * The beam that sets a mirror's angle, or undefined when the mirror is
 * turned by hand: on no beam, or only at a beam's ends. Beam splitters are
 * never derived (they transmit and reflect, so need a different rule).
 */
export function mirrorAngleBeam(
  beams: Beam[],
  component: BuilderComponent,
): Beam | undefined {
  return mirrorAngleStop(beams, component)?.beam;
}

function unitXZ(from: Vec3, to: Vec3): [number, number] | undefined {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  return length < 1e-9 ? undefined : [dx / length, dz / length];
}

/**
 * The yaw, degrees in [0, 360), that turns a mirror's face to bisect the
 * directions to the stops before and after it, so the beam reflects off it.
 * Heights don't affect the yaw. The face points along the model's local +x,
 * which a yaw θ maps to world (cos θ, 0, −sin θ), so θ = atan2(−n.z, n.x).
 * Undefined when the two directions are (anti)parallel or a neighbour sits
 * on the mirror: there is no one answer, so the last angle stays.
 */
export function bisectingYaw(mirror: Vec3, previous: Vec3, next: Vec3): number | undefined {
  const into = unitXZ(mirror, previous);
  const out = unitXZ(mirror, next);
  if (!into || !out) return undefined;
  const nx = into[0] + out[0];
  const nz = into[1] + out[1];
  if (Math.hypot(nx, nz) < 1e-9) return undefined;
  const degrees = (((Math.atan2(-nz, nx) * 180) / Math.PI) + 360) % 360;
  // rounded, so a float wobble never reads as an edit
  return (Math.round(degrees * 100) / 100) % 360;
}

/**
 * Turn every mirror in the middle of a beam to its bisecting yaw. Run after
 * every edit, like settleHosts, so the stored rotation is always the drawn
 * one and moving a mirror or either neighbour re-angles it.
 */
export function settleMirrors(scene: BuilderSceneData): BuilderSceneData {
  let changed = false;
  const components = scene.components.map((component) => {
    const stop = mirrorAngleStop(scene.beams, component);
    if (!stop) return component;
    const previous = componentById(scene.components, stop.beam.path[stop.index - 1]);
    const next = componentById(scene.components, stop.beam.path[stop.index + 1]);
    if (!previous || !next) return component;
    const yaw = bisectingYaw(component.position, previous.position, next.position);
    if (yaw === undefined || yaw === component.rotation) return component;
    changed = true;
    return { ...component, rotation: yaw };
  });
  return changed ? { ...scene, components } : scene;
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

const KNOWN_TYPES = new Set<string>(Object.keys(COMPONENT_SPECS));

/** Types from older scenes, and what they load as now. */
const LEGACY_TYPES: Record<string, ComponentType> = {
  beamsplitter: "beam-splitter",
  "pbs-cube": "beam-splitter",
};

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

/**
 * A version-1 scene predates per-component height (its Y was always 0), so
 * every component in it loads at the default height.
 */
function parseComponent(value: unknown, version: number): BuilderComponent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.type !== "string") return null;
  const type = LEGACY_TYPES[raw.type] ?? raw.type;
  if (!KNOWN_TYPES.has(type)) return null;
  if (!isVec3(raw.position)) return null;
  const [x, z] = clampToTable(raw.position[0], raw.position[2]);

  const component: BuilderComponent = {
    id: raw.id,
    type: type as ComponentType,
    position: [
      x,
      version >= 2 ? clampHeight(type as ComponentType, raw.position[1]) : defaultHeight(type as ComponentType),
      z,
    ],
    rotation: finiteNumber(raw.rotation) ?? 0,
    color: typeof raw.color === "string" ? raw.color : undefined,
    label: typeof raw.label === "string" ? raw.label : undefined,
  };
  if (type === "lens") {
    component.lensShape = raw.lensShape === "biconvex" ? "biconvex" : "plano-convex";
    const focal = finiteNumber(raw.focalLength);
    if (focal !== undefined) component.focalLength = clamp(focal, FOCAL_LENGTH_RANGE_MM);
  }
  if (type === "cavity") {
    const length = finiteNumber(raw.cavityLength);
    if (length !== undefined) component.cavityLength = clamp(length, CAVITY_LENGTH_RANGE_MM);
  }
  if (type === "sample") {
    const opacity = finiteNumber(raw.opacity);
    if (opacity !== undefined) component.opacity = clamp(opacity, SAMPLE_OPACITY_RANGE);
  }
  if (type === "particle" && typeof raw.host === "string") component.host = raw.host;
  return component;
}

function parseBeam(value: unknown, validIds: Set<string>): Beam | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return null;
  if (!Array.isArray(raw.path)) return null;

  const path = raw.path.filter(
    (entry): entry is string => typeof entry === "string" && validIds.has(entry),
  );
  if (path.length < 2) return null;

  return {
    id: raw.id,
    path,
    color: typeof raw.color === "string" ? raw.color : BEAM_COLORS[0],
    label: typeof raw.label === "string" ? raw.label : undefined,
    ...(finiteNumber(raw.width) !== undefined
      ? { width: clamp(finiteNumber(raw.width)!, BEAM_WIDTH_RANGE_MM) }
      : {}),
    ...(finiteNumber(raw.opacity) !== undefined
      ? { opacity: clamp(finiteNumber(raw.opacity)!, BEAM_OPACITY_RANGE) }
      : {}),
    ...(raw.arrows === false ? { arrows: false } : {}),
  };
}

/**
 * Accepts anything (a dropped file, a localStorage blob) and returns a scene
 * or null. Unknown component types and dangling beam references are dropped
 * rather than throwing — a partially readable setup beats an error dialog.
 */
export function parseScene(value: unknown): BuilderSceneData | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.components)) return null;

  const version = finiteNumber(raw.version) ?? 1;
  const components = raw.components
    .map((component) => parseComponent(component, version))
    .filter((component): component is BuilderComponent => component !== null);

  const ids = new Set(components.map((component) => component.id));
  const beams = Array.isArray(raw.beams)
    ? raw.beams
        .map((beam) => parseBeam(beam, ids))
        .filter((beam): beam is Beam => beam !== null)
    : [];

  return settleMirrors(settleHosts({ version: SCENE_VERSION, components, beams }));
}

export function serializeScene(scene: BuilderSceneData): string {
  return JSON.stringify({ ...scene, version: SCENE_VERSION }, null, 2);
}

export const EMPTY_SCENE: BuilderSceneData = {
  version: SCENE_VERSION,
  components: [],
  beams: [],
};

// A pump + reference-arm layout so the table isn't blank on first load. It
// demonstrates the two conventions a newcomer needs: mount colour marks the
// beam line, and a beam is a path you draw through the parts it passes.
/** Stand hand-written components at their default height. */
function atDefaultHeight(components: BuilderComponent[]): BuilderComponent[] {
  return components.map((component) => ({
    ...component,
    position: [component.position[0], defaultHeight(component.type), component.position[2]],
  }));
}

export const DEFAULT_SCENE: BuilderSceneData = {
  version: SCENE_VERSION,
  components: atDefaultHeight([
    { id: "laser-pump", type: "laser-source", position: [-350, 0, -150], rotation: 0, label: "Pump 400 nm" },
    { id: "waveplate-1", type: "waveplate", position: [-250, 0, -150], rotation: 0, label: "λ/2" },
    { id: "pbs-1", type: "beam-splitter", position: [-150, 0, -150], rotation: 0, label: "PBS" },
    { id: "lens-1", type: "lens", position: [-25, 0, -150], rotation: 0, lensShape: "plano-convex", focalLength: 100 },
    { id: "sample-1", type: "sample", position: [100, 0, -150], rotation: 0, label: "MeLPPP film" },
    { id: "filter-1", type: "filter", position: [200, 0, -150], rotation: 0, label: "Pump block" },
    { id: "spectrometer-1", type: "spectrometer", position: [325, 0, -150], rotation: 0 },
    { id: "mirror-ref", type: "mirror-mount", position: [-150, 0, 100], rotation: 45, color: "#dc2626", label: "M1" },
    { id: "pd-ref", type: "photodiode", position: [150, 0, 100], rotation: 180, label: "Reference PD" },
  ]),
  beams: [
    {
      id: "beam-pump",
      label: "Pump line",
      path: ["laser-pump", "waveplate-1", "pbs-1", "lens-1", "sample-1", "filter-1", "spectrometer-1"],
      color: "#7c3aed",
    },
    {
      id: "beam-ref",
      label: "Reference arm",
      path: ["pbs-1", "mirror-ref", "pd-ref"],
      color: "#dc2626",
    },
  ],
};
