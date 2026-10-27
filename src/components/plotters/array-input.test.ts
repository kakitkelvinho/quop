import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { arraySeries, parseNumberArray } from "./array-input.ts";

describe("parseNumberArray", () => {
  it("reads a JSON array or a list split by spaces or commas", () => {
    assert.deepEqual(parseNumberArray("[0, 1.5, -2]"), [0, 1.5, -2]);
    assert.deepEqual(parseNumberArray("0 1.5, -2\n3"), [0, 1.5, -2, 3]);
    assert.deepEqual(parseNumberArray("  "), []);
  });

  it("rejects anything but finite numbers", () => {
    assert.throws(() => parseNumberArray("1, abc"), /only finite numbers/);
    assert.throws(() => parseNumberArray('["1", "x"]'), /only finite numbers/);
    assert.throws(() => parseNumberArray("[1, 2"));
  });
});

describe("arraySeries", () => {
  it("pairs x and y into points", () => {
    const series = arraySeries("[0, 1, 2]", "0 1 4");

    assert.equal(series.error, null);
    assert.deepEqual(series.points, [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 4 },
    ]);
  });

  it("asks for values in both arrays, of the same length", () => {
    assert.equal(arraySeries("", "1").error, "Enter at least one value in both arrays.");
    assert.equal(arraySeries("1 2", "1").error, "x and y need the same number of entries.");
    assert.deepEqual(
      [arraySeries("1 2", "1").xCount, arraySeries("1 2", "1").yCount],
      [2, 1],
    );
  });

  it("reports an unreadable array as its error", () => {
    const series = arraySeries("1, x", "1, 2");

    assert.equal(series.error, "Arrays must contain only finite numbers.");
    assert.deepEqual(series.points, []);
  });
});
