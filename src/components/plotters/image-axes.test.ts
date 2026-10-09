import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { colormappedFrameRgba } from "./colormaps.ts";
import {
  flipRow,
  normalizeViewport,
  pixelAtRatio,
  pixelAxisTicks,
  zoomViewport,
} from "./image-axes.ts";

describe("flipRow", () => {
  it("swaps the bottom and top rows and is its own inverse", () => {
    assert.equal(flipRow(0, 5), 4);
    assert.equal(flipRow(4, 5), 0);
    assert.equal(flipRow(2, 5), 2);
    assert.equal(flipRow(flipRow(1, 5), 5), 1);
  });
});

describe("colormappedFrameRgba", () => {
  it("paints the frame's row 0 on the last scanline", () => {
    const frame = { height: 2, max: 3, min: 0, pixels: new Float32Array([0, 1, 2, 3]), width: 2 };

    assert.deepEqual(
      Array.from(colormappedFrameRgba(frame, "gray")),
      [
        170, 170, 170, 255, 255, 255, 255, 255,
        0, 0, 0, 255, 85, 85, 85, 255,
      ],
    );
  });
});

describe("pixelAtRatio", () => {
  it("gives every drawn cell its own pixel, the last one included", () => {
    const centres = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5].map((centre) => centre / 8);

    assert.deepEqual(
      centres.map((ratio) => pixelAtRatio(ratio, 0, 8, 8)),
      [0, 1, 2, 3, 4, 5, 6, 7],
    );
    assert.equal(pixelAtRatio(0.99, 0, 8, 8), 7);
  });

  it("clamps the far edge into the frame", () => {
    assert.equal(pixelAtRatio(0, 0, 8, 8), 0);
    assert.equal(pixelAtRatio(1, 0, 8, 8), 7);
  });

  it("offsets into a zoomed region", () => {
    // the middle of pixels 2 to 5 is the edge between 3 and 4, so it reads 4
    assert.equal(pixelAtRatio(0.5, 2, 4, 100), 4);
  });
});

describe("pixelAxisTicks", () => {
  it("ticks whole pixels across the full frame", () => {
    assert.deepEqual(pixelAxisTicks(0, 8, 5), [0, 2, 4, 6]);
    assert.deepEqual(pixelAxisTicks(0, 5, 5), [0, 1, 2, 3, 4]);
  });

  it("ticks only the pixels in a zoomed region", () => {
    // pixels 10 to 15 have centres 10.5 to 15.5
    assert.deepEqual(pixelAxisTicks(10, 6, 5), [10, 11, 12, 13, 14, 15]);
  });

  it("starts a row axis at the region's bottom edge", () => {
    // canvas rows 20 to 30 of a 100-row frame are frame rows 70 to 79
    assert.deepEqual(pixelAxisTicks(100 - 20 - 10, 10, 5), [70, 72, 74, 76, 78]);
  });
});

// A 9 x 7 frame, as in the Image view probes. Whatever the viewport, the canvas
// holds exactly viewport.width x viewport.height cells, so a viewport that
// starts or ends between pixels would drop or double a row or column.
const FRAME = { height: 7, width: 9 };

describe("normalizeViewport", () => {
  it("snaps a dragged box to the nearest pixel edges", () => {
    // a drag over 0.05-0.40 across and 0.55-0.97 down the full 9 x 7 view
    assert.deepEqual(normalizeViewport(FRAME, 0.45, 3.85, 3.15, 2.94), {
      height: 3,
      left: 0,
      top: 4,
      width: 4,
    });
  });

  it("leaves a whole-pixel viewport as it is", () => {
    assert.deepEqual(normalizeViewport(FRAME, 0, 0, 9, 7), { height: 7, left: 0, top: 0, width: 9 });
    assert.deepEqual(normalizeViewport(FRAME, 2, 1, 4, 3), { height: 3, left: 2, top: 1, width: 4 });
  });

  it("keeps at least one whole pixel, inside the frame", () => {
    // a sliver that snaps to nothing still shows the pixel it sits on
    assert.deepEqual(normalizeViewport(FRAME, 2.7, 3.1, 0.2, 0.1), { height: 1, left: 3, top: 3, width: 1 });
    // a sliver at the far edge shifts back in
    assert.deepEqual(normalizeViewport(FRAME, 9, 7, 0.2, 0.2), { height: 1, left: 8, top: 6, width: 1 });
  });
});

