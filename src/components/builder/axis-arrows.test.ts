import assert from "node:assert/strict";
import { test } from "node:test";
import { axisArrows, type Quaternion } from "./axis-arrows.ts";

const byAxis = (camera: Quaternion) => Object.fromEntries(axisArrows(camera).map((arrow) => [arrow.axis, arrow]));
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test("a camera looking down -Z shows X right, Y up and Z at the viewer", () => {
  const { x, y, z } = byAxis([0, 0, 0, 1]);
  near(x.dx, 1); near(x.dy, 0);
  near(y.dx, 0); near(y.dy, -1);
  near(z.depth, 1);
});

test("turning the camera a quarter turn about Y swings +Z to the right", () => {
  // camera at +X looking at the origin: a +90° turn about Y
  const s = Math.SQRT1_2;
  const { x, z } = byAxis([0, s, 0, s]);
  near(z.dx, -1);
  near(x.depth, 1);
});

test("arrows come back furthest first", () => {
  const depths = axisArrows([0.2, 0.5, 0.1, 0.83].map((v, _, all) => v / Math.hypot(...all)) as unknown as Quaternion).map((a) => a.depth);
  assert.deepEqual(depths, [...depths].sort((a, b) => a - b));
});
