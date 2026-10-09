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
  | "spectrometer"
  | "single-photon-detector"
  | "time-tagger"
  | "beam-block"
  | "objective"
  | "block"
  | "aom"
  | "eom";

export type LensShape = "plano-convex" | "biconvex";

/** Components a particle can be placed in — its host. */
export const HOST_TYPES: ReadonlySet<ComponentType> = new Set(["paul-trap", "cavity"]);

/**
 * Components held in a coloured mount: their `color` tints the mount, so it
 * can mark the beam line they serve. A lens stands on a bare rod, and the
 * trap and cavity have no holder, so they are left out.
 */
export const MOUNTED_TYPES: ReadonlySet<ComponentType> = new Set([
  "mirror-mount",
  "beam-splitter",
  "waveplate",
  "filter",
  "iris",
  "fiber-collimator",
]);

export type Vec3 = [number, number, number];

export type BuilderComponent = {
  id: string;
  type: ComponentType;
  /** millimetres; table plane is XZ, Y is the component's height (its optical centre above the breadboard) */
  position: Vec3;
  /** degrees, yaw around the vertical axis */
  rotation: number;
  /** hex colour — body tint; on a mirror it marks which beam line it serves */
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
  /** particle only, mm; missing means PARTICLE_RADIUS_MM */
  particleRadius?: number;
  /** block only, mm along [beam (x), height (y), across (z)]; missing means BLOCK_SIZE_MM */
  size?: Vec3;
  /**
   * laser source only, mm: light the laser adds before it leaves the aperture
   * (a folded or internal delay path); missing or 0 means none. A beam that
   * starts here counts it toward its path length.
   */
  internalPathMm?: number;
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
  /** false draws the beam as glow only: no core and no direction arrows; missing means shown */
  arrows?: boolean;
  /**
   * true keeps the beam out of the drawing, and so out of a PNG. Everything
   * else treats it as any beam: it angles mirrors and detectors, has its path
   * length, and can be selected. Stored only when true; missing means shown.
   */
  hidden?: true;
};

export type ConnectionKind = "fiber" | "cable";

/** A fibre or cable between two components. Not a beam: see CONNECTION_KINDS. */
export type Connection = {
  id: string;
  kind: ConnectionKind;
  /** component id */
  from: string;
  /** component id, never equal to `from` */
  to: string;
  color: string;
  label?: string;
  /** m; missing means unknown, and no length or delay is shown */
  lengthM?: number;
  /** fiber only; missing means DEFAULT_FIBER_INDEX */
  refractiveIndex?: number;
  /** cable only, fraction of c; missing means DEFAULT_VELOCITY_FACTOR */
  velocityFactor?: number;
};

export const SCENE_VERSION = 4 as const;

export type BuilderSceneData = {
  version: typeof SCENE_VERSION;
  components: BuilderComponent[];
  beams: Beam[];
  connections: Connection[];
};

// ---------------------------------------------------------------------------
// Component library
// ---------------------------------------------------------------------------

export type ComponentSpec = {
  label: string;
  /** short name drawn as the in-scene tag */
  tag: string;
  /** other names a visitor might search for; never shown */
  aliases?: string[];
  /** how far the part reaches above its optical centre, mm — where its label sits */
  top: number;
  /** lowest height, mm: where its post runs out, or where a floating part meets the table */
  minHeight: number;
  /** set when the instrument fixes its own height and it cannot be raised */
  fixedHeight?: number;
  /** radius of the selection ring, mm */
  radius: number;
  /**
   * Where its reference point sits along its local x axis, mm from the
   * optical centre, read off its model in component-models.tsx: the first
   * surface a ruler laid along the beam touches. Missing means the centre.
   */
  referenceX?: number;
  /** one line of plain-language help for a visitor who has never met a bench */
  hint: string;
};

