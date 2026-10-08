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
