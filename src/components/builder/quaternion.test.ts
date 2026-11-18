import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";
import * as THREE from "three";

import {
  canonical,
  compose,
  cross,
  dot,
  fromEulerYXZDeg,
  fromYawDeg,
  fromYawPitchRollDeg,
  IDENTITY,
  invert,
  length,
  normalize,
  type Quat,
  rotate,
  toEulerYXZDeg,
  toYawPitchRollDeg,
  type Vec3,
} from "./quaternion.ts";

const EPS = 1e-9;

const coord = fc.double({ min: -1e3, max: 1e3, noNaN: true });
const vec: fc.Arbitrary<Vec3> = fc.tuple(coord, coord, coord);

const unit = fc.double({ min: -1, max: 1, noNaN: true });
// Raw quaternions too short to normalize well aren't rotations anyone stores.
const rawQuat: fc.Arbitrary<Quat> = fc.tuple(unit, unit, unit, unit).filter((q) => Math.hypot(...q) > 0.1);
const quat = rawQuat.map(canonical);

const yawDeg = fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true });
const rollDeg = fc.double({ min: -180, max: 180, minExcluded: true, noNaN: true });
const pitchDeg = fc.double({ min: -89, max: 89, noNaN: true });

function assertNear(actual: number, expected: number, tolerance = EPS) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

function assertNearVec(actual: readonly number[], expected: readonly number[], tolerance = EPS) {
  actual.forEach((a, i) => assertNear(a, expected[i], tolerance));
}

/** How far apart two angles are, degrees, the short way round. */
function angleGapDeg(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return Math.min(gap, 360 - gap);
}

function assertSameRotation(a: Quat, b: Quat) {
  // q and −q are one rotation, so compare |a·b| with 1.
  assertNear(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]), 1);
}

function assertStored(q: Quat) {
  assertNear(Math.hypot(...q), 1);
  assert.ok(q[3] >= 0, `w = ${q[3]} is negative`);
}

describe("vectors", () => {
  it("measures length", () => {
    assert.equal(length([3, 4, 0]), 5);
  });

  it("follows the right-hand rule", () => {
    assert.deepEqual(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  });

  it("crosses to a vector perpendicular to both inputs", () => {
    fc.assert(
      fc.property(vec, vec, (a, b) => {
        const c = cross(a, b);
        // Rounding error in dot(c, a) grows like |a|²|b|; the 1 + keeps the
        // tolerance from underflowing to 0 on subnormal inputs.
        const tolerance = 1e-12 * (1 + length(a) * length(b) * Math.max(length(a), length(b)));
        assert.ok(Math.abs(dot(c, a)) <= tolerance);
        assert.ok(Math.abs(dot(c, b)) <= tolerance);
      }),
    );
  });

  it("refuses to normalize a zero vector", () => {
    assert.throws(() => normalize([0, 0, 0]));
  });
});

describe("inspector Euler order YXZ", () => {
  it("matches three.js and round-trips ordinary angles", () => {
    fc.assert(fc.property(yawDeg, pitchDeg, rollDeg, (yaw, pitch, roll) => {
      const rad = Math.PI / 180;
      const q = fromEulerYXZDeg({ yawDeg: yaw, pitchDeg: pitch, rollDeg: roll });
      const three = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * rad, yaw * rad, roll * rad, "YXZ"));
      assertSameRotation(q, [three.x, three.y, three.z, three.w]);
      const restored = toEulerYXZDeg(q);
      assert.ok(angleGapDeg(restored.yawDeg, yaw) <= 1e-6);
      assertNear(restored.pitchDeg, pitch, 1e-6);
      assert.ok(angleGapDeg(restored.rollDeg, roll) <= 1e-6);
    }));
  });
});

describe("stored form", () => {
  it("is unit length with w ≥ 0 after every operation", () => {
    fc.assert(
      fc.property(rawQuat, quat, vec, (raw, q, v) => {
        assertStored(canonical(raw));
        assertStored(compose(q, canonical(raw)));
        assertStored(invert(q));
        const angles = toYawPitchRollDeg(q);
        assertStored(fromYawPitchRollDeg(angles));
        assertStored(fromYawDeg(angles.yawDeg));
        assert.ok(Number.isFinite(length(rotate(q, v))));
      }),
    );
  });

  it("is the same for q and −q", () => {
    fc.assert(
      fc.property(rawQuat, (q) => {
        assert.deepEqual(canonical(q), canonical([-q[0], -q[1], -q[2], -q[3]]));
      }),
    );
  });

  it("is the same for both forms of a half turn", () => {
    assert.deepEqual(canonical([0, -1, 0, 0]), canonical([0, 1, 0, 0]));
    assert.deepEqual(canonical([0, 0, -1, 0]), [0, 0, 1, 0]);
    assert.deepEqual(canonical([0, -0.6, 0.8, 0]), [0, 0.6, -0.8, 0]);
  });

  it("never stores −0", () => {
    const stored = canonical([-0, 0, -0, -1]);
    assert.ok(stored.every((c) => !Object.is(c, -0)), JSON.stringify(stored));
  });

  it("refuses something that isn't a rotation", () => {
    assert.throws(() => canonical([0, 0, 0, 0]));
    assert.throws(() => canonical([NaN, 0, 0, 1]));
  });
});

