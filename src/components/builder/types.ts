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
  /** millimetres; table plane is XZ, Y is height above the breadboard */
  position: Vec3;
  /** degrees, yaw around the vertical axis */
  rotation: number;
  /** hex colour — body tint; on a mirror mount it marks which beam line it serves */
  color?: string;
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
};

export const SCENE_VERSION = 1 as const;

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
  /** height of the part above the table, mm — label offsets and beam height */
  height: number;
  /** radius of the selection ring, mm */
  radius: number;
  /** one line of plain-language help for a visitor who has never met a bench */
  hint: string;
};

export const COMPONENT_SPECS: Record<ComponentType, ComponentSpec> = {
  "laser-source": {
    label: "Laser source",
    tag: "Laser",
    height: 95,
    radius: 60,
    hint: "Where a beam starts. Points along its own +x axis.",
  },
  "fiber-collimator": {
    label: "Fiber collimator",
    tag: "Fiber",
    height: 95,
    radius: 30,
    hint: "Where light enters or leaves a fiber: a beam can start or end here.",
  },
  "mirror-mount": {
    label: "Mirror + mount",
    tag: "Mirror",
    height: 100,
    radius: 34,
    hint: "Steers the beam. Colour the mount to mark which beam line it serves.",
  },
  "beam-splitter": {
    label: "Beam splitter",
    tag: "BS",
    height: 88,
    radius: 30,
    hint: "Splits one beam into two arms. Note in the label if it splits by polarisation.",
  },
  lens: {
    label: "Lens",
    tag: "Lens",
    height: 95,
    radius: 26,
    hint: "Focuses or collimates. Set its shape and focal length below.",
  },
  waveplate: {
    label: "Waveplate",
    tag: "λ/2",
    height: 97,
    radius: 26,
    hint: "Rotates polarisation — λ/2 for angle, λ/4 for circular.",
  },
  filter: {
    label: "Filter",
    tag: "Filter",
    height: 94,
    radius: 24,
    hint: "Blocks part of the spectrum, e.g. rejecting the pump before a detector.",
  },
  iris: {
    label: "Iris",
    tag: "Iris",
    height: 95,
    radius: 24,
    hint: "Clips the beam — an alignment reference and a stray-light cut.",
  },
  sample: {
    label: "Sample",
    tag: "Sample",
    height: 95,
    radius: 24,
    hint: "The thing under study, here a thin acrylic slab. Drawn larger than life.",
  },
  "paul-trap": {
    label: "Paul trap",
    tag: "Trap",
    height: 106,
    radius: 26,
    hint: "Holds a charged particle in oscillating fields: four rods along the trap axis, ring endcaps.",
  },
  cavity: {
    label: "Cavity",
    tag: "Cavity",
    height: 95,
    radius: 30,
    hint: "Two facing mirrors with light standing between them. The glow is its mode, not a beam.",
  },
  particle: {
    label: "Particle",
    tag: "Particle",
    height: 85,
    radius: 10,
    hint: "Drop it on a Paul trap or cavity to place it inside; it then moves with it.",
  },
  photodiode: {
    label: "Photodiode",
    tag: "PD",
    height: 88,
    radius: 22,
    hint: "Reads total power. Good for a reference arm.",
  },
  camera: {
    label: "Camera",
    tag: "Camera",
    height: 97,
    radius: 30,
    hint: "Images the beam or the sample plane — the source of FITS frames.",
  },
  spectrometer: {
    label: "Spectrometer",
    tag: "Spec",
    height: 97,
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
export const TABLE_WIDTH_MM = 800;
export const TABLE_DEPTH_MM = 600;
export const ROTATION_STEP_DEG = 15;
/**
 * Every optic on this bench shares one beam height above the breadboard, mm.
 * 75 mm (3") is the height a LIOP-TEC mount on a short 1/2" post actually sits
 * at — low enough to stay stiff, high enough to clear the plate corners.
 */
export const OPTICAL_AXIS_MM = 75;
export const DEFAULT_MOUNT_COLOR = "#8b1e3f";

export const DEFAULT_FOCAL_LENGTH_MM = 100;
export const FOCAL_LENGTH_RANGE_MM: [number, number] = [10, 2000];
export const DEFAULT_CAVITY_LENGTH_MM = 50;
export const CAVITY_LENGTH_RANGE_MM: [number, number] = [10, 300];
/** A particle dropped within this distance of a host's centre snaps into it, mm. */
export const HOST_CAPTURE_MM = 20;

export function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, value));
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
  const halfW = TABLE_WIDTH_MM / 2;
  const halfD = TABLE_DEPTH_MM / 2;
  return [
    Math.min(halfW, Math.max(-halfW, x)),
    Math.min(halfD, Math.max(-halfD, z)),
  ];
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

/** Straight-line length through the beam's waypoints, in mm. */
export function beamLengthMm(components: BuilderComponent[], beam: Beam): number {
  const points = beam.path
    .map((id) => componentById(components, id))
    .filter((component): component is BuilderComponent => Boolean(component));

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [ax, , az] = points[index - 1].position;
    const [bx, , bz] = points[index].position;
    total += Math.hypot(bx - ax, bz - az);
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

function parseComponent(value: unknown): BuilderComponent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.type !== "string") return null;
  const type = LEGACY_TYPES[raw.type] ?? raw.type;
  if (!KNOWN_TYPES.has(type)) return null;
  if (!isVec3(raw.position)) return null;

  const component: BuilderComponent = {
    id: raw.id,
    type: type as ComponentType,
    position: [raw.position[0], 0, raw.position[2]],
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

  const components = raw.components
    .map(parseComponent)
    .filter((component): component is BuilderComponent => component !== null);

  const ids = new Set(components.map((component) => component.id));
  const beams = Array.isArray(raw.beams)
    ? raw.beams
        .map((beam) => parseBeam(beam, ids))
        .filter((beam): beam is Beam => beam !== null)
    : [];

  return settleHosts({ version: SCENE_VERSION, components, beams });
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
export const DEFAULT_SCENE: BuilderSceneData = {
  version: SCENE_VERSION,
  components: [
    { id: "laser-pump", type: "laser-source", position: [-350, 0, -150], rotation: 0, label: "Pump 400 nm" },
    { id: "waveplate-1", type: "waveplate", position: [-250, 0, -150], rotation: 0, label: "λ/2" },
    { id: "pbs-1", type: "beam-splitter", position: [-150, 0, -150], rotation: 0, label: "PBS" },
    { id: "lens-1", type: "lens", position: [-25, 0, -150], rotation: 0, lensShape: "plano-convex", focalLength: 100 },
    { id: "sample-1", type: "sample", position: [100, 0, -150], rotation: 0, label: "MeLPPP film" },
    { id: "filter-1", type: "filter", position: [200, 0, -150], rotation: 0, label: "Pump block" },
    { id: "spectrometer-1", type: "spectrometer", position: [325, 0, -150], rotation: 0 },
    { id: "mirror-ref", type: "mirror-mount", position: [-150, 0, 100], rotation: 135, color: "#dc2626", label: "M1" },
    { id: "pd-ref", type: "photodiode", position: [150, 0, 100], rotation: 180, label: "Reference PD" },
  ],
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
