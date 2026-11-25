import assert from "node:assert/strict";
import { it } from "node:test";

import type { Field } from "./polarization.ts";
import { polarizationEllipse, polarizationMarkGeometry, polarizationMarkSegments } from "./polarization-marks.ts";
import type { TraceResult } from "./trace-scene.ts";

const c = (re: number, im = 0) => ({ re, im });
const close = (actual: number[], expected: number[]) =>
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-9, `${actual} vs ${expected}`));

it("draws horizontal linear light as a double arrow along the table", () => {
  const field: Field = [c(0), c(0), c(1)];
  const ellipse = polarizationEllipse(field)!;
  assert.equal(ellipse.shape, "linear");
  close(ellipse.major.map(Math.abs), [0, 0, 1]);
  // the shaft and two arrowheads of two strokes each
  assert.equal(polarizationMarkSegments(ellipse, [0, 0, 0], [1, 0, 0]).length, 2 * 5);
});

it("draws vertical linear light standing up from the table", () => {
  const ellipse = polarizationEllipse([c(0), c(Math.SQRT1_2, Math.SQRT1_2), c(0)])!;
  assert.equal(ellipse.shape, "linear");
  close(ellipse.major.map(Math.abs), [0, 1, 0]);
});

it("draws circular light as a circle whose arrowhead follows the field's turn", () => {
  // E = (z + i y)/√2 travelling along +x: Re(E e^{-iωt}) turns from +z toward +y
  const field: Field = [c(0), c(0, Math.SQRT1_2), c(Math.SQRT1_2)];
  const ellipse = polarizationEllipse(field)!;
  assert.equal(ellipse.shape, "elliptical");
  const turn = [
    ellipse.major[1] * ellipse.minor[2] - ellipse.major[2] * ellipse.minor[1],
  ];
  // major × minor points along -x for a z → y turn
  assert.ok(turn[0] < 0);
  close([Math.hypot(...ellipse.minor)], [1]);
});

it("marks each traced segment where it leaves and where it arrives", () => {
  const trace: TraceResult = {
    trees: [{ laserId: "laser", segments: [
      { fromMm: [0, 100, 0], toMm: [200, 100, 0], fromId: "laser", toId: "mirror", path: ["laser", "mirror"], power: 1, pathLengthMm: 200, arm: "through", field: [c(0), c(0), c(1)] },
      { fromMm: [200, 100, 0], toMm: [200, 100, 500], fromId: "mirror", toId: null, path: ["laser", "mirror"], power: 1, pathLengthMm: 700, arm: "reflected", field: [c(1), c(0), c(0)] },
    ] }],
    checks: [], matchedDrawnBeamIds: [],
  };
  const marks = polarizationMarkGeometry(trace);
  // two marks on the first segment, one on the open second, ten points each
  assert.equal(marks.laserIds.length, 3 * 10);
  assert.equal(polarizationMarkGeometry(trace, (segment) => segment.toId === null).laserIds.length, 2 * 10);
});
