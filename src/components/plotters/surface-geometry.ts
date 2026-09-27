// The Surface view's landscape as plain arrays: downsampling, the grid mesh,
// and the map from a point on it back to a frame pixel. No three.js here, so
// it runs (and is tested) without WebGL; fits-surface-view.tsx wraps the
// arrays in a BufferGeometry.
//
// Local coordinates: x runs along the frame's columns, y against its rows
// (row 0 is the far edge, as it is the top edge of the Image view), and z is
// the value normalised to 0..1 between the frame's min and max. The footprint
// is centred on the origin, its longer side is 1 long, and each pixel is drawn
// `pixelAspect` times as long along y as along x (1 is true pixels).

/**
 * The most vertices the landscape draws before it is downsampled. The research
 * for #51 put the orbit budget near 260k; it is set a little higher so a
 * 1600×200 dispersion frame (320,000 pixels) stays at full resolution.
 */
export const SURFACE_VERTEX_BUDGET = 320_000;

/** The smallest block size that brings the frame within `budget` vertices. */
export function chooseSurfaceStep(width: number, height: number, budget = SURFACE_VERTEX_BUDGET) {
  let step = 1;

  while (Math.ceil(width / step) * Math.ceil(height / step) > budget) {
    step += 1;
  }

  return step;
}

export type ReducedFrame = {
  /** pixel column at the centre of each vertex column */
  centreX: Float32Array;
  /** pixel row at the centre of each vertex row */
  centreY: Float32Array;
  columns: number;
  rows: number;
  step: number;
  values: Float32Array;
};

/**
 * Cuts the frame into step×step blocks and keeps one value per block: the
 * block's min or its max, whichever lies further from the block's mean. A
 * one-pixel peak (or dip) keeps its true height, where a block mean would
 * shave it and a block max would lift the whole background. Blocks at the
 * right and bottom edges may be smaller. NaNs are skipped; an all-NaN block
 * stays NaN.
 */
export function reduceFrame(
  pixels: Float32Array,
  width: number,
  height: number,
  step: number,
): ReducedFrame {
  const columns = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  const values = new Float32Array(columns * rows);
  const centreX = new Float32Array(columns);
  const centreY = new Float32Array(rows);

  for (let column = 0; column < columns; column += 1) {
    const first = column * step;
    const last = Math.min(first + step, width) - 1;
    centreX[column] = (first + last) / 2;
  }

  for (let row = 0; row < rows; row += 1) {
    const first = row * step;
    const last = Math.min(first + step, height) - 1;
    centreY[row] = (first + last) / 2;
  }

  if (step === 1) {
    values.set(pixels.subarray(0, width * height));
    return { centreX, centreY, columns, rows, step, values };
  }

  for (let row = 0; row < rows; row += 1) {
    const rowEnd = Math.min((row + 1) * step, height);

    for (let column = 0; column < columns; column += 1) {
      const columnEnd = Math.min((column + 1) * step, width);
      let sum = 0;
      let count = 0;
      let minimum = Infinity;
      let maximum = -Infinity;

      for (let y = row * step; y < rowEnd; y += 1) {
        for (let x = column * step; x < columnEnd; x += 1) {
          const value = pixels[y * width + x];

          if (!Number.isFinite(value)) {
            continue;
          }

          sum += value;
          count += 1;
          if (value < minimum) minimum = value;
          if (value > maximum) maximum = value;
        }
      }

      if (count === 0) {
        values[row * columns + column] = Number.NaN;
        continue;
      }

      const mean = sum / count;
      values[row * columns + column] = maximum - mean >= mean - minimum ? maximum : minimum;
    }
  }

  return { centreX, centreY, columns, rows, step, values };
}

export type SurfaceLayout = {
  /** half the footprint's size along x and y, in local units */
  halfX: number;
  halfY: number;
  /** local units per pixel along x and y */
  scaleX: number;
  scaleY: number;
};

export function surfaceLayout(width: number, height: number, pixelAspect = 1): SurfaceLayout {
  const spanX = Math.max(width - 1, 1);
  const spanY = Math.max(height - 1, 1) * pixelAspect;
  const longest = Math.max(spanX, spanY);
  const scaleX = 1 / longest;
  const scaleY = pixelAspect / longest;

  return {
    halfX: ((width - 1) / 2) * scaleX,
    halfY: ((height - 1) / 2) * scaleY,
    scaleX,
    scaleY,
  };
}

