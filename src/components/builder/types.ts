// Data model for the Experiment Builder. See BUILDER.md at the repo root.
//
// Conventions (carried over from the original builder, kept deliberately):
//   * Real-world millimetre scale. The table plane is XZ, +Y is height.
//   * Beams are author-drawn paths through component centres, NOT a physical
//     ray trace. The builder is a layout notebook, not a simulator — a drawn
//     beam records the author's intent, which is what a lab diagram needs.
//   * Yaw snaps to ROTATION_STEP_DEG so mirrors land on sane bench angles.
//
// setup-brief.ts describes the setup file to an AI assistant from this file;
// a new saved field won't typecheck there until the brief has a line for it.

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
  | "eom"
  | "faraday-isolator"
  | "periscope"
  | "periscope-top"
  | "delay-line";

export type LensShape = "plano-convex" | "biconvex";

/** Components drawn with light inside them, a cavity's mode or a delay line's beam, whose colour and visibility can be set. */
export const LIT_TYPES: ReadonlySet<ComponentType> = new Set(["cavity", "delay-line"]);
/** The light inside a cavity or delay line, unless its colour is set. */
export const DEFAULT_LIGHT_COLOR = "#ff5a36";

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
  "periscope",
  "periscope-top",
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
  /**
   * sample only: true draws it floating, without its XYZ stage and post,
   * whatever the view's Posts toggle says; stored only when true, missing in
   * setups from before version 13
   */
  stageHidden?: true;
  label?: string;
  /** lens only */
  lensShape?: LensShape;
  /** lens only, mm — drives the drawn curvature */
  focalLength?: number;
  /** cavity only, mm between the two mirrors */
  cavityLength?: number;
  /** objective only, mm from the back of the thread to the nose; missing means DEFAULT_OBJECTIVE_LENGTH_MM */
  objectiveLength?: number;
  /**
   * periscope top only: the periscope (its lower mirror) whose post it shares;
   * it stands straight above or below it, at its own height
   */
  periscope?: string;
  /**
   * delay line only, mm: its minimum delay, the path a beam through it gains
   * with the stage at 0, like a laser's built-in path: it counts toward the
   * path but moves nothing drawn; missing means DELAY_MIN_PATH_MM
   */
  delayMinPathMm?: number;
  /** delay line only, mm: how far its stage can travel; missing means DELAY_TRAVEL_MM */
  delayTravelMm?: number;
  /**
   * delay line only, mm: how far the stage has travelled, held within its
   * travel; missing means 0. A beam through it gains the minimum delay and
   * twice this, out and back.
   */
  delayStageMm?: number;
  /** cavity and delay line only: the colour of the light drawn inside (a cavity's mode, a delay line's beam); missing means DEFAULT_LIGHT_COLOR */
  lightColor?: string;
  /** cavity and delay line only: true leaves the light inside out of the drawing; stored only when true */
  lightHidden?: true;
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

/** A point on the table, [x, z], mm. */
export type Corner = [x: number, z: number];

/**
 * A labelled outline drawn flat on the table to mark an area, such as one
 * breadboard or an enclosure: a rectangle, or a right-angled shape such as an
 * L or a U. A drawing aid only: it constrains nothing, adds nothing to any
 * path, and parts need not be inside it.
 */
export type Frame = {
  id: string;
  /**
   * The outline, in absolute table mm, in standard form (see `normaliseCorners`):
   * from the back-most, then left-most corner, clockwise in the top-down view.
   * Every side runs along x or z. corners[0] is where the label sits.
   */
  corners: Corner[];
  color: string;
  label?: string;
  /** true keeps the frame out of the drawing, and so out of a PNG; stored only when true */
  hidden?: true;
  /** false draws the coloured outline alone, with no tint inside; stored only when false, missing means filled */
  fill?: false;
  /** how opaque the fill is, 0–1; missing means FRAME_FILL_OPACITY, a faint tint */
  fillOpacity?: number;
};

/**
 * A named set of components (and frames) that hide, select and move together,
 * such as one experiment's parts when a table holds several. A member may be
 * in several groups; groups don't nest, and beams and connections are never
 * members. See groups.ts for what hiding one hides.
 */
export type Group = {
  id: string;
  name: string;
  color: string;
  /** true takes its members out of the drawing, unless another group shows them; stored only when true */
  hidden?: true;
  /** component and frame ids, each once */
  members: string[];
};

/** The most groups a setup holds; the JSON panel refuses more, and the parser keeps the first this many. */
export const GROUP_LIMIT = 100;

export const SCENE_VERSION = 13 as const;

/** how large the labels on the table are drawn, as a fraction of their standard size */
export const LABEL_SCALE_RANGE: [number, number] = [0.5, 2];