describe("rotation", () => {
  it("keeps a vector's length", () => {
    fc.assert(fc.property(quat, vec, (q, v) => assertNear(length(rotate(q, v)), length(v), EPS * (1 + length(v)))));
  });

  it("is undone by its inverse", () => {
    fc.assert(
      fc.property(quat, vec, (q, v) => {
        assertNearVec(compose(q, invert(q)), IDENTITY);
        assertNearVec(rotate(invert(q), rotate(q, v)), v, EPS * (1 + length(v)));
      }),
    );
  });

  it("composes first, then second", () => {
    fc.assert(
      fc.property(quat, quat, vec, (second, first, v) => {
        assertNearVec(rotate(compose(second, first), v), rotate(second, rotate(first, v)), EPS * (1 + length(v)));
      }),
    );
  });
});

describe("yaw", () => {
  it("takes local +x to world −z at 90°, as `rotation` always has", () => {
    assertNearVec(rotate(fromYawDeg(90), [1, 0, 0]), [0, 0, -1]);
  });

  it("round-trips across [0, 360)", () => {
    fc.assert(
      fc.property(yawDeg, (yaw) => {
        const angles = toYawPitchRollDeg(fromYawDeg(yaw));
        assert.ok(angleGapDeg(angles.yawDeg, yaw) <= 1e-7, `${yaw} came back as ${angles.yawDeg}`);
        assertNear(angles.pitchDeg, 0, 1e-7);
        assertNear(angles.rollDeg, 0, 1e-7);
      }),
    );
  });
});

describe("yaw, pitch and roll", () => {
  it("pitch tips the optical axis up, roll turns about it", () => {
    assertNearVec(rotate(fromYawPitchRollDeg({ yawDeg: 0, pitchDeg: 90, rollDeg: 0 }), [1, 0, 0]), [0, 1, 0]);
    assertNearVec(rotate(fromYawPitchRollDeg({ yawDeg: 0, pitchDeg: 0, rollDeg: 90 }), [1, 0, 0]), [1, 0, 0]);
  });

  it("matches three.js Euler order YZX", () => {
    fc.assert(
      fc.property(yawDeg, pitchDeg, rollDeg, (y, p, r) => {
        const rad = Math.PI / 180;
        const three = new THREE.Quaternion().setFromEuler(new THREE.Euler(r * rad, y * rad, p * rad, "YZX"));
        assertSameRotation(fromYawPitchRollDeg({ yawDeg: y, pitchDeg: p, rollDeg: r }), [three.x, three.y, three.z, three.w]);
      }),
    );
  });

  it("round-trips away from pitch ±90°", () => {
    fc.assert(
      fc.property(yawDeg, pitchDeg, rollDeg, (y, p, r) => {
        const angles = toYawPitchRollDeg(fromYawPitchRollDeg({ yawDeg: y, pitchDeg: p, rollDeg: r }));
        assert.ok(angleGapDeg(angles.yawDeg, y) <= 1e-6, `yaw ${y} came back as ${angles.yawDeg}`);
        assertNear(angles.pitchDeg, p, 1e-6);
        assert.ok(angleGapDeg(angles.rollDeg, r) <= 1e-6, `roll ${r} came back as ${angles.rollDeg}`);
      }),
    );
  });

  it("round-trips the rotation, not the angles, at pitch ±90°", () => {
    fc.assert(
      fc.property(yawDeg, fc.constantFrom(-90, 90), rollDeg, (y, p, r) => {
        const q = fromYawPitchRollDeg({ yawDeg: y, pitchDeg: p, rollDeg: r });
        const angles = toYawPitchRollDeg(q);
        assertNear(angles.pitchDeg, p, 1e-6);
        assert.equal(angles.rollDeg, 0);
        assertSameRotation(fromYawPitchRollDeg(angles), q);
      }),
    );
  });

  it("round-trips any stored rotation", () => {
    fc.assert(fc.property(quat, (q) => assertSameRotation(fromYawPitchRollDeg(toYawPitchRollDeg(q)), q)));
  });
});
