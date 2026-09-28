// The pixel aspect both FITS views share: how tall one pixel is drawn
// relative to its width. 1 is true pixels; a frame's "square" aspect draws
// the whole frame as a square, whatever its pixel counts.

export const TRUE_PIXEL_ASPECT = 1;

/** The pixel aspect that draws a width × height frame as a square. */
export function squarePixelAspect(width: number, height: number) {
  return Math.max(width, 1) / Math.max(height, 1);
}

/** The width ÷ height of a width × height region drawn at `pixelAspect`. */
export function displayAspect(width: number, height: number, pixelAspect: number) {
  return Math.max(width, 1) / (Math.max(height, 1) * pixelAspect);
}

/**
 * The slider's range in log₂ steps: at least 1/16 to 16, widened so the
 * frame's square aspect always sits inside it with a step to spare.
 */
export function pixelAspectSliderRange(width: number, height: number) {
  const square = Math.log2(squarePixelAspect(width, height));

  return {
    max: Math.max(4, Math.ceil(square) + 1),
    min: Math.min(-4, Math.floor(square) - 1),
  };
}

/** Keeps a typed-in aspect finite and positive, inside 1/1000 to 1000. */
export function clampPixelAspect(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return TRUE_PIXEL_ASPECT;
  }

  return Math.min(Math.max(value, 0.001), 1000);
}

export function formatPixelAspect(value: number) {
  return value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
}