export type BuilderSceneData = {
  version: typeof SCENE_VERSION;
  components: BuilderComponent[];
  beams: Beam[];
  connections: Connection[];
  /** drawn under everything, in list order; missing in setups from before version 5 */
  frames: Frame[];
  /** named sets of components and frames; missing in setups from before version 12 */
  groups: Group[];
  /**
   * the size of component, connection and frame labels, within LABEL_SCALE_RANGE;
   * stored only when it isn't 1, missing in setups from before version 11
   */
  labelScale?: number;
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
   * Where its port sits along its local x axis, mm from the body's centre,
   * read off its model in component-models.tsx: the first surface a ruler laid
   * along the beam touches, where light leaves or enters it. A part with a
   * port is placed, snapped, saved and turned by that port; its model is
   * drawn this far behind it. Missing means the port is the centre.
   */
  referenceX?: number;
  /** set on a part that comes with another and is never placed alone: it is left out of the parts panel */
  partOf?: ComponentType;
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
    referenceX: 56, // the emitter's output face, where the beam leaves: drawn 12 mm long at x = 50
  },
  "fiber-collimator": {
    label: "Fibre collimator",
    tag: "Fiber",
    top: 20,
    minHeight: 20,
    radius: 30,
    referenceX: 10.5, // the lens window's face, where light leaves or enters: drawn 0.6 mm thick at x = 10.2
  },
  "mirror-mount": {
    label: "Mirror",
    tag: "Mirror",
    aliases: ["mirror mount"],
    top: 25,
    minHeight: 27,
    radius: 34,
  },
  "beam-splitter": {
    label: "Beam cube",
    tag: "Cube",
    aliases: ["beam splitter", "BS", "PBS"],
    top: 13,
    minHeight: 25,
    radius: 30,
  },
  lens: {
    label: "Lens",
    tag: "Lens",
    top: 20,
    minHeight: 17,
    radius: 26,
  },
  waveplate: {
    label: "Waveplate",
    tag: "λ/2",
    top: 30,
    minHeight: 36,
    radius: 26,
  },
  filter: {
    label: "Filter",
    tag: "Filter",
    top: 19,
    minHeight: 25,
    radius: 24,
  },
  iris: {
    label: "Iris",
    tag: "Iris",
    top: 20,
    minHeight: 27,
    radius: 24,
  },
  sample: {
    label: "Sample",
    tag: "Sample",
    top: 18,
    minHeight: 13,
    radius: 32, // wide enough to take in the XYZ stage it stands on
  },
  "paul-trap": {
    label: "Paul trap",
    tag: "Trap",
    top: 31,
    minHeight: 28,
    radius: 26,
  },
  cavity: {
    label: "Cavity",
    tag: "Cavity",
    top: 20,
    minHeight: 16,
    radius: 30,
  },
  particle: {
    label: "Particle",
    tag: "Particle",
    top: 10,
    minHeight: 5,
    radius: 10,
  },
  photodiode: {
    label: "Photodiode",
    tag: "PD",
    top: 13,
    minHeight: 20,
    radius: 22,
    referenceX: -2.15, // the chip's face: drawn 0.2 mm thick at x = -2.05
  },
  camera: {
    label: "Camera",
    tag: "Camera",
    top: 25,
    minHeight: 31,
    radius: 30,
    referenceX: -23, // the C-mount ring's face: drawn 2 mm thick at x = -22
  },
  spectrometer: {
    label: "Spectrometer",
    tag: "Spec",
    top: 22,
    // the box stands on the table and grows with its input port, as a
    // spectrometer on a riser would: a port 150 mm up is drawn 170 mm tall
    minHeight: 50,
    radius: 70,
    referenceX: -62, // the entrance port's outer end
  },
  "single-photon-detector": {
    label: "Single-photon detector",
    tag: "SPD",
    aliases: ["SPCM", "SNSPD", "APD", "single photon counter"],
    top: 17,
    minHeight: 23,
    radius: 38,
    referenceX: -30.5, // the FC receptacle's tip
  },
  "time-tagger": {
    label: "Time tagger",
    tag: "Tagger",
    aliases: ["TDC", "time-to-digital converter", "counter", "coincidence counter"],
    top: 23,
    minHeight: 27,
    fixedHeight: 27,
    radius: 131,
  },
  "beam-block": {
    label: "Beam block",
    tag: "Dump",
    top: 15,
    minHeight: 21,
    radius: 32,
  },
  objective: {
    label: "Objective",
    tag: "Obj",
    top: 17,
    minHeight: 24,
    radius: 32,
    referenceX: -29, // the threaded plate's outer face: drawn at x = -23, 6 mm thick
  },
  block: {
    label: "Block",
    tag: "Block",
    top: 15,
    minHeight: 15,
    radius: 26,
  },
  aom: {
    label: "AOM",
    tag: "AOM",
    top: 18,
    minHeight: 24,
    radius: 32,
  },
  eom: {
    label: "EOM",
    tag: "EOM",
    top: 18,
    minHeight: 24,
    radius: 40,
  },
  "faraday-isolator": {
    label: "Faraday isolator",
    tag: "FI",
    aliases: ["isolator", "optical isolator", "Faraday rotator", "optical diode"],
    top: 20,
    minHeight: 26,
    radius: 38,
  },
  periscope: {
    label: "Periscope",
    tag: "Peri",
    aliases: ["beam elevator", "beam riser", "periscope mirror"],
    top: 20,
    minHeight: 30,
    radius: 34,
  },
  "periscope-top": {
    label: "Periscope top mirror",
    tag: "Peri top",
    partOf: "periscope",
    top: 20,
    minHeight: 30,
    radius: 30,
  },
  "delay-line": {
    label: "Delay line",
    tag: "Delay",
    aliases: ["delay stage", "translation stage", "retroreflector", "corner cube", "optical delay"],
    top: 22,
    minHeight: 30,
    radius: 40,
  },
};

export type PartCategory = { name: string; types: ComponentType[] };

