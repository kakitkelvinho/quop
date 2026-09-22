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
  | "mirror-mount"
  | "beamsplitter"
  | "pbs-cube"
  | "lens"
  | "waveplate"
  | "filter"
  | "iris"
  | "sample"
  | "photodiode"
  | "camera"
  | "spectrometer";

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
  "mirror-mount": {
    label: "Mirror + mount",
    tag: "Mirror",
    height: 100,
    radius: 34,
    hint: "Steers the beam. Colour the mount to mark which beam line it serves.",
  },
  beamsplitter: {
    label: "Beamsplitter",
    tag: "BS",
    height: 100,
    radius: 34,
    hint: "Splits one beam into two — a transmitted and a reflected arm.",
  },
  "pbs-cube": {
    label: "PBS cube",
    tag: "PBS",
    height: 88,
    radius: 30,
    hint: "Splits by polarisation: p transmits, s reflects at 90°.",
  },
  lens: {
    label: "Lens",
    tag: "Lens",
    height: 95,
    radius: 26,
    hint: "Focuses or collimates. Note the focal length in the label.",
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
    label: "Sample / cryostat",
    tag: "Sample",
    height: 122,
    radius: 34,
    hint: "The thing under study: a microcavity, a cell, a cold finger.",
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
  { name: "Source", types: ["laser-source"] },
  { name: "Steering", types: ["mirror-mount", "beamsplitter", "pbs-cube"] },
  { name: "Shaping", types: ["lens", "waveplate", "filter", "iris"] },
  { name: "Target", types: ["sample"] },
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

export function componentDisplayName(component: BuilderComponent): string {
  return component.label?.trim() || COMPONENT_SPECS[component.type].tag;
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

const KNOWN_TYPES = new Set<string>(Object.keys(COMPONENT_SPECS));

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
  if (!KNOWN_TYPES.has(raw.type)) return null;
  if (!isVec3(raw.position)) return null;

  return {
    id: raw.id,
    type: raw.type as ComponentType,
    position: [raw.position[0], 0, raw.position[2]],
    rotation: typeof raw.rotation === "number" && Number.isFinite(raw.rotation) ? raw.rotation : 0,
    color: typeof raw.color === "string" ? raw.color : undefined,
    label: typeof raw.label === "string" ? raw.label : undefined,
  };
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

  return { version: SCENE_VERSION, components, beams };
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
    { id: "pbs-1", type: "pbs-cube", position: [-150, 0, -150], rotation: 0 },
    { id: "lens-1", type: "lens", position: [-25, 0, -150], rotation: 0, label: "f = 100 mm" },
    { id: "sample-1", type: "sample", position: [100, 0, -150], rotation: 0, label: "MeLPPP cavity" },
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
