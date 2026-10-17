import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { angleOf, arcPath, fraction, percent, pointAt, snap, valueAt, valueForKey, type DialArc } from "./rim-dial.ts";

const RANGE = [0.5, 2] as const;
const STEP = 0.05;
// the whole lower half, low end on the left
const HALF: DialArc = { r: 100, from: Math.PI, to: 0 };

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

describe("fraction", () => {
  it("is 0 at the low end, 1 at the high, and held to the ends", () => {
    assert.equal(fraction(0.5, RANGE), 0);
    assert.equal(fraction(2, RANGE), 1);
    close(fraction(1.25, RANGE), 0.5);
    assert.equal(fraction(0.1, RANGE), 0);
    assert.equal(fraction(9, RANGE), 1);
  });
});

describe("angleOf", () => {
  it("puts the low end at `from`, the high end at `to`, the middle at the bottom", () => {
    close(angleOf(0.5, RANGE, HALF), Math.PI);
    close(angleOf(2, RANGE, HALF), 0);
    close(angleOf(1.25, RANGE, HALF), Math.PI / 2);
  });

  it("follows an arc that runs the other way", () => {
    close(angleOf(0.5, RANGE, { r: 10, from: 0, to: Math.PI }), 0);
    close(angleOf(2, RANGE, { r: 10, from: 0, to: Math.PI }), Math.PI);
  });
});

describe("snap", () => {
  it("rounds to the step from the low end, without float dust", () => {
    assert.equal(snap(1.02, RANGE, STEP), 1);
    assert.equal(snap(1.03, RANGE, STEP), 1.05);
    assert.equal(snap(0.1 + 0.2, [0.25, 2], STEP), 0.3);
  });

  it("holds the value to its range", () => {
    assert.equal(snap(0.2, RANGE, STEP), 0.5);
    assert.equal(snap(3, RANGE, STEP), 2);
  });
});

describe("valueAt", () => {
  it("reads the value under a point on the arc", () => {
    assert.equal(valueAt(-100, 0, RANGE, HALF, STEP), 0.5);
    assert.equal(valueAt(100, 0, RANGE, HALF, STEP), 2);
    assert.equal(valueAt(0, 100, RANGE, HALF, STEP), 1.25);
    const [x, y] = pointAt(100, angleOf(1.7, RANGE, HALF));
    assert.equal(valueAt(x, y, RANGE, HALF, STEP), 1.7);
  });

  it("ignores how far from the centre the point is", () => {
    assert.equal(valueAt(0, 5, RANGE, HALF, STEP), 1.25);
    assert.equal(valueAt(-300, 300, RANGE, HALF, STEP), valueAt(-30, 30, RANGE, HALF, STEP));
  });

  it("holds a drag above the centre line at the nearer end", () => {
    assert.equal(valueAt(-50, -80, RANGE, HALF, STEP), 0.5);
    assert.equal(valueAt(50, -80, RANGE, HALF, STEP), 2);
  });

  it("holds a point past the ends of a shorter arc at those ends", () => {
    const arc: DialArc = { r: 100, from: (3 * Math.PI) / 4, to: Math.PI / 4 };
    assert.equal(valueAt(-100, 1, RANGE, arc, STEP), 0.5);
    assert.equal(valueAt(100, 1, RANGE, arc, STEP), 2);
    assert.equal(valueAt(0, 100, RANGE, arc, STEP), 1.25);
  });
});

describe("valueForKey", () => {
  it("steps with the arrows: right and up raise, left and down lower", () => {
    assert.equal(valueForKey("ArrowRight", 1, RANGE, STEP), 1.05);
    assert.equal(valueForKey("ArrowUp", 1, RANGE, STEP), 1.05);
    assert.equal(valueForKey("ArrowLeft", 1, RANGE, STEP), 0.95);
    assert.equal(valueForKey("ArrowDown", 1, RANGE, STEP), 0.95);
  });

  it("goes ten steps with Page Up/Down and to the ends with Home/End", () => {
    assert.equal(valueForKey("PageUp", 1, RANGE, STEP), 1.5);
    assert.equal(valueForKey("PageDown", 1, RANGE, STEP), 0.5);
    assert.equal(valueForKey("Home", 1, RANGE, STEP), 0.5);
    assert.equal(valueForKey("End", 1, RANGE, STEP), 2);
  });

  it("stops at the ends", () => {
    assert.equal(valueForKey("ArrowRight", 2, RANGE, STEP), 2);
    assert.equal(valueForKey("PageDown", 0.6, RANGE, STEP), 0.5);
  });

  it("leaves other keys alone", () => {
    assert.equal(valueForKey("Enter", 1, RANGE, STEP), null);
    assert.equal(valueForKey(" ", 1, RANGE, STEP), null);
    assert.equal(valueForKey("Escape", 1, RANGE, STEP), null);
  });
});

describe("arcPath", () => {
  it("runs round the bottom from the left end to the right", () => {
    const d = arcPath(10, Math.PI, 0);
    assert.match(d, /^M-10 1\.2\d*e-15A10 10 0 0 0 10 0$/);
  });

  it("sweeps the other way for an arc drawn left to right in angle", () => {
    assert.match(arcPath(10, 0, Math.PI / 2), /A10 10 0 0 1 /);
  });
});

describe("percent", () => {
  it("reads a value as a whole percentage", () => {
    assert.equal(percent(1), "100%");
    assert.equal(percent(0.25), "25%");
    assert.equal(percent(1.234), "123%");
  });
});
