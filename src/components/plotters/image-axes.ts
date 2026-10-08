// Where a frame's pixels sit in the Image view. A frame's row 0 is its bottom
// row, as in DS9 and astropy's origin="lower"; a canvas counts its rows from
// the top. Everything that crosses between the two (the painted canvas, the
// pointer, the slice band, the ticks) goes through here so they agree.

import { niceTicks } from "./surface-geometry.ts";

/** The canvas row a frame row is painted on, and the frame row on a canvas row: the flip is its own inverse. */
export function flipRow(row: number, height: number) {
  return height - 1 - row;
}

/**
 * The pixel under a point `ratio` (0 to 1) of the way across a region that
 * starts `start` pixels in and spans `extent` pixels, clamped to the `count`
 * pixels the frame has along that axis.
 */
export function pixelAtRatio(ratio: number, start: number, extent: number, count: number) {
  return Math.min(Math.max(Math.floor(start + ratio * extent), 0), count - 1);
}

/**
 * Whole-pixel tick values for a region that starts `start` pixels in (counted
 * along the axis' own direction) and spans `extent` pixels. A pixel gets a tick
 * when its centre is inside the region.
 */
export function pixelAxisTicks(start: number, extent: number, target = 5) {
  return niceTicks(start - 0.5, start + extent - 0.5, target).filter((tick) => Number.isInteger(tick));
}

/** The part of the frame the Image view shows, in pixels counted from the frame's top-left corner. */
export type Viewport = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type FrameSize = { height: number; width: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeViewport(
  frame: FrameSize,
  left: number,
  top: number,
  width: number,
  height: number,
): Viewport {
  const nextWidth = clamp(width, 1, frame.width);
  const nextHeight = clamp(height, 1, frame.height);

  return {
    height: nextHeight,
    left: clamp(left, 0, frame.width - nextWidth),
    top: clamp(top, 0, frame.height - nextHeight),
    width: nextWidth,
  };
}

/** The viewport after one zoom step about its centre: `factor` below 1 zooms in, above 1 zooms out. */
export function zoomViewport(frame: FrameSize, viewport: Viewport, factor: number): Viewport {
  const nextWidth = viewport.width * factor;
  const nextHeight = viewport.height * factor;
  const centerX = viewport.left + viewport.width / 2;
  const centerY = viewport.top + viewport.height / 2;

  return normalizeViewport(
    frame,
    centerX - nextWidth / 2,
    centerY - nextHeight / 2,
    nextWidth,
    nextHeight,
  );
}
