// Data model for the Experiment Builder. See the "Experiment Builder — Design
// Brief" doc for the reasoning behind these choices (real-world mm scale,
// path-based beams instead of simulated reflection, 15° rotation snap).

export type ComponentType =
  | "laser-source"
  | "mirror-mount"
  | "lens"
  | "pbs-cube"
  | "waveplate"
  | "photodiode"
  | "spectrometer";

export type Vec3 = [number, number, number];

export type BuilderComponent = {
  id: string;
  type: ComponentType;
  /** millimeters, table plane is XZ, Y is height */
  position: Vec3;
  /** degrees, yaw around the vertical axis; mirror-mounts snap to ROTATION_STEP */
  rotation: number;
  /** hex color — only meaningful for mirror-mount, where color marks the beam line */
  color?: string;
  label?: string;
};

export type Beam = {
  id: string;
  /** ordered component ids the beam visits, source to end */
  path: string[];
  color: string;
};

export type BuilderSceneData = {
  components: BuilderComponent[];
  beams: Beam[];
};

export const COMPONENT_LIBRARY: { type: ComponentType; label: string }[] = [
  { type: "laser-source", label: "Laser Source" },
  { type: "mirror-mount", label: "Mirror + Mount" },
  { type: "lens", label: "Lens" },
  { type: "pbs-cube", label: "PBS Cube" },
  { type: "waveplate", label: "Waveplate" },
  { type: "photodiode", label: "Photodiode" },
  { type: "spectrometer", label: "Spectrometer" },
];

export const GRID_SIZE_MM = 25;
export const TABLE_WIDTH_MM = 600;
export const TABLE_DEPTH_MM = 450;
export const ROTATION_STEP_DEG = 15;
export const DEFAULT_MOUNT_COLOR = "#8b1e3f";

export function snapToGrid(value: number, step = GRID_SIZE_MM): number {
  return Math.round(value / step) * step;
}

export function createComponentId(type: ComponentType): string {
  return `${type}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBeamId(): string {
  return `beam-${Math.random().toString(36).slice(2, 8)}`;
}
