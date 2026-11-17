import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";

import { cross, dot, length, type Vec3 } from "./quaternion.ts";

const coord = fc.double({ min: -1e3, max: 1e3, noNaN: true });
const vec: fc.Arbitrary<Vec3> = fc.tuple(coord, coord, coord);

describe("cross", () => {
  it("follows the right-hand rule", () => {
    assert.deepEqual(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  });

  it("is perpendicular to both inputs", () => {
    fc.assert(
      fc.property(vec, vec, (a, b) => {
        const c = cross(a, b);
        // Rounding error in dot(c, a) grows like |a|²|b|; the 1 + keeps the
        // tolerance from underflowing to 0 on subnormal inputs.
        const tolerance =
          1e-12 * (1 + length(a) * length(b) * Math.max(length(a), length(b)));
        assert.ok(Math.abs(dot(c, a)) <= tolerance);
        assert.ok(Math.abs(dot(c, b)) <= tolerance);
      }),
    );
  });
});