/** Palette grouping — reads as a bench walk-through: make it, steer it, shape it, read it. */
export const PART_CATEGORIES: PartCategory[] = [
  { name: "Source", types: ["laser-source", "fiber-collimator"] },
  { name: "Steering", types: ["mirror-mount", "beam-splitter", "periscope", "periscope-top", "delay-line"] },
  { name: "Shaping", types: ["lens", "objective", "waveplate", "filter", "iris"] },
  { name: "Modulation", types: ["aom", "eom", "faraday-isolator"] },
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
/** The rotation handle's step with Shift held, as the fine grid is for a move. */
export const FINE_ROTATION_STEP_DEG = 5;

/** A yaw in degrees brought into [0, 360); never −0. */
export function wrapYaw(degrees: number): number {
  return ((degrees % 360) + 360) % 360 || 0;
}

/**
 * How far a rotation handle has been swept, in degrees: from the pointer's
 * angle about the pivot at the press to its angle now (both counter-clockwise
 * from above, as yaw is), taken the short way round and snapped to `step`.
 * Crossing ±180° doesn't jump, and a full turn is no turn.
 */
export function handleSweep(fromDeg: number, toDeg: number, step: number): number {
  const sweep = wrapYaw(toDeg - fromDeg + 180) - 180;
  return Math.round(sweep / step) * step || 0;
}
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
/** A frame's fill: a faint tint by default, up to fully opaque. */
export const FRAME_FILL_OPACITY = 0.035;
export const FRAME_FILL_OPACITY_RANGE: [number, number] = [0.01, 1];

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
export const DEFAULT_OBJECTIVE_LENGTH_MM = 54;
export const OBJECTIVE_LENGTH_RANGE_MM: [number, number] = [30, 130];
export const DEFAULT_PHOTODIODE_COLOR = "#b3261e";
/** A detector's housing until it is given a colour: the light theme's own, so the picker opens on what is drawn there. */
export const DEFAULT_HOUSING_COLORS: Partial<Record<ComponentType, string>> = {
  camera: "#fbfbf8",
  spectrometer: "#fbfbf8",
  "single-photon-detector": "#1b1c1f",
};
export const BLOCK_SIZE_MM: Vec3 = [30, 30, 30];
export const BLOCK_SIZE_RANGE_MM: [number, number] = [2, 300];
/** A delay line's minimum delay, mm: a new one's, and the range any can have, as a laser's built-in path. */
export const DELAY_MIN_PATH_MM = 50;
export const DELAY_MIN_PATH_RANGE_MM: [number, number] = INTERNAL_PATH_RANGE_MM;
/** How far behind the port's mirrors the carriage's stand with the stage at 0, mm, whatever the minimum delay. */
export const DELAY_ARM_BASE_MM = 25;
/** A delay line's travel, mm: a new one's, and the range any can have. */
export const DELAY_TRAVEL_MM = 50;
export const DELAY_TRAVEL_RANGE_MM: [number, number] = [0, 2000];
/** How far above its lower mirror a new periscope's top mirror stands, mm. */
export const PERISCOPE_RISE_MM = 100;
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

/**
 * A frame's shortest side and its largest overall width and depth, mm. The
 * default is a small breadboard's footprint.
 */
export const FRAME_SIZE_RANGE_MM: [number, number] = [10, 5000];
export const DEFAULT_FRAME_SIZE_MM: [number, number] = [600, 450];
export const FRAME_COLORS = ["#0891b2", "#ea580c", "#16a34a", "#db2777", "#7c3aed", "#ca8a04"] as const;

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

export function createFrameId(): string {
  return `frame-${Math.random().toString(36).slice(2, 8)}`;
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
 * A delay line's setting, mm: its minimum delay, its travel, how far its
 * stage has travelled, and so the path a beam through it gains, the minimum
 * delay plus twice the stage's travel, out and back.
 */
export function delaySetting(component: BuilderComponent): {
  minPath: number;
  travel: number;
  stage: number;
  path: number;
} {
  const minPath = clamp(component.delayMinPathMm ?? DELAY_MIN_PATH_MM, DELAY_MIN_PATH_RANGE_MM);
  const travel = clamp(component.delayTravelMm ?? DELAY_TRAVEL_MM, DELAY_TRAVEL_RANGE_MM);
  const stage = clamp(component.delayStageMm ?? 0, [0, travel]);
  return { minPath, travel, stage, path: minPath + 2 * stage };
}

/**
 * How far a delay line's carriage mirrors stand behind its port's, mm: a
 * fixed base and the stage's travel. The minimum delay is not drawn.
 */
export function delayArmMm(component: BuilderComponent): number {
  return DELAY_ARM_BASE_MM + delaySetting(component).stage;
}

/**
 * How far down a delay line's rail a table point lies, mm from its port: the
 * point projected onto the rail (its local −x), so a drag along the rail moves
 * the stage by as much as the pointer moves along it.
 */
export function delayRailOffset(component: BuilderComponent, x: number, z: number): number {
  const yaw = (component.rotation * Math.PI) / 180;
  // local +x points along (cos, −sin) in (x, z); the rail runs the other way
  return -(x - component.position[0]) * Math.cos(yaw) + (z - component.position[2]) * Math.sin(yaw);
}

/**
 * The path a beam picks up inside delay lines, mm: down to the carriage and
 * back, each time it passes through one (a stop in the middle of it).
 */
export function beamDelayMm(components: BuilderComponent[], beam: Beam): number {
  let total = 0;
  beam.path.forEach((id, index) => {
    if (index === 0 || index === beam.path.length - 1) return;
    const component = componentById(components, id);
    if (component?.type === "delay-line") total += delaySetting(component).path;
  });
  return total;
}

/**
 * Where a part's port sits along its local x, mm from its body's centre. A
 * delay line's port is the front of its rail, half the rail ahead of its middle.
 */
export function componentReferenceX(component: BuilderComponent): number {
  if (component.type === "delay-line") return delayRailMm(component) / 2;
  return COMPONENT_SPECS[component.type].referenceX ?? 0;
}

/** A delay line's rail, front to back, mm: its farthest carriage, and room for the carriage behind its mirrors. */
export function delayRailMm(component: BuilderComponent): number {
  return DELAY_ARM_BASE_MM + delaySetting(component).travel + DELAY_CARRIAGE_BACK_MM;
}

/** How far a delay line's carriage reaches behind its mirrors, mm, and so the rail beyond its farthest setting. */
const DELAY_CARRIAGE_BACK_MM = 30;

/** How far, in world x and z, a part's port sits from its body's centre: its referenceX turned with it. */
function portShift(component: BuilderComponent, rotation = component.rotation): [number, number] {
  const offset = componentReferenceX(component);
  const yaw = (rotation * Math.PI) / 180;
  return [offset * Math.cos(yaw), -offset * Math.sin(yaw)];
}

/**
 * Where a beam meets the component, its reference point: its position. A
 * part with a port (a laser's opening, a detector's window) is placed by
 * that port, so the distance between two positions is the beam between them.
 */
export function referencePoint(component: BuilderComponent): Vec3 {
  return [...component.position] as Vec3;
}

/**
 * The middle of a part's body, which its model, selection ring and label are
 * drawn around: its position, less its port's offset. The same as its
 * position for a part with no port.
 */
export function bodyCentre(component: BuilderComponent): Vec3 {
  const [x, y, z] = component.position;
  const [dx, dz] = portShift(component);
  return [x - dx, y, z - dz];
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
 * plus the built-in path of the laser it starts at and the round trip in
 * every delay line it passes through.
 */
export function beamLengthMm(components: BuilderComponent[], beam: Beam): number {
  const points = beamPoints(components, beam.path);

  let total = beamInternalPathMm(components, beam) + beamDelayMm(components, beam);
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay, az] = points[index - 1];
    const [bx, by, bz] = points[index];
    total += Math.hypot(bx - ax, by - ay, bz - az);
  }
  return total;
}

/**
 * The length of each leg of a beam, mm, for the distance labels along it: the
 * straight 3D run between consecutive reference points (skipping stops whose
 * part is gone, as beamPoints does). A leg into a delay line the beam passes
 * through adds that delay line's minimum delay, not its current setting; one the beam ends at adds nothing, as in
 * beamDelayMm. A laser's built-in path is in no leg: it counts toward the
 * beam's total only.
 */
export function beamLegLengthsMm(components: BuilderComponent[], beam: Beam): number[] {
  const stops = beam.path
    .map((id) => componentById(components, id))
    .filter((component): component is BuilderComponent => Boolean(component));
  const legs: number[] = [];
  for (let index = 1; index < stops.length; index += 1) {
    const [ax, ay, az] = referencePoint(stops[index - 1]);
    const end = stops[index];
    const [bx, by, bz] = referencePoint(end);
    const passed = index < stops.length - 1;
    const delay = passed && end.type === "delay-line" ? delaySetting(end).minPath : 0;
    legs.push(Math.hypot(bx - ax, by - ay, bz - az) + delay);
  }
  return legs;
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
    const length = clamp(component.cavityLength ?? DEFAULT_CAVITY_LENGTH_MM, CAVITY_LENGTH_RANGE_MM);
    return Math.max(COMPONENT_SPECS.cavity.radius, length / 2 + 12);
  }
  if (component.type === "objective") {
    // drawn from the thread's back at x = -29 to the nose, so the far end sets the ring
    const length = clamp(component.objectiveLength ?? DEFAULT_OBJECTIVE_LENGTH_MM, OBJECTIVE_LENGTH_RANGE_MM);
    return Math.max(COMPONENT_SPECS.objective.radius, length - 29 + 8);
  }
  if (component.type === "delay-line") {
    return Math.max(COMPONENT_SPECS["delay-line"].radius, delayRailMm(component) / 2 + 12);
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

/**
 * The other mirror of a periscope: the top mirror of a periscope's lower one,
 * and the lower one of a top mirror. Undefined for any other part, or when the
 * other is gone.
 */
export function periscopePartner(
  components: BuilderComponent[],
  component: BuilderComponent,
): BuilderComponent | undefined {
  if (component.type === "periscope-top") {
    const base = component.periscope ? componentById(components, component.periscope) : undefined;
    return base?.type === "periscope" ? base : undefined;
  }
  if (component.type !== "periscope") return undefined;
  return components.find((entry) => entry.type === "periscope-top" && entry.periscope === component.id);
}

/** The part that is selected when this one is clicked: a periscope's top mirror selects its periscope. */
export function selectableId(components: BuilderComponent[], id: string): string {
  const component = componentById(components, id);
  return (component?.type === "periscope-top" && periscopePartner(components, component)?.id) || id;
}

/** The ids, with the other mirror of every periscope among them added: the two move, copy and go as one. */
export function withPeriscopePartners(components: BuilderComponent[], ids: string[]): string[] {
  const all = new Set(ids);
  for (const id of ids) {
    const component = componentById(components, id);
    const partner = component && periscopePartner(components, component);
    if (partner) all.add(partner.id);
  }
  return [...all];
}

/** A periscope top mirror's label: its periscope's, marked as the top. */
export function periscopeTopLabel(base: BuilderComponent): string | undefined {
  const label = base.label?.trim();
  return label ? `${label} top` : undefined;
}

/**
 * Keep every periscope top mirror straight above (or below) its lower mirror,
 * at its own height, with its periscope's label (marked as the top) and mount
 * colour, and let go of a lower mirror that no longer exists. Run after every
 * edit, like settleHosts, so the periscope is edited as one part.
 */
export function settlePeriscopes(scene: BuilderSceneData): BuilderSceneData {
  let changed = false;
  const components = scene.components.map((component) => {
    if (component.type !== "periscope-top" || component.periscope === undefined) return component;
    const base = periscopePartner(scene.components, component);
    if (!base) {
      changed = true;
      const loose = { ...component };
      delete loose.periscope;
      return loose;
    }
    const [x, y, z] = component.position;
    const label = periscopeTopLabel(base);
    if (x === base.position[0] && z === base.position[2] && component.label === label && component.color === base.color) {
      return component;
    }
    changed = true;
    const next: BuilderComponent = { ...component, position: [base.position[0], y, base.position[2]], color: base.color };
    if (label === undefined) delete next.label;
    else next.label = label;
    return next;
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

/** Lift the beam `id` out of the list and set it back so it sits at index `to` of the new list. */
export function moveBeamTo(beams: Beam[], id: string, to: number): BeamListEdit {
  const from = beams.findIndex((beam) => beam.id === id);
  if (from < 0) return { ok: false, reason: "it isn't in the list" };
  if (to < 0) return { ok: false, reason: "it's already first" };
  if (to >= beams.length) return { ok: false, reason: "it's already last" };
  const next = beams.filter((_, at) => at !== from);
  next.splice(to, 0, beams[from]);
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
// Beam-line snap
// ---------------------------------------------------------------------------

/** How close, mm, a dragged part must come to its beam's straight line to lock onto it. */
export const BEAM_LINE_SNAP_MM = 5;

/** Rounds a length to 0.01 mm, so a float wobble is never saved as a position. */
function roundMm(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Where (x, z) falls on the straight line from `before` to `after`, in the
 * table plane and clamped to the stops, or undefined when they coincide.
 */
function projectOntoBeamLine(
  x: number,
  z: number,
  before: Vec3,
  after: Vec3,
): [number, number] | undefined {
  const dx = after[0] - before[0];
  const dz = after[2] - before[2];
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq === 0) return undefined;
  const t = clamp(((x - before[0]) * dx + (z - before[2]) * dz) / lengthSq, [0, 1]);
  return [before[0] + t * dx, before[2] + t * dz];
}

/**
 * Where a part dragged to (x, z) locks onto the straight line from `before` to
 * `after`, in the table plane, or undefined when it is farther than
 * `threshold` from that segment. The point is snapped to the `step` grid
 * before it is projected and the result rounded to 0.01 mm, so on a beam that
 * runs along a grid axis the part keeps a grid value along the line.
 */
export function snapToBeamLine(
  x: number,
  z: number,
  before: Vec3,
  after: Vec3,
  step = GRID_SIZE_MM,
  threshold = BEAM_LINE_SNAP_MM,
): [number, number] | undefined {
  const nearest = projectOntoBeamLine(x, z, before, after);
  if (!nearest || Math.hypot(x - nearest[0], z - nearest[1]) > threshold) return undefined;
  const locked = projectOntoBeamLine(snapToGrid(x, step), snapToGrid(z, step), before, after);
  return locked && [roundMm(locked[0]), roundMm(locked[1])];
}

/**
 * The beam-line lock for a part being dragged: the stops before and after it
 * in the first beam, in scene order, that has it in the middle (the same rule
 * as mirror angles), and where (x, z) locks onto the line between them.
 */
export function beamLineSnap(
  beams: Beam[],
  components: BuilderComponent[],
  id: string,
  x: number,
  z: number,
  step = GRID_SIZE_MM,
  threshold = BEAM_LINE_SNAP_MM,
): { position: [number, number]; guide: [Vec3, Vec3] } | undefined {
  for (const beam of beams) {
    const index = beam.path.indexOf(id, 1);
    if (index <= 0 || index >= beam.path.length - 1) continue;
    const before = componentById(components, beam.path[index - 1]);
    const after = componentById(components, beam.path[index + 1]);
    if (!before || !after) return undefined;
    const position = snapToBeamLine(x, z, before.position, after.position, step, threshold);
    return position ? { position, guide: [before.position, after.position] } : undefined;
  }
  return undefined;
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
  if (!MIRROR_LIKE.has(component.type) && !PERISCOPE_MIRRORS.has(component.type)) return undefined;
  for (const beam of beams) {
    const index = beam.path.indexOf(component.id, 1);
    if (index > 0 && index < beam.path.length - 1) return { beam, index };
  }
  return undefined;
}

/** A delay line takes its angle from the beam it sits in, like a mirror, but stands across it (see delayLineYaw). */
const MIRROR_LIKE = new Set<ComponentType>(["mirror-mount", "delay-line"]);

/** A periscope's two mirrors: each turns like a mirror, about the beam that rises between them. */
const PERISCOPE_MIRRORS = new Set<ComponentType>(["periscope", "periscope-top"]);

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
 * A mirror or a periscope mirror takes its angle from a beam it sits in the middle of, and a
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

/**
 * The yaw, degrees in [0, 360), of a periscope mirror: tilted 45° to send the
 * light up or down, its face (local +x, tipped up or down) looks toward the
 * one neighbour that is not straight above or below it. With both
 * neighbours off to the side it bisects them, as a flat mirror would; with
 * neither, it keeps its last angle.
 */
export function periscopeYaw(mirror: Vec3, previous: Vec3, next: Vec3): number | undefined {
  const into = unitXZ(mirror, previous);
  const out = unitXZ(mirror, next);
  if (into && out) return bisectingYaw(mirror, previous, next);
  const toward = into ?? out;
  return toward ? yawDegrees(Math.atan2(-toward[1], toward[0])) : undefined;
}

/**
 * The yaw, degrees in [0, 360), of a delay line: it stands across the beam
 * line, its rail perpendicular to the way the light travels through its port.
 * Its two fold mirrors sit on the line and send the light down the rail to the
 * mirrors on its carriage and back, so the light leaves along the line it came in on.
 * Its face (local +x) is turned to whichever side of the line is nearer its
 * current yaw, so turning it round by hand puts the rail on the other side.
 * At a bend it is perpendicular to the mean of the two directions, so its face
 * lies along the bisector of the stops, toward them or away.
 * Undefined when the light doubles straight back or both neighbours sit on it.
 */
export function delayLineYaw(port: Vec3, previous: Vec3, next: Vec3, current: number): number | undefined {
  const arriving = unitXZ(previous, port);
  const leaving = unitXZ(port, next);
  if (!arriving && !leaving) return undefined;
  const dx = (arriving?.[0] ?? 0) + (leaving?.[0] ?? 0);
  const dz = (arriving?.[1] ?? 0) + (leaving?.[1] ?? 0);
  if (Math.hypot(dx, dz) < 1e-9) return undefined;
  // the face (cos θ, −sin θ) is perpendicular to (dx, dz): θ = atan2(dx, dz), or that turned 180°
  const yaw = yawDegrees(Math.atan2(dx, dz));
  const away = Math.abs(((current - yaw + 540) % 360) - 180);
  return away > 90 ? (yaw + 180) % 360 : yaw;
}

/** A part's derived yaw, or undefined when it is turned by hand. */
function derivedYaw(scene: BuilderSceneData, component: BuilderComponent): number | undefined {
  const at = (stop: { beam: Beam; index: number }, offset: number) =>
    componentById(scene.components, stop.beam.path[stop.index + offset]);
  const mirror = mirrorAngleStop(scene.beams, component);
  if (mirror) {
    const previous = at(mirror, -1);
    const next = at(mirror, 1);
    if (!previous || !next) return undefined;
    if (component.type === "delay-line") {
      return delayLineYaw(component.position, previous.position, next.position, component.rotation);
    }
    return PERISCOPE_MIRRORS.has(component.type)
      ? periscopeYaw(component.position, previous.position, next.position)
      : bisectingYaw(component.position, previous.position, next.position);
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
// Frame outlines
// ---------------------------------------------------------------------------
//
// A frame is its corners. These are pure so that drawing and reshaping can
// test an outline live by the same rules the parser holds a file to.

/** The box around an outline: its back-left and front-right, and its overall width and depth, mm. */
export type CornerBounds = { minX: number; minZ: number; maxX: number; maxZ: number; width: number; depth: number };

export function cornerBounds(corners: Corner[]): CornerBounds {
  if (corners.length === 0) return { minX: 0, minZ: 0, maxX: 0, maxZ: 0, width: 0, depth: 0 };
  const xs = corners.map(([x]) => x);
  const zs = corners.map(([, z]) => z);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  return { minX, minZ, maxX, maxZ, width: maxX - minX, depth: maxZ - minZ };
}

/**
 * A rectangle from its back-left corner, in standard form. Its width and
 * depth are held to FRAME_SIZE_RANGE_MM, and it is slid, not squeezed, to
 * stay on the table.
 */
export function rectangleCorners([x, z]: Corner, width: number, depth: number): Corner[] {
  const across = clamp(width, FRAME_SIZE_RANGE_MM);
  const down = clamp(depth, FRAME_SIZE_RANGE_MM);
  const left = clamp(x, [-TABLE_GUARD_MM, TABLE_GUARD_MM - across]);
  const back = clamp(z, [-TABLE_GUARD_MM, TABLE_GUARD_MM - down]);
  return [
    [left, back],
    [left + across, back],
    [left + across, back + down],
    [left, back + down],
  ];
}

/**
 * An outline in standard form: repeated corners and corners in the middle of
 * a straight side dropped, running clockwise as seen in the top-down view (+x
 * right, +z down the screen), from the back-most, then left-most corner. The
 * same outline gives the same list whichever corner it started at and
 * whichever way it ran. A side that doubles back on itself is kept, for
 * `isValidOutline` to refuse.
 */
export function normaliseCorners(corners: Corner[]): Corner[] {
  const ring = corners.map(([x, z]): Corner => [x, z]);
  // dropping one corner can leave its neighbour in the middle of a side, so go round until nothing changes
  for (let at = 0; ring.length > 2 && at < ring.length; ) {
    const [px, pz] = ring[(at + ring.length - 1) % ring.length];
    const [x, z] = ring[at];
    const [nx, nz] = ring[(at + 1) % ring.length];
    const repeated = x === px && z === pz;
    const ahead = (x - px) * (nz - z) - (z - pz) * (nx - x) === 0 && (x - px) * (nx - x) + (z - pz) * (nz - z) > 0;
    if (repeated || ahead) {
      ring.splice(at, 1);
      at = 0;
    } else {
      at += 1;
    }
  }
  // with +z down the screen, a positive shoelace sum runs clockwise
  const turn = ring.reduce((sum, [x, z], at) => {
    const [nx, nz] = ring[(at + 1) % ring.length];
    return sum + x * nz - nx * z;
  }, 0);
  if (turn < 0) ring.reverse();
  let first = 0;
  ring.forEach(([x, z], at) => {
    const [fx, fz] = ring[first];
    if (z < fz || (z === fz && x < fx)) first = at;
  });
  return [...ring.slice(first), ...ring.slice(0, first)];
}

/**
 * Why corners can't be a frame's outline, or null when they can. `closed`
 * reads them as a loop in the order given, as a saved frame is; open, they
 * are a path from the first corner to the last, as an outline being drawn is.
 * Every side must run along x or z and be at least FRAME_SIZE_RANGE_MM[0]
 * long, the whole at most FRAME_SIZE_RANGE_MM[1] wide and deep, and no side
 * may cross, touch or double back along another. A loop needs 4 corners.
 * Each reason finishes a sentence such as "Can't close the outline: …".
 */
export function outlineProblem(corners: Corner[], closed: boolean): string | null {
  const count = corners.length;
  if (closed && count < 4) return "an outline needs at least 4 corners";
  if (!corners.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z))) return "a corner isn't two numbers";
  const [shortest, largest] = FRAME_SIZE_RANGE_MM;
  const { width, depth } = cornerBounds(corners);
  if (width > largest || depth > largest) return `the frame would be over ${largest} mm across`;

  const sides = (closed ? corners : corners.slice(0, -1)).map((from, at): [Corner, Corner] => [
    from,
    corners[(at + 1) % count],
  ]);
  for (const [[x0, z0], [x1, z1]] of sides) {
    if (x0 !== x1 && z0 !== z1) return "a side would be slanted";
    if (Math.abs(x1 - x0) + Math.abs(z1 - z0) < shortest) return `a side would be under ${shortest} mm`;
  }
  const folds = "a side would cross, touch or run back along another";
  for (let i = 0; i < sides.length; i += 1) {
    for (let j = i + 1; j < sides.length; j += 1) {
      const [[ax0, az0], [ax1, az1]] = sides[i];
      const [[bx0, bz0], [bx1, bz1]] = sides[j];
      if (j === i + 1 || (closed && i === 0 && j === sides.length - 1)) {
        // neighbours share a corner; they only go wrong by running back along each other
        if ((ax1 - ax0) * (bx1 - bx0) + (az1 - az0) * (bz1 - bz0) < 0) return folds;
        continue;
      }
      // two sides along the axes meet exactly when their boxes overlap
      const meetX = Math.max(Math.min(ax0, ax1), Math.min(bx0, bx1)) <= Math.min(Math.max(ax0, ax1), Math.max(bx0, bx1));
      const meetZ = Math.max(Math.min(az0, az1), Math.min(bz0, bz1)) <= Math.min(Math.max(az0, az1), Math.max(bz0, bz1));
      if (meetX && meetZ) return folds;
    }
  }
  return null;
}

/**
 * Whether corners make an outline a frame can have, read as a closed loop in
 * the order given: at least 4 corners, every side along x or z and at least
 * FRAME_SIZE_RANGE_MM[0] long, at most FRAME_SIZE_RANGE_MM[1] wide and deep
 * overall, and no side crossing, touching or doubling back along another.
 */
export function isValidOutline(corners: Corner[]): boolean {
  return outlineProblem(corners, true) === null;
}

/** Every corner moved by (dx, dz), held back so the whole outline stays on the table. */
export function translateCorners(corners: Corner[], dx: number, dz: number): Corner[] {
  const { minX, minZ, maxX, maxZ } = cornerBounds(corners);
  const stepX = clamp(dx, [-TABLE_GUARD_MM - minX, TABLE_GUARD_MM - maxX]);
  const stepZ = clamp(dz, [-TABLE_GUARD_MM - minZ, TABLE_GUARD_MM - maxZ]);
  return corners.map(([x, z]) => [x + stepX, z + stepZ]);
}

/** A plain rectangle, which keeps an editable width and depth; any other shape shows its overall size. */
export function isRectangle(corners: Corner[]): boolean {
  return corners.length === 4 && isValidOutline(corners);
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
    color: cssColor(raw.color, undefined),
    label: labelText(raw.label),
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
  if (type === "objective" && version >= 8) {
    const length = finiteNumber(raw.objectiveLength);
    if (length !== undefined) component.objectiveLength = clamp(length, OBJECTIVE_LENGTH_RANGE_MM);
  }
  if (type === "sample") {
    const opacity = finiteNumber(raw.opacity);
    if (opacity !== undefined) component.opacity = clamp(opacity, SAMPLE_OPACITY_RANGE);
    if (version >= 13 && raw.stageHidden === true) component.stageHidden = true;
  }
  if (type === "particle") {
    if (typeof raw.host === "string") component.host = raw.host;
    const radius = finiteNumber(raw.particleRadius);
    if (radius !== undefined) component.particleRadius = clamp(radius, PARTICLE_RADIUS_RANGE_MM);
  }
  if (type === "periscope-top" && typeof raw.periscope === "string") component.periscope = raw.periscope;
  if (LIT_TYPES.has(type as ComponentType)) {
    const light = cssColor(raw.lightColor, undefined);
    if (light !== undefined) component.lightColor = light;
    if (raw.lightHidden === true) component.lightHidden = true;
  }
  if (type === "delay-line") Object.assign(component, parseDelay(raw));
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
    color: cssColor(raw.color, BEAM_COLORS[0]),
    label: labelText(raw.label),
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

/**
 * A frame's outline from a saved one. Corners are held to the table and put
 * in standard form. An outline no frame can have (a slanted side, a crossing,
 * too few corners, a side under 10 mm, too large, or an entry that isn't two
 * numbers) becomes the rectangle around its usable corners.
 *
 * With no usable corners at all, the frame is read in the form saved before
 * version 7, a centre and a size, which hand-written files may still use:
 * what is missing gets the default, so a frame with only an id is a 600 × 450
 * rectangle centred on the table's origin.
 */
function parseFrameCorners(raw: Record<string, unknown>): Corner[] {
  const listed: unknown[] = Array.isArray(raw.corners) ? raw.corners : [];
  const usable = listed.flatMap((entry): Corner[] => {
    if (!Array.isArray(entry) || entry.length !== 2) return [];
    const [x, z] = entry.map(finiteNumber);
    return x === undefined || z === undefined ? [] : [clampToTable(x, z)];
  });
  if (usable.length === 0) {
    const at = Array.isArray(raw.position) ? raw.position : [];
    const [x, z] = clampToTable(finiteNumber(at[0]) ?? 0, finiteNumber(at[1]) ?? 0);
    const width = clamp(finiteNumber(raw.width) ?? DEFAULT_FRAME_SIZE_MM[0], FRAME_SIZE_RANGE_MM);
    const depth = clamp(finiteNumber(raw.depth) ?? DEFAULT_FRAME_SIZE_MM[1], FRAME_SIZE_RANGE_MM);
    return rectangleCorners([x - width / 2, z - depth / 2], width, depth);
  }
  const outline = normaliseCorners(usable);
  if (usable.length === listed.length && isValidOutline(outline)) return outline;
  const { minX, minZ, width, depth } = cornerBounds(usable);
  return rectangleCorners([minX, minZ], width, depth);
}

/**
 * A frame needs only an id; a bad outline is kept as a rectangle, and the rest
 * that is missing gets the default. Frames from before version 6 had no fill
 * switch and open filled; those from before version 7 were saved as a centre
 * and a size, and open as that rectangle's corners.
 */
function parseFrame(value: unknown, version: number): Frame | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    corners: parseFrameCorners(raw),
    color: cssColor(raw.color, FRAME_COLORS[0]),
    ...(labelText(raw.label) !== undefined ? { label: labelText(raw.label) } : {}),
    ...(raw.hidden === true ? { hidden: true } : {}),
    ...(version >= 6 && raw.fill === false ? { fill: false } : {}),
    ...parseFillOpacity(raw.fillOpacity, version),
  };
}

/** A frame's fill opacity, from version 9 on, kept only when it isn't the default. */
function parseFillOpacity(raw: unknown, version: number): Pick<Frame, "fillOpacity"> {
  const opacity = version >= 9 ? finiteNumber(raw) : undefined;
  if (opacity === undefined) return {};
  const held = clamp(opacity, FRAME_FILL_OPACITY_RANGE);
  return held === FRAME_FILL_OPACITY ? {} : { fillOpacity: held };
}

export type FrameListEdit = { ok: true; frames: Frame[] } | { ok: false; reason: string };

/** Lift the frame `id` out of the list and set it back so it sits at index `to`, as a beam moves in its list. */
export function moveFrameTo(frames: Frame[], id: string, to: number): FrameListEdit {
  const from = frames.findIndex((frame) => frame.id === id);
  if (from < 0) return { ok: false, reason: "it isn't in the list" };
  if (to < 0) return { ok: false, reason: "it's already first" };
  if (to >= frames.length) return { ok: false, reason: "it's already last" };
  const next = frames.filter((_, at) => at !== from);
  next.splice(to, 0, frames[from]);
  return { ok: true, frames: next };
}

/** Hide or show one frame. Stored only when hidden, like a beam's flag. */
export function setFrameHidden(frames: Frame[], id: string, hidden: boolean): Frame[] {
  return frames.map((frame) => {
    if (frame.id !== id) return frame;
    const next = { ...frame };
    if (hidden) next.hidden = true;
    else delete next.hidden;
    return next;
  });
}

/** What a frame is called in the list and the inspector: its label, else its overall size. */
export function frameDisplayName(frame: Frame): string {
  const label = frame.label?.trim();
  const { width, depth } = cornerBounds(frame.corners);
  return label || `Frame ${Math.round(width)} × ${Math.round(depth)} mm`;
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
    color: cssColor(raw.color, spec.color),
    ...(labelText(raw.label) !== undefined ? { label: labelText(raw.label) } : {}),
    ...(length !== undefined ? { lengthM: clamp(length, CONNECTION_LENGTH_RANGE_M) } : {}),
    ...(index !== undefined ? { [spec.index.key]: clamp(index, spec.index.range) } : {}),
  };
}

/** A colour a setup file may give: hex, rgb()/hsl() of plain numbers, or a CSS colour name. */
const CSS_COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?)\(\s*[-+\d.%\s,/deg]+\)|[a-z]{3,24})$/i;

/**
 * A file's colour, if it is one: anything else (a `url(…)`, an `image-set`)
 * would reach inline styles and could make the page fetch from elsewhere.
 */
function cssColor<T extends string | undefined>(raw: unknown, fallback: T): string | T {
  if (typeof raw !== "string") return fallback;
  const color = raw.trim();
  return CSS_COLOR.test(color) ? color : fallback;
}

/** The longest label a file may give, characters; beyond it a label is cut. */
export const LABEL_MAX_LENGTH = 120;

/** A file's label, without control characters and cut to LABEL_MAX_LENGTH. */
/** The arm, port to retroreflector, that a delay line had before its travel was set (see parseDelay), mm. */
const LEGACY_DELAY_ARM_MM: [number, number] = [50, 350];

/**
 * A delay line's saved setting, each field kept only when the file gives it,
 * and held as the builder would hold it. Delay lines first set the arm, port
 * to retroreflector: its shortest, its longest and where it was (delayMinMm,
 * delayMaxMm, delayMm). Such a file opens with the same path through it:
 * twice the shortest arm is the minimum delay, and the arm's range its travel.
 */
function parseDelay(raw: Record<string, unknown>): Partial<BuilderComponent> {
  let minPath = finiteNumber(raw.delayMinPathMm);
  let travel = finiteNumber(raw.delayTravelMm);
  let stage = finiteNumber(raw.delayStageMm);
  const [oldMin, oldMax, oldArm] = [raw.delayMinMm, raw.delayMaxMm, raw.delayMm].map(finiteNumber);
  if (minPath === undefined && travel === undefined && stage === undefined && [oldMin, oldMax, oldArm].some((n) => n !== undefined)) {
    const min = Math.max(0, oldMin ?? LEGACY_DELAY_ARM_MM[0]);
    const max = Math.max(min, oldMax ?? LEGACY_DELAY_ARM_MM[1]);
    minPath = 2 * min;
    travel = max - min;
    stage = clamp(oldArm ?? min, [min, max]) - min;
  }
  const held = delaySetting({ id: "", type: "delay-line", position: [0, 0, 0], rotation: 0, delayMinPathMm: minPath, delayTravelMm: travel, delayStageMm: stage });
  return {
    ...(minPath !== undefined ? { delayMinPathMm: held.minPath } : {}),
    ...(travel !== undefined ? { delayTravelMm: held.travel } : {}),
    ...(stage !== undefined ? { delayStageMm: held.stage } : {}),
  };
}

export function labelText(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  return raw.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, LABEL_MAX_LENGTH);
}

/**
 * Accepts anything (a dropped file, a localStorage blob) and returns a scene
 * or null. Unknown component types and dangling beam references are dropped
 * rather than throwing — a partially readable setup beats an error dialog.
 * Setups from before version 3 have no connections and open with none;
 * those from before version 4 have no hidden beams and open with every beam shown;
 * those from before version 5 have no frames and open with none;
 * those from before version 6 open with every frame filled;
 * those from before version 7 saved each frame as a centre and a size, and
 * open with that rectangle's corners;
 * those from before version 9 open with every frame's fill at the faint default;
 * those from before version 10 saved a part with a port by its body's centre,
 * and open with it moved to its port, exactly where it was;
 * those from before version 11 open with labels at their standard size;
 * those from before version 12 have no groups and open with none;
 * those from before version 13 open with every sample on its stage.
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

  const frames = Array.isArray(raw.frames)
    ? raw.frames.map((frame) => parseFrame(frame, version)).filter((frame): frame is Frame => frame !== null)
    : [];

  const memberIds = new Set([...ids, ...frames.map((frame) => frame.id)]);
  const groups = Array.isArray(raw.groups)
    ? raw.groups
        .map((group) => parseGroup(group, memberIds))
        .filter((group): group is Group => group !== null)
        .slice(0, GROUP_LIMIT)
    : [];

  const labelScale = parseLabelScale(raw.labelScale);

  const scene = settleAngles(
    settlePeriscopes(
      settleHosts({
        version: SCENE_VERSION,
        components,
        beams,
        connections,
        frames,
        groups,
        ...(labelScale !== undefined ? { labelScale } : {}),
      }),
    ),
  );
  return version < 10 ? settleAngles(movedToPorts(scene)) : scene;
}

/**
 * A group, its members kept to the ids of parts and frames in the setup, each
 * once; a group left with no members still opens.
 */
function parseGroup(value: unknown, memberIds: Set<string>): Group | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return null;
  const members = Array.isArray(raw.members)
    ? [...new Set(raw.members.filter((id): id is string => typeof id === "string" && memberIds.has(id)))]
    : [];
  return {
    id: raw.id,
    name: labelText(raw.name)?.trim() || "Group",
    color: cssColor(raw.color, BEAM_COLORS[0]),
    ...(raw.hidden === true ? { hidden: true } : {}),
    members,
  };
}