/**
 * Keyed by type id. The ids are what setup files store, so they keep their old
 * names (`mirror-mount`, `beam-splitter`) even where the label has moved on.
 */
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
    label: "Mirror",
    tag: "Mirror",
    aliases: ["mirror mount"],
    top: 25,
    minHeight: 27,
    radius: 34,
    hint: "Steers the beam. Colour the mount to mark which beam line it serves.",
  },
  "beam-splitter": {
    label: "Beam cube",
    tag: "Cube",
    aliases: ["beam splitter", "BS", "PBS"],
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
    referenceX: -2.15, // the chip's face: drawn 0.2 mm thick at x = -2.05
    hint: "Reads total power. Good for a reference arm.",
  },
  camera: {
    label: "Camera",
    tag: "Camera",
    top: 25,
    minHeight: 31,
    radius: 30,
    referenceX: -23, // the C-mount ring's face: drawn 2 mm thick at x = -22
    hint: "Images the beam or the sample plane — the source of FITS frames.",
  },
  spectrometer: {
    label: "Spectrometer",
    tag: "Spec",
    top: 22,
    minHeight: 100,
    fixedHeight: 100,
    radius: 70,
    referenceX: -62, // the entrance port's outer end
    hint: "Disperses the light and records a spectrum.",
  },
  "single-photon-detector": {
    label: "Single-photon detector",
    tag: "SPCM",
    aliases: ["SPCM", "SNSPD", "APD", "single photon counter"],
    top: 17,
    minHeight: 23,
    radius: 38,
    referenceX: -30.5, // the FC receptacle's tip
    hint: "Counts single photons, each one a pulse out the back. Note SPCM or SNSPD in the label.",
  },
  "time-tagger": {
    label: "Time tagger",
    tag: "Tagger",
    aliases: ["TDC", "time-to-digital converter", "counter", "coincidence counter"],
    top: 23,
    minHeight: 27,
    fixedHeight: 27,
    radius: 131,
    hint: "Timestamps the detectors' pulses on each input, so coincidences can be counted. Sits on the table.",
  },
  "beam-block": {
    label: "Beam block",
    tag: "Dump",
    top: 15,
    minHeight: 21,
    radius: 32,
    hint: "Where a beam ends on purpose: a stack of black fins that soaks up stray or unused light.",
  },
  objective: {
    label: "Microscope objective",
    tag: "Obj",
    top: 17,
    minHeight: 24,
    radius: 32,
    referenceX: -29, // the threaded plate's outer face: drawn at x = -23, 6 mm thick
    hint: "Focuses the beam tightly, tip toward the focus. Note magnification and NA in the label.",
  },
  block: {
    label: "Generic block",
    tag: "Block",
    top: 15,
    minHeight: 15,
    radius: 26,
    hint: "A box for any part not in the list — a Faraday rotator, a vacuum window. Size, colour and label it.",
  },
  aom: {
    label: "AOM",
    tag: "AOM",
    top: 18,
    minHeight: 24,
    radius: 32,
    hint: "Acousto-optic modulator: a sound wave in a crystal diffracts and frequency-shifts the beam.",
  },
  eom: {
    label: "EOM",
    tag: "EOM",
    top: 18,
    minHeight: 24,
    radius: 40,
    hint: "Electro-optic modulator: a voltage across a crystal shifts the beam's phase or polarisation.",
  },
};

export type ComponentGroup = { name: string; types: ComponentType[] };

