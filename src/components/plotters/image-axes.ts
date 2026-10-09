// Where a frame's pixels sit in the Image view. A frame's row 0 is its bottom
// row, as in DS9 and astropy's origin="lower"; a canvas counts its rows from
// the top. Everything that crosses between the two (the painted canvas, the
// pointer, the slice band, the ticks) goes through here so they agree, and
// they all read one viewport that covers whole pixels.

import { niceTicks } from "./surface-geometry.ts";

/** The canvas row a frame row is painted on, and the frame row on a canvas row: the flip is its own inverse. */
export function flipRow(row: number, height: number) {
  return height - 1 - row;
}

/**
 * The pixel under a point `ratio` (0 to 1) of the way across a viewport that
 * starts `start` pixels in and spans `extent` pixels, clamped to the `count`
 * pixels the frame has along that axis.
 */
export function pixelAtRatio(ratio: number, start: number, extent: number, count: number) {
  return Math.min(Math.max(Math.floor(start + ratio * extent), 0), count - 1);
}

/**
 * Whole-pixel tick values for a viewport that starts `start` pixels in (counted
 * along the axis' own direction) and spans `extent` pixels. A pixel gets a tick
 * when its centre is inside the viewport.
 */
export function pixelAxisTicks(start: number, extent: number, target = 5) {
  return niceTicks(start - 0.5, start + extent - 0.5, target).filter((tick) => Number.isInteger(tick));
}

/**
 * The part of the frame the Image view shows, in pixels counted from the
 * frame's top-left corner. It always covers whole pixels: the canvas holds one
 * cell per pixel of it, so a region that started or ended between pixels would
 * drop or double a row or column, and hover and tick labels would name pixels
 * other than the ones drawn.
 */
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

// one axis of a region: its edges snapped to the nearest pixel edges, at least
// one pixel long, slid back into the frame if it overhangs
function snapSpan(start: number, length: number, count: number) {
  const first = Math.round(start);
  const snappedLength = clamp(Math.round(start + length) - first, 1, count);

  return { length: snappedLength, start: clamp(first, 0, count - snappedLength) };
}

/** The whole-pixel viewport nearest to a region given in (possibly fractional) pixels. */
export function normalizeViewport(
  frame: FrameSize,
  left: number,
  top: number,
  width: number,
  height: number,
): Viewport {
  const across = snapSpan(left, width, frame.width);
  const down = snapSpan(top, height, frame.height);

  return { height: down.length, left: across.start, top: down.start, width: across.length };
}

// a zoom step moves the length by at least a pixel, so a step never rounds back
// to where it started
function zoomedLength(length: number, factor: number, count: number) {
  const scaled = Math.round(length * factor);
  const moved = factor < 1 ? Math.min(scaled, length - 1) : factor > 1 ? Math.max(scaled, length + 1) : scaled;

  return clamp(moved, 1, count);
}

/** The viewport after one zoom step about its centre: `factor` below 1 zooms in, above 1 zooms out. */
export function zoomViewport(frame: FrameSize, viewport: Viewport, factor: number): Viewport {
  const width = zoomedLength(viewport.width, factor, frame.width);
  const height = zoomedLength(viewport.height, factor, frame.height);

  return normalizeViewport(
    frame,
    viewport.left + (viewport.width - width) / 2,
    viewport.top + (viewport.height - height) / 2,
    width,
    height,
  );
}