export function localX(column: number, width: number, layout: SurfaceLayout) {
  return (column - (width - 1) / 2) * layout.scaleX;
}

export function localY(row: number, height: number, layout: SurfaceLayout) {
  return ((height - 1) / 2 - row) * layout.scaleY;
}

/** A value's elevation, 0 at the frame's min and 1 at its max; NaN sits on the floor. */
export function normaliseValue(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const span = max - min || 1;
  return Math.min(Math.max((value - min) / span, 0), 1);
}

export type SurfaceArrays = {
  index: Uint16Array | Uint32Array;
  /** uv into the full-resolution colormapped image, pixel centres */
  imageUv: Float32Array;
  position: Float32Array;
  /** uv into a 1D colormap texture: u is the normalised value */
  valueUv: Float32Array;
};

/** The landscape grid: one vertex per reduced pixel, two triangles per cell, facing +z. */
export function buildSurfaceArrays(
  reduced: ReducedFrame,
  width: number,
  height: number,
  min: number,
  max: number,
  layout: SurfaceLayout,
): SurfaceArrays {
  const { columns, rows, values, centreX, centreY } = reduced;
  const vertexCount = columns * rows;
  const position = new Float32Array(vertexCount * 3);
  const valueUv = new Float32Array(vertexCount * 2);
  const imageUv = new Float32Array(vertexCount * 2);

  for (let row = 0; row < rows; row += 1) {
    const y = localY(centreY[row], height, layout);
    const v = 1 - (centreY[row] + 0.5) / height;

    for (let column = 0; column < columns; column += 1) {
      const vertex = row * columns + column;
      const elevation = normaliseValue(values[vertex], min, max);

      position[vertex * 3] = localX(centreX[column], width, layout);
      position[vertex * 3 + 1] = y;
      position[vertex * 3 + 2] = elevation;
      valueUv[vertex * 2] = elevation;
      valueUv[vertex * 2 + 1] = 0.5;
      imageUv[vertex * 2] = (centreX[column] + 0.5) / width;
      imageUv[vertex * 2 + 1] = v;
    }
  }

  const cellCount = Math.max(columns - 1, 0) * Math.max(rows - 1, 0);
  const index = vertexCount > 65535 ? new Uint32Array(cellCount * 6) : new Uint16Array(cellCount * 6);
  let cursor = 0;

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;

      // x grows with the column and y falls with the row, so (a, c, b) winds
      // counter-clockwise seen from +z
      index[cursor++] = a;
      index[cursor++] = c;
      index[cursor++] = b;
      index[cursor++] = b;
      index[cursor++] = c;
      index[cursor++] = d;
    }
  }

  return { index, imageUv, position, valueUv };
}

/** The frame pixel under a local point on the landscape, wherever the mesh was sampled. */
export function pixelFromLocal(
  x: number,
  y: number,
  width: number,
  height: number,
  layout: SurfaceLayout,
) {
  const column = Math.round(x / layout.scaleX + (width - 1) / 2);
  const row = Math.round((height - 1) / 2 - y / layout.scaleY);

  return {
    column: Math.min(Math.max(column, 0), width - 1),
    row: Math.min(Math.max(row, 0), height - 1),
  };
}

/** Round tick values (1, 2 or 5 × 10ⁿ apart) inside [min, max], about `target` of them. */
export function niceTicks(min: number, max: number, target = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [];
  }

  if (max <= min) {
    return [min];
  }

  const rough = (max - min) / Math.max(target, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const spacing = (residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10) * magnitude;
  const first = Math.ceil(min / spacing - 1e-9) * spacing;
  const ticks: number[] = [];

  for (let tick = first; tick <= max + spacing * 1e-9; tick += spacing) {
    // snap away float drift such as 0.30000000000000004
    ticks.push(Number(tick.toPrecision(12)));
  }

  return ticks;
}

/** Ticks on a pixel axis: whole pixel indices from 0 to count − 1. */
export function pixelTicks(count: number, target = 5) {
  return niceTicks(0, Math.max(count - 1, 0), target).filter((tick) => Number.isInteger(tick));
}
