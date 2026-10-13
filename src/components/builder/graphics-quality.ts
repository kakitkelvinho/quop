/**
 * How much the Tabletop draws per frame. Full is the miniature finish:
 * ambient occlusion, a vignette, a sharp shadow map and up to 2× the screen's
 * pixels. Light gives those up so a weak laptop can orbit smoothly. A viewer
 * setting, kept in this browser, never in the setup.
 */
export type GraphicsQuality = "full" | "light";

export type QualitySettings = {
  /** the canvas's device-pixel-ratio range */
  dpr: [number, number];
  /** ambient occlusion and the vignette */
  effects: boolean;
  /** the key light's shadow map, px a side */
  shadowMapSize: number;
};

export const QUALITY_SETTINGS: Record<GraphicsQuality, QualitySettings> = {
  full: { dpr: [1, 2], effects: true, shadowMapSize: 2048 },
  light: { dpr: [1, 1.5], effects: false, shadowMapSize: 1024 },
};

export const QUALITY_STORAGE_KEY = "quop-builder-graphics";

/** The quality this browser was set to by a click on the toggle, or null if it never was. */
export function readStoredQuality(): GraphicsQuality | null {
  try {
    const stored = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    return stored === "full" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

export function storeQuality(quality: GraphicsQuality): void {
  try {
    window.localStorage.setItem(QUALITY_STORAGE_KEY, quality);
  } catch {
    // private windows and blocked storage: the choice lasts this visit only
  }
}

// The canvas draws on demand, so while the view sits still a gap between
// frames is rest, not a slow frame, and drei's PerformanceMonitor, which counts
// frames per window, would read a resting view as a slow one. So only frames
// drawn while someone is moving the view (orbiting, panning, dragging a part)
// are timed: each such run is judged by its median gap, and only runs that
// keep coming out slow count.

/** frames a run needs to be judged; a shorter one is a click, not a move */
export const RUN_MIN_FRAMES = 5;
/** frames after which a long run is judged without waiting for it to end */
export const RUN_MAX_FRAMES = 60;
/** ms: a run whose median gap between frames is longer than this is slow (under 25 fps) */
export const SLOW_FRAME_MS = 40;
/** slow runs in a row before the view steps down */
export const SLOW_RUNS = 2;

/** `gaps` are the current run's, ms between frames; `slowRuns` how many slow runs came in a row */
export type FrameWatch = { gaps: number[]; slowRuns: number };

export const FRESH_WATCH: FrameWatch = { gaps: [], slowRuns: 0 };

/**
 * Judges the run so far and starts the next. `slow` is true once enough runs
 * in a row came out slow; the watch then starts over.
 */
export function endRun(watch: FrameWatch): { watch: FrameWatch; slow: boolean } {
  if (watch.gaps.length < RUN_MIN_FRAMES) return { watch: { ...watch, gaps: [] }, slow: false };
  const sorted = [...watch.gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const slowRuns = median > SLOW_FRAME_MS ? watch.slowRuns + 1 : 0;
  if (slowRuns >= SLOW_RUNS) return { watch: FRESH_WATCH, slow: true };
  return { watch: { gaps: [], slowRuns }, slow: false };
}

/** Feeds one gap between two frames of a run, ms; a long run is judged as it goes. */
export function watchFrame(watch: FrameWatch, gapMs: number): { watch: FrameWatch; slow: boolean } {
  const next = { ...watch, gaps: [...watch.gaps, gapMs] };
  return next.gaps.length >= RUN_MAX_FRAMES ? endRun(next) : { watch: next, slow: false };
}
