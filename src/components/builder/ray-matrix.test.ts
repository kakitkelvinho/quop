import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";

import { curvedInterface, determinant, flatInterface, freeSpace, multiply, type RayMatrix, thinLens } from "./ray-matrix.ts";

const distance = fc.double({ min: 0, max: 1e3, noNaN: true });
const focal = fc.double({ min: 1, max: 1e3, noNaN: true }).chain((f) => fc.boolean().map((neg) => (neg ? -f : f)));
const radius = focal;
const index = fc.double({ min: 1, max: 3, noNaN: true });

function near(actual: number, expected: number, relative = 1e-9) {
  const tolerance = relative * Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

describe("ray matrices", () => {
  it("free space and a thin lens have det 1", () => {
    fc.assert(
      fc.property(distance, focal, (d, f) => {
        near(determinant(freeSpace(d)), 1);
        near(determinant(thinLens(f)), 1);
      }),
    );
  });

  it("an interface from n₁ to n₂ has det n₁/n₂, flat or curved; 1 in air", () => {
    fc.assert(
      fc.property(index, index, radius, (n1, n2, r) => {
        near(determinant(flatInterface(n1, n2)), n1 / n2);
        near(determinant(curvedInterface(n1, n2, r)), n1 / n2);
      }),
    );
    near(determinant(flatInterface(1, 1)), 1);
  });

  it("det of a product is the product of the dets", () => {
    fc.assert(
      fc.property(index, index, distance, focal, radius, (n1, n2, d, f, r) => {
        const system = [flatInterface(n1, n2), freeSpace(d), thinLens(f), curvedInterface(n2, n1, r)];
        const total = system.reduce<RayMatrix>((acc, m) => multiply(m, acc), freeSpace(0));
        near(determinant(total), 1, 1e-8);
      }),
    );
  });

  it("a ray through a lens crosses the axis one focal length on", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 10, noNaN: true }), fc.double({ min: 10, max: 500, noNaN: true }), (height, f) => {
        const m = multiply(freeSpace(f), thinLens(f));
        near(m.a * height, 0, 1e-9);
      }),
    );
  });

  it("two thin lenses at distance d have c = −(1/f₁ + 1/f₂ − d/(f₁f₂))", () => {
    fc.assert(
      fc.property(focal, focal, distance, (f1, f2, d) => {
        const m = multiply(thinLens(f2), multiply(freeSpace(d), thinLens(f1)));
        near(m.c, -(1 / f1 + 1 / f2 - d / (f1 * f2)), 1e-8);
      }),
    );
  });

  it("running an element backwards takes the same matrix: its inverse has det 1/det", () => {
    fc.assert(
      fc.property(index, index, radius, (n1, n2, r) => {
        const m = curvedInterface(n1, n2, r);
        const det = determinant(m);
        const inverse: RayMatrix = { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det };
        const identity = multiply(inverse, m);
        near(identity.a, 1);
        near(identity.d, 1);
        near(identity.b, 0);
        near(identity.c, 0);
      }),
    );
  });
});