/** Palette grouping — reads as a bench walk-through: make it, steer it, shape it, read it. */
export const COMPONENT_GROUPS: ComponentGroup[] = [
  { name: "Source", types: ["laser-source", "fiber-collimator"] },
  { name: "Steering", types: ["mirror-mount", "beam-splitter"] },
  { name: "Shaping", types: ["lens", "objective", "waveplate", "filter", "iris"] },
  { name: "Modulation", types: ["aom", "eom"] },
  { name: "Target", types: ["sample", "paul-trap", "cavity", "particle"] },
  { name: "Detection", types: ["photodiode", "camera", "spectrometer", "single-photon-detector", "time-tagger", "beam-block"] },
  { name: "Other", types: ["block"] },
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

/** A laser's built-in path, mm: up to 100 m, far past any real folded delay. */
export const INTERNAL_PATH_RANGE_MM: [number, number] = [0, 100000];
export const DEFAULT_FOCAL_LENGTH_MM = 100;
export const FOCAL_LENGTH_RANGE_MM: [number, number] = [10, 2000];
export const DEFAULT_CAVITY_LENGTH_MM = 50;
export const CAVITY_LENGTH_RANGE_MM: [number, number] = [10, 300];
export const DEFAULT_PARTICLE_COLOR = "#ff5a36";
export const PARTICLE_RADIUS_MM = 3;
export const PARTICLE_RADIUS_RANGE_MM: [number, number] = [0.5, 15];
export const DEFAULT_BLOCK_COLOR = "#3b4a6b";
export const DEFAULT_OBJECTIVE_COLOR = "#d5d9df";
export const DEFAULT_PHOTODIODE_COLOR = "#b3261e";
export const BLOCK_SIZE_MM: Vec3 = [30, 30, 30];
export const BLOCK_SIZE_RANGE_MM: [number, number] = [2, 300];
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

export function createConnectionId(kind: ConnectionKind): string {
  return `${kind}-${Math.random().toString(36).slice(2, 8)}`;
}

export function componentById(
  components: BuilderComponent[],
  id: string,
): BuilderComponent | undefined {
  return components.find((component) => component.id === id);
}

/**
 * The built-in path of the laser a beam starts at, mm; 0 when its first stop is
 * not a laser or the laser has none. A laser later in a path adds nothing: the
 * light it passes was not made there.
 */
export function beamInternalPathMm(components: BuilderComponent[], beam: Beam): number {
  const first = beam.path.length ? componentById(components, beam.path[0]) : undefined;
  return first?.type === "laser-source" ? (first.internalPathMm ?? 0) : 0;
}

/**
 * Where a beam meets the component: its optical centre moved along its local
 * x by the type's referenceX. A yaw θ maps local +x to world (cos θ, 0, −sin θ).
 */
export function referencePoint(component: BuilderComponent): Vec3 {
  const [x, y, z] = component.position;
  const offset = COMPONENT_SPECS[component.type].referenceX ?? 0;
  const yaw = (component.rotation * Math.PI) / 180;
  return [x + offset * Math.cos(yaw), y, z - offset * Math.sin(yaw)];
}

/** The reference points a beam runs through, skipping stops whose part is gone. */
export function beamPoints(components: BuilderComponent[], path: string[]): Vec3[] {
  return path
    .map((id) => componentById(components, id))
    .filter((component): component is BuilderComponent => Boolean(component))
    .map(referencePoint);
}

/**
 * Length of the beam, mm: the straight 3D run through its reference points,
 * plus the built-in path of the laser it starts at.
 */
export function beamLengthMm(components: BuilderComponent[], beam: Beam): number {
  const points = beamPoints(components, beam.path);

  let total = beamInternalPathMm(components, beam);
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay, az] = points[index - 1];
    const [bx, by, bz] = points[index];
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
  if (component.type === "block") {
    const [dx, , dz] = component.size ?? BLOCK_SIZE_MM;
    return Math.hypot(dx, dz) / 2 + 6;
  }
  if (component.type === "particle") {
    return Math.max(COMPONENT_SPECS.particle.radius, (component.particleRadius ?? PARTICLE_RADIUS_MM) + 5);
  }
  return COMPONENT_SPECS[component.type].radius;
}