describe("zoomViewport", () => {
  it("zooms in one step onto whole pixels", () => {
    // 0.8 of 9 x 7 is 7.2 x 5.6, which is 7 x 6 pixels about the centre
    assert.deepEqual(zoomViewport(FRAME, { height: 7, left: 0, top: 0, width: 9 }, 0.8), {
      height: 6,
      left: 1,
      top: 1,
      width: 7,
    });
  });

  it("keeps zooming in, a pixel or more a step, down to one pixel", () => {
    const sizes = [];
    let viewport = { height: 7, left: 0, top: 0, width: 9 };

    for (let step = 0; step < 8; step += 1) {
      sizes.push([viewport.width, viewport.height]);
      viewport = zoomViewport(FRAME, viewport, 0.8);
    }

    assert.deepEqual(sizes, [[9, 7], [7, 6], [6, 5], [5, 4], [4, 3], [3, 2], [2, 1], [1, 1]]);
  });

  it("zooms out about the centre", () => {
    assert.deepEqual(zoomViewport(FRAME, { height: 3, left: 2, top: 1, width: 4 }, 1.25), {
      height: 4,
      left: 2,
      top: 1,
      width: 5,
    });
  });

  it("zooms out from a corner by sliding back into the frame, not by shrinking", () => {
    assert.deepEqual(zoomViewport(FRAME, { height: 3, left: 0, top: 0, width: 4 }, 1.25), {
      height: 4,
      left: 0,
      top: 0,
      width: 5,
    });
    assert.deepEqual(zoomViewport(FRAME, { height: 7, left: 0, top: 0, width: 9 }, 1.25), {
      height: 7,
      left: 0,
      top: 0,
      width: 9,
    });
  });

  it("keeps growing when a single pixel's zoom out rounds to no change", () => {
    assert.deepEqual(zoomViewport(FRAME, { height: 1, left: 4, top: 3, width: 1 }, 1.25), {
      height: 2,
      left: 4,
      top: 3,
      width: 2,
    });
  });
});

describe("the viewport, hover and ticks together", () => {
  // each canvas cell's centre, as a share of the canvas
  const centres = (count: number) => Array.from({ length: count }, (_, index) => (index + 0.5) / count);

  it("reads every drawn cell of a zoomed view as its own pixel, one step in", () => {
    const viewport = zoomViewport(FRAME, { height: 7, left: 0, top: 0, width: 9 }, 0.8);

    // columns left to right, then frame rows top to bottom (row 0 at the bottom)
    assert.deepEqual(
      centres(viewport.width).map((ratio) => pixelAtRatio(ratio, viewport.left, viewport.width, FRAME.width)),
      [1, 2, 3, 4, 5, 6, 7],
    );
    assert.deepEqual(
      centres(viewport.height).map((ratio) =>
        flipRow(pixelAtRatio(ratio, viewport.top, viewport.height, FRAME.height), FRAME.height),
      ),
      [5, 4, 3, 2, 1, 0],
    );
    assert.deepEqual(pixelAxisTicks(viewport.left, viewport.width, 5), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(
      pixelAxisTicks(FRAME.height - viewport.top - viewport.height, viewport.height, 5),
      [0, 1, 2, 3, 4, 5],
    );
  });

  it("reads every drawn cell of a dragged view as its own pixel", () => {
    const viewport = normalizeViewport(FRAME, 0.45, 3.85, 3.15, 2.94);

    assert.deepEqual(
      centres(viewport.width).map((ratio) => pixelAtRatio(ratio, viewport.left, viewport.width, FRAME.width)),
      [0, 1, 2, 3],
    );
    assert.deepEqual(
      centres(viewport.height).map((ratio) =>
        flipRow(pixelAtRatio(ratio, viewport.top, viewport.height, FRAME.height), FRAME.height),
      ),
      [2, 1, 0],
    );
    assert.deepEqual(pixelAxisTicks(viewport.left, viewport.width, 5), [0, 1, 2, 3]);
    assert.deepEqual(
      pixelAxisTicks(FRAME.height - viewport.top - viewport.height, viewport.height, 5),
      [0, 1, 2],
    );
  });

  it("puts each tick label over the cell whose pixel it names", () => {
    const viewport = zoomViewport(FRAME, { height: 7, left: 0, top: 0, width: 9 }, 0.8);

    for (const tick of pixelAxisTicks(viewport.left, viewport.width, 5)) {
      const ratio = (tick + 0.5 - viewport.left) / viewport.width;

      assert.equal(pixelAtRatio(ratio, viewport.left, viewport.width, FRAME.width), tick);
    }

    for (const tick of pixelAxisTicks(FRAME.height - viewport.top - viewport.height, viewport.height, 5)) {
      const ratio = (flipRow(tick, FRAME.height) + 0.5 - viewport.top) / viewport.height;

      assert.equal(
        flipRow(pixelAtRatio(ratio, viewport.top, viewport.height, FRAME.height), FRAME.height),
        tick,
      );
    }
  });
});
