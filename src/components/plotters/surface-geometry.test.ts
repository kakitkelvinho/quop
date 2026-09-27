import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSurfaceArrays,
  chooseSurfaceStep,
  niceTicks,
  pixelFromLocal,
  pixelTicks,
  reduceFrame,
  surfaceLayout,
} from "./surface-geometry.ts";

function frame(width: number, height: number, fill = 0) {
  return new Float32Array(width * height).fill(fill);
}

describe("chooseSurfaceStep", () => {
  it("keeps the lab's frame sizes at full resolution", () => {
    assert.equal(chooseSurfaceStep(51, 51), 1);
    assert.equal(chooseSurfaceStep(1600, 200), 1);
  });

  it("halves a megapixel frame", () => {
    assert.equal(chooseSurfaceStep(1024, 1024), 2);
  });

  it("finds the smallest step within the budget", () => {
    assert.equal(chooseSurfaceStep(10, 10, 25), 2);
    assert.equal(chooseSurfaceStep(10, 10, 24), 3);
  });
});

describe("reduceFrame", () => {
  it("keeps a one-pixel peak at its true height", () => {
    const pixels = frame(4, 4, 1);
    pixels[1 * 4 + 2] = 100;
    const reduced = reduceFrame(pixels, 4, 4, 2);

    assert.equal(reduced.columns, 2);
    assert.equal(reduced.rows, 2);
    assert.deepEqual(Array.from(reduced.values), [1, 100, 1, 1]);
  });

  it("keeps a one-pixel dip at its true depth", () => {
    const pixels = frame(2, 2, 10);
    pixels[3] = -5;

    assert.deepEqual(Array.from(reduceFrame(pixels, 2, 2, 2).values), [-5]);
  });

  it("gives partial edge blocks their own centres", () => {
    const reduced = reduceFrame(frame(5, 3), 5, 3, 2);

    assert.deepEqual(Array.from(reduced.centreX), [0.5, 2.5, 4]);
    assert.deepEqual(Array.from(reduced.centreY), [0.5, 2]);
  });

  it("skips NaNs and leaves an all-NaN block NaN", () => {
    const pixels = new Float32Array([Number.NaN, 3, Number.NaN, Number.NaN]);
    const reduced = reduceFrame(pixels, 4, 1, 2);

    assert.equal(reduced.values[0], 3);
    assert.ok(Number.isNaN(reduced.values[1]));
  });

  it("copies the frame through at step 1", () => {
    const pixels = new Float32Array([1, 2, 3, 4, 5, 6]);

    assert.deepEqual(Array.from(reduceFrame(pixels, 3, 2, 1).values), [1, 2, 3, 4, 5, 6]);
  });
});

describe("surfaceLayout", () => {
  it("keeps true pixel aspect with the longer side 1 long", () => {
    const layout = surfaceLayout(1601, 201, "true");

    assert.equal(layout.halfX, 0.5);
    assert.equal(layout.halfY, 0.0625);
  });

  it("stretches to a unit square on request", () => {
    const layout = surfaceLayout(1601, 201, "square");

    assert.equal(layout.halfX, 0.5);
    assert.equal(layout.halfY, 0.5);
  });
});

describe("buildSurfaceArrays", () => {
  it("lays row 0 along the far (+y) edge and the value along z", () => {
    const pixels = new Float32Array([0, 1, 2, 3]);
    const layout = surfaceLayout(2, 2, "true");
    const arrays = buildSurfaceArrays(reduceFrame(pixels, 2, 2, 1), 2, 2, 0, 3, layout);

    // vertex 0 is pixel (0, 0): left, far, floor
    assert.deepEqual(Array.from(arrays.position.subarray(0, 3)), [-0.5, 0.5, 0]);
    // vertex 3 is pixel (1, 1): right, near, top
    assert.deepEqual(Array.from(arrays.position.subarray(9, 12)), [0.5, -0.5, 1]);
    assert.deepEqual(Array.from(arrays.valueUv.subarray(6, 8)), [1, 0.5]);
    assert.deepEqual(Array.from(arrays.imageUv.subarray(0, 2)), [0.25, 0.75]);
  });

  it("winds every triangle to face +z", () => {
    const layout = surfaceLayout(3, 3, "true");
    const { index, position } = buildSurfaceArrays(reduceFrame(frame(3, 3), 3, 3, 1), 3, 3, 0, 1, layout);

    assert.equal(index.length, 2 * 2 * 6);

    for (let triangle = 0; triangle < index.length; triangle += 3) {
      const [a, b, c] = [index[triangle], index[triangle + 1], index[triangle + 2]];
      const abx = position[b * 3] - position[a * 3];
      const aby = position[b * 3 + 1] - position[a * 3 + 1];
      const acx = position[c * 3] - position[a * 3];
      const acy = position[c * 3 + 1] - position[a * 3 + 1];

      assert.ok(abx * acy - aby * acx > 0, `triangle ${triangle / 3} faces down`);
    }
  });

  it("needs a 32-bit index past 65,535 vertices", () => {
    const layout = surfaceLayout(300, 300, "true");
    const small = buildSurfaceArrays(reduceFrame(frame(51, 51), 51, 51, 1), 51, 51, 0, 1, layout);
    const large = buildSurfaceArrays(reduceFrame(frame(300, 300), 300, 300, 1), 300, 300, 0, 1, layout);

    assert.ok(small.index instanceof Uint16Array);
    assert.ok(large.index instanceof Uint32Array);
  });
});

describe("pixelFromLocal", () => {
  it("inverts the layout, clamped to the frame", () => {
    const layout = surfaceLayout(1600, 200, "true");
    const x = (37 - 1599 / 2) * layout.scaleX;
    const y = (199 / 2 - 150) * layout.scaleY;

    assert.deepEqual(pixelFromLocal(x, y, 1600, 200, layout), { column: 37, row: 150 });
    assert.deepEqual(pixelFromLocal(9, -9, 1600, 200, layout), { column: 1599, row: 199 });
  });
});

describe("ticks", () => {
  it("picks 1, 2 or 5 × 10ⁿ spacings", () => {
    assert.deepEqual(niceTicks(0, 50), [0, 10, 20, 30, 40, 50]);
    assert.deepEqual(niceTicks(0.1, 0.9, 4), [0.2, 0.4, 0.6, 0.8]);
    assert.deepEqual(niceTicks(-3, 7), [-2, 0, 2, 4, 6]);
  });

  it("keeps pixel ticks on whole pixels", () => {
    assert.deepEqual(pixelTicks(51), [0, 10, 20, 30, 40, 50]);
    assert.deepEqual(pixelTicks(3), [0, 0.5, 1, 1.5, 2].filter(Number.isInteger));
  });
});