/** A label scale held to LABEL_SCALE_RANGE; undefined for a missing one or the standard size, 1. */
export function parseLabelScale(raw: unknown): number | undefined {
  const value = finiteNumber(raw);
  if (value === undefined) return undefined;
  const held = clamp(value, LABEL_SCALE_RANGE);
  return held === 1 ? undefined : held;
}

/**
 * Before version 10 a part with a port was saved by its body's centre. Once
 * its angle is settled (a detector turned to its light, as it was drawn),
 * each moves to its port, so it opens exactly where it was; the angles then
 * settle again, unchanged, as a port lies on the line its part is turned along.
 */
function movedToPorts(scene: BuilderSceneData): BuilderSceneData {
  const components = scene.components.map((component) => {
    const [dx, dz] = portShift(component);
    if (dx === 0 && dz === 0) return component;
    const [x, y, z] = component.position;
    const [px, pz] = clampToTable(x + dx, z + dz);
    return { ...component, position: [px, y, pz] as Vec3 };
  });
  return { ...scene, components };
}

export function serializeScene(scene: BuilderSceneData): string {
  return JSON.stringify({ ...scene, version: SCENE_VERSION }, null, 2);
}

export const EMPTY_SCENE: BuilderSceneData = {
  version: SCENE_VERSION,
  components: [],
  beams: [],
  connections: [],
  frames: [],
  groups: [],
};

