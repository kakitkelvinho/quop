/**
 * While the view or a part moves, the Tabletop draws without ambient
 * occlusion, its costliest pass: it halved the frame time of a pan in
 * software WebGL (#418). The grounding it gives goes with it while moving;
 * when motion stops it fades back in rather than popping. Freezing the shadow map during an orbit was
 * also tried and measured no gain.
 */

/** ms for the occlusion to fade back in once motion stops */
export const AO_FADE_IN_MS = 220;
/** the longest gap one fade frame counts, ms, so a frame after a long rest doesn't skip the fade */
const MAX_FADE_STEP_MS = 1000 / 60;

export type Motion = {
  /** the camera moved since the last frame: an orbit, a pan, a zoom, or the glide after one */
  cameraMoving: boolean;
  /** a part, handle or stage is being dragged */
  dragging: boolean;
};

export type MotionShade = {
  /** draw the occlusion pass at all */
  occlusion: boolean;
  /** how far the occlusion has faded back in, 0 to 1 */
  occlusionFade: number;
  /** another frame is needed to carry on the fade */
  fading: boolean;
};

export function isMoving(motion: Motion): boolean {
  return motion.cameraMoving || motion.dragging;
}

/**
 * The shading for this frame, from the motion and the fade so far; `gapMs` is
 * the time since the last frame. With `reducedMotion` the occlusion comes
 * straight back instead of fading.
 */
export function motionShade(motion: Motion, fade: number, gapMs: number, reducedMotion = false): MotionShade {
  if (isMoving(motion)) {
    return { occlusion: false, occlusionFade: 0, fading: false };
  }
  const next = reducedMotion ? 1 : Math.min(1, fade + Math.min(gapMs, MAX_FADE_STEP_MS) / AO_FADE_IN_MS);
  return { occlusion: true, occlusionFade: next, fading: next < 1 };
}
