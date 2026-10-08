import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { colormappedFrameRgba } from "./colormaps.ts";
import { flipRow, pixelAtRatio, pixelAxisTicks } from "./image-axes.ts";

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
    assert.equal(pixelAtRatio(0.5, 2, 3.5, 100), 3);
  });
});

describe("pixelAxisTicks", () => {
  it("ticks whole pixels across the full frame", () => {
    assert.deepEqual(pixelAxisTicks(0, 8, 5), [0, 2, 4, 6]);
    assert.deepEqual(pixelAxisTicks(0, 5, 5), [0, 1, 2, 3, 4]);
  });

  it("ticks only the pixels whose centres are in a zoomed region", () => {
    // pixels 10 to 15 have centres 10.5 to 15.5, inside 10.4 to 16.4
    assert.deepEqual(pixelAxisTicks(10.4, 6, 5), [10, 11, 12, 13, 14, 15]);
  });

  it("starts a row axis at the region's bottom edge", () => {
    // canvas rows 20 to 30 of a 100-row frame are frame rows 70 to 79
    assert.deepEqual(pixelAxisTicks(100 - 20 - 10, 10, 5), [70, 72, 74, 76, 78]);
  });
});