/** How far the part reaches above its optical centre, mm: where its label sits. */
export function componentTop(component: BuilderComponent): number {
  if (component.type === "block") return (component.size ?? BLOCK_SIZE_MM)[1] / 2;
  if (component.type === "particle") {
    return Math.max(COMPONENT_SPECS.particle.top, (component.particleRadius ?? PARTICLE_RADIUS_MM) + 4);
  }
  return COMPONENT_SPECS[component.type].top;
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
// Each returns the new path, or the reason the edit isn't allowed, worded to
// finish "Can't remove the lens: …". A beam keeps at least 2 stops, and a
// part may appear more than once but never twice in a row, the same rule as
// drawing.

export type PathEdit = { ok: true; path: string[] } | { ok: false; reason: string };

function repeatsInARow(path: string[]): boolean {
  return path.some((id, index) => index > 0 && path[index - 1] === id);
}

/** A clicked part joins the beam's end, in click order; a part already on it comes back as a revisit. */
export function appendStop(path: string[], id: string): PathEdit {
  if (path[path.length - 1] === id) return { ok: false, reason: "it's already the last stop" };
  return { ok: true, path: [...path, id] };
}

const TWICE_IN_A_ROW = "it would put the same part twice in a row";

export function removeStop(path: string[], index: number): PathEdit {
  if (index < 0 || index >= path.length) return { ok: false, reason: "it isn't on this beam" };
  if (path.length <= 2) return { ok: false, reason: "a beam needs 2 stops" };
  const next = path.filter((_, at) => at !== index);
  return repeatsInARow(next) ? { ok: false, reason: TWICE_IN_A_ROW } : { ok: true, path: next };
}

/** Lift the stop at `from` out and set it back so it sits at index `to` of the new path. */
export function moveStopTo(path: string[], from: number, to: number): PathEdit {
  if (from < 0 || from >= path.length) return { ok: false, reason: "it isn't on this beam" };
  if (to < 0) return { ok: false, reason: "it's already first" };
  if (to >= path.length) return { ok: false, reason: "it's already last" };
  const next = path.filter((_, at) => at !== from);
  next.splice(to, 0, path[from]);
  return repeatsInARow(next) ? { ok: false, reason: TWICE_IN_A_ROW } : { ok: true, path: next };
}

/** Swap a stop with its neighbour: -1 moves it toward the start. */
export function moveStop(path: string[], index: number, direction: 1 | -1): PathEdit {
  return moveStopTo(path, index, index + direction);
}

/**
 * A path with the given parts taken out and the gaps closed: a part left
 * twice in a row is kept once. Null when fewer than 2 stops remain.
 */
function pathWithout(path: string[], keep: (id: string) => boolean): string[] | null {
  const next = path.filter(keep).filter((id, index, kept) => index === 0 || kept[index - 1] !== id);
  return next.length >= 2 ? next : null;
}

/** Take a deleted part off every beam; a beam it leaves with one stop is gone. */
export function dropComponentFromBeams(beams: Beam[], id: string): Beam[] {
  return beams.flatMap((beam) => {
    const path = pathWithout(beam.path, (entry) => entry !== id);
    return path ? [{ ...beam, path }] : [];
  });
}

// ---------------------------------------------------------------------------
// Beam list edits
// ---------------------------------------------------------------------------
//
// A setup's beams are an ordered list, saved in that order, and the order
// means something: the first beam through a mirror sets its angle.

export type BeamListEdit = { ok: true; beams: Beam[] } | { ok: false; reason: string };

/** Swap a beam with its neighbour in the list: -1 moves it up, toward the first. */
export function moveBeam(beams: Beam[], id: string, direction: 1 | -1): BeamListEdit {
  const index = beams.findIndex((beam) => beam.id === id);
  if (index < 0) return { ok: false, reason: "it isn't in the list" };
  const other = index + direction;
  if (other < 0) return { ok: false, reason: "it's already first" };
  if (other >= beams.length) return { ok: false, reason: "it's already last" };
  const next = [...beams];
  [next[index], next[other]] = [next[other], next[index]];
  return { ok: true, beams: next };
}

/** Hide or show one beam. The flag is stored only when hidden, so showing it takes the key away. */
export function setBeamHidden(beams: Beam[], id: string, hidden: boolean): Beam[] {
  return beams.map((beam) => {
    if (beam.id !== id) return beam;
    const next = { ...beam };
    if (hidden) next.hidden = true;
    else delete next.hidden;
    return next;
  });
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

/** Detectors whose face (local −x) turns to the light arriving at them. */
const AIMED_DETECTORS = new Set<ComponentType>(["photodiode", "camera", "spectrometer", "single-photon-detector"]);

/**
 * Where a detector's angle comes from: the first beam, in scene order, that
 * ends at it. The stop before it is where its light arrives from.
 */
function detectorAngleStop(
  beams: Beam[],
  component: BuilderComponent,
): { beam: Beam; index: number } | undefined {
  if (!AIMED_DETECTORS.has(component.type)) return undefined;
  const beam = beams.find((entry) => entry.path.length >= 2 && entry.path.at(-1) === component.id);
  return beam ? { beam, index: beam.path.length - 1 } : undefined;
}

/**
 * The beam that sets a part's angle, or undefined when it is turned by hand.
 * A mirror takes its angle from a beam it sits in the middle of, and a
 * photodiode, camera, spectrometer or single-photon detector from a beam that
 * ends at it. Beam cubes are never derived (they transmit and reflect, so
 * need a different rule).
 */
export function derivedAngleBeam(
  beams: Beam[],
  component: BuilderComponent,
): Beam | undefined {
  return (mirrorAngleStop(beams, component) ?? detectorAngleStop(beams, component))?.beam;
}

/** Degrees in [0, 360), rounded so a float wobble never reads as an edit. */
function yawDegrees(radians: number): number {
  const degrees = (((radians * 180) / Math.PI) + 360) % 360;
  return (Math.round(degrees * 100) / 100) % 360;
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
  return yawDegrees(Math.atan2(-nz, nx));
}

/**
 * The yaw, degrees in [0, 360), that turns a detector's face (local −x, which
 * a yaw θ maps to world (−cos θ, 0, sin θ)) toward the stop its light comes
 * from, so θ = atan2(d.z, −d.x). Undefined when the two sit on each other.
 */
export function facingYaw(detector: Vec3, source: Vec3): number | undefined {
  const toward = unitXZ(detector, source);
  return toward ? yawDegrees(Math.atan2(toward[1], -toward[0])) : undefined;
}

/** A part's derived yaw, or undefined when it is turned by hand. */
function derivedYaw(scene: BuilderSceneData, component: BuilderComponent): number | undefined {
  const at = (stop: { beam: Beam; index: number }, offset: number) =>
    componentById(scene.components, stop.beam.path[stop.index + offset]);
  const mirror = mirrorAngleStop(scene.beams, component);
  if (mirror) {
    const previous = at(mirror, -1);
    const next = at(mirror, 1);
    return previous && next ? bisectingYaw(component.position, previous.position, next.position) : undefined;
  }
  const detector = detectorAngleStop(scene.beams, component);
  const source = detector && at(detector, -1);
  return source ? facingYaw(component.position, source.position) : undefined;
}

/**
 * Turn every mirror in the middle of a beam to its bisecting yaw, and every
 * detector that ends a beam to face the stop before it. Run after every
 * edit, like settleHosts, so the stored rotation is always the drawn one and
 * moving a part or its neighbours re-angles it.
 */
export function settleAngles(scene: BuilderSceneData): BuilderSceneData {
  let changed = false;
  const components = scene.components.map((component) => {
    const yaw = derivedYaw(scene, component);
    if (yaw === undefined || yaw === component.rotation) return component;
    changed = true;
    return { ...component, rotation: yaw };
  });
  return changed ? { ...scene, components } : scene;
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------
//
// A fibre or cable is not a beam: no path length counts it, and no mirror or
// detector takes its angle from it. Its delay comes from the length the author
// types, never from the route drawn on the table.

/** A silica fibre's group index. */
export const DEFAULT_FIBER_INDEX = 1.468;
/** Solid-polyethylene coax, such as RG-58. */
export const DEFAULT_VELOCITY_FACTOR = 0.66;
/** m: from a patch cord to a fibre delay spool */
export const CONNECTION_LENGTH_RANGE_M: [number, number] = [0, 100_000];

export type ConnectionSpec = {
  label: string;
  color: string;
  /** a label it might carry, shown as the field's placeholder */
  example: string;
  /** drawn tube radius, mm */
  radius: number;
  /** what slows the signal down: a fibre's refractive index, a cable's velocity factor */
  index: {
    key: "refractiveIndex" | "velocityFactor";
    label: string;
    fallback: number;
    range: [number, number];
    step: number;
    /** how many times longer than light in vacuum the signal takes over the same length */
    slowdown: (value: number) => number;
  };
  /** at a part that draws its own fibre stub (a collimator, a photodiode), it leaves from that stub's connector */
  usesFiberStub: boolean;
};

export const CONNECTION_KINDS: Record<ConnectionKind, ConnectionSpec> = {
  fiber: {
    label: "Fibre",
    color: "#eab308",
    example: "MMF 105 µm",
    radius: 1.6,
    index: {
      key: "refractiveIndex",
      label: "Refractive index",
      fallback: DEFAULT_FIBER_INDEX,
      range: [1, 3],
      step: 0.001,
      slowdown: (index) => index,
    },
    usesFiberStub: true,
  },
  cable: {
    label: "Cable",
    color: "#64748b",
    example: "SMA coax",
    radius: 2.4,
    index: {
      key: "velocityFactor",
      label: "Velocity factor",
      fallback: DEFAULT_VELOCITY_FACTOR,
      range: [0.1, 1],
      step: 0.01,
      slowdown: (factor) => 1 / factor,
    },
    usesFiberStub: false,
  },
};

export const CONNECTION_KIND_IDS = Object.keys(CONNECTION_KINDS) as ConnectionKind[];

/** The connection's refractive index (fibre) or velocity factor (cable). */
export function connectionIndex(connection: Connection): number {
  const { index } = CONNECTION_KINDS[connection.kind];
  return connection[index.key] ?? index.fallback;
}

/** The signal's delay along the connection, ps; undefined while its length is unknown. */
export function connectionDelayPs(connection: Connection): number | undefined {
  if (connection.lengthM === undefined) return undefined;
  const { index } = CONNECTION_KINDS[connection.kind];
  return lengthToPicoseconds(connection.lengthM * 1000) * index.slowdown(connectionIndex(connection));
}

/**
 * The edit that turns a connection into the other kind. The old kind's index
 * goes, and a colour still at the old kind's default follows the kind; one
 * picked by hand stays.
 */
export function switchConnectionKind(connection: Connection, kind: ConnectionKind): Partial<Omit<Connection, "id">> {
  if (kind === connection.kind) return {};
  return {
    kind,
    refractiveIndex: undefined,
    velocityFactor: undefined,
    ...(connection.color === CONNECTION_KINDS[connection.kind].color ? { color: CONNECTION_KINDS[kind].color } : {}),
  };
}

/** A deleted part takes its connections with it. */
export function dropComponentFromConnections(connections: Connection[], id: string): Connection[] {
  return connections.filter((connection) => connection.from !== id && connection.to !== id);
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
  if (type === "particle") {
    if (typeof raw.host === "string") component.host = raw.host;
    const radius = finiteNumber(raw.particleRadius);
    if (radius !== undefined) component.particleRadius = clamp(radius, PARTICLE_RADIUS_RANGE_MM);
  }
  if (type === "laser-source") {
    const internal = finiteNumber(raw.internalPathMm);
    if (internal !== undefined) component.internalPathMm = clamp(internal, INTERNAL_PATH_RANGE_MM);
  }
  if (type === "block" && isVec3(raw.size)) {
    component.size = raw.size.map((side) => clamp(side, BLOCK_SIZE_RANGE_MM)) as Vec3;
  }
  return component;
}

function parseBeam(value: unknown, validIds: Set<string>): Beam | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return null;
  if (!Array.isArray(raw.path)) return null;

  // a stop naming a missing part is dropped like a deleted part; only a path
  // the editor could never have saved changes, so saved setups open as they were
  const path = pathWithout(
    raw.path.filter((entry): entry is string => typeof entry === "string"),
    (entry) => validIds.has(entry),
  );
  if (!path) return null;

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
    ...(raw.hidden === true ? { hidden: true } : {}),
  };
}

const KNOWN_CONNECTION_KINDS = new Set<string>(CONNECTION_KIND_IDS);

function parseConnection(value: unknown, validIds: Set<string>): Connection | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.kind !== "string") return null;
  if (!KNOWN_CONNECTION_KINDS.has(raw.kind)) return null;
  const { from, to } = raw;
  if (typeof from !== "string" || typeof to !== "string") return null;
  if (from === to || !validIds.has(from) || !validIds.has(to)) return null;

  const kind = raw.kind as ConnectionKind;
  const spec = CONNECTION_KINDS[kind];
  const length = finiteNumber(raw.lengthM);
  // only the kind's own index is read: a cable has no refractive index
  const index = finiteNumber(raw[spec.index.key]);
  return {
    id: raw.id,
    kind,
    from,
    to,
    color: typeof raw.color === "string" ? raw.color : spec.color,
    ...(typeof raw.label === "string" ? { label: raw.label } : {}),
    ...(length !== undefined ? { lengthM: clamp(length, CONNECTION_LENGTH_RANGE_M) } : {}),
    ...(index !== undefined ? { [spec.index.key]: clamp(index, spec.index.range) } : {}),
  };
}

/**
 * Accepts anything (a dropped file, a localStorage blob) and returns a scene
 * or null. Unknown component types and dangling beam references are dropped
 * rather than throwing — a partially readable setup beats an error dialog.
 * Setups from before version 3 have no connections and open with none;
 * those from before version 4 have no hidden beams and open with every beam shown.
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
  const connections = Array.isArray(raw.connections)
    ? raw.connections
        .map((connection) => parseConnection(connection, ids))
        .filter((connection): connection is Connection => connection !== null)
    : [];

  return settleAngles(settleHosts({ version: SCENE_VERSION, components, beams, connections }));
}

export function serializeScene(scene: BuilderSceneData): string {
  return JSON.stringify({ ...scene, version: SCENE_VERSION }, null, 2);
}

export const EMPTY_SCENE: BuilderSceneData = {
  version: SCENE_VERSION,
  components: [],
  beams: [],
  connections: [],
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
    { id: "pd-ref", type: "photodiode", position: [150, 0, 100], rotation: 0, label: "Reference PD" },
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
  connections: [],
};