// A two-beam layout so the table isn't blank on first load. It demonstrates
// the two conventions a newcomer needs: mount colour marks the beam line, and
// a beam is a path you draw through the parts it passes.
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
    // a laser, spectrometer and photodiode are placed by their ports: the
    // the first beam runs 575 mm from the laser's opening to the spectrometer's
    { id: "laser-pump", type: "laser-source", position: [-300, 0, -150], rotation: 0 },
    { id: "waveplate-1", type: "waveplate", position: [-250, 0, -150], rotation: 0 },
    { id: "pbs-1", type: "beam-splitter", position: [-150, 0, -150], rotation: 0 },
    { id: "lens-1", type: "lens", position: [-25, 0, -150], rotation: 0, lensShape: "plano-convex", focalLength: 100 },
    { id: "sample-1", type: "sample", position: [100, 0, -150], rotation: 0 },
    { id: "filter-1", type: "filter", position: [200, 0, -150], rotation: 0 },
    { id: "spectrometer-1", type: "spectrometer", position: [275, 0, -150], rotation: 0 },
    { id: "mirror-ref", type: "mirror-mount", position: [-150, 0, 100], rotation: 45, color: "#dc2626" },
    { id: "pd-ref", type: "photodiode", position: [150, 0, 100], rotation: 0 },
  ]),
  beams: [
    {
      id: "beam-pump",
      path: ["laser-pump", "waveplate-1", "pbs-1", "lens-1", "sample-1", "filter-1", "spectrometer-1"],
      color: "#7c3aed",
    },
    {
      id: "beam-ref",
      path: ["pbs-1", "mirror-ref", "pd-ref"],
      color: "#dc2626",
    },
  ],
  connections: [],
  frames: [],
  groups: [],
};
