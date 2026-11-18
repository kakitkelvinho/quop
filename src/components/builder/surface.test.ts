import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";

import { canonical, cross, dot, length, normalize, type Quat, rotate, scale, type Vec3 } from "./quaternion.ts";
import {
  applyRule,
  type Aperture,
  intersect,
  interact,
  makeSurface,
  placeSurface,
  reflectDirection,
  reverse,
  type Surface,
  type SurfaceRule,
  type TracedBeam,
} from "./surface.ts";

const EPS = 1e-9;

const coord = fc.double({ min: -1e3, max: 1e3, noNaN: true });
const point: fc.Arbitrary<Vec3> = fc.tuple(coord, coord, coord);
const unitVec: fc.Arbitrary<Vec3> = point.filter((v) => length(v) > 1e-3).map(normalize);
const unit = fc.double({ min: -1, max: 1, noNaN: true });
const quat: fc.Arbitrary<Quat> = fc
  .tuple(unit, unit, unit, unit)
  .filter((q) => Math.hypot(...q) > 0.1)
  .map(canonical);
const fraction = fc.double({ min: 0.001, max: 0.999, noNaN: true });
const power = fc.double({ min: 0.001, max: 10, noNaN: true });

const beam: fc.Arbitrary<TracedBeam> = fc.record({ originMm: point, direction: unitVec, power }, { noNullPrototype: true });

/** Splits with R + T = 1, both branches alive. */
const losslessSplit: fc.Arbitrary<SurfaceRule> = fc
  .double({ min: 0.001, max: 0.999, noNaN: true })
  .map((r) => ({ kind: "split", reflectance: r, transmittance: 1 - r }));

const anyRule: fc.Arbitrary<SurfaceRule> = fc.oneof(
  fc.constant<SurfaceRule>({ kind: "block" }),
  fc.constant<SurfaceRule>({ kind: "pass" }),
  fc.constant<SurfaceRule>({ kind: "reflect" }),
  losslessSplit,
  fc.tuple(fraction, fraction).map(([r, t]): SurfaceRule => ({ kind: "split", reflectance: r / 2, transmittance: t / 2 })),
);

function assertNear(actual: number, expected: number, tolerance = EPS) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

function assertVecNear(actual: Vec3, expected: Vec3, tolerance = EPS) {
  for (let i = 0; i < 3; i++) assertNear(actual[i], expected[i], tolerance);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const circle: Aperture = { kind: "circle", radiusMm: 10 };

function mirrorAtOrigin(aperture: Aperture = circle, rule: SurfaceRule = { kind: "reflect" }): Surface {
  return makeSurface({ positionMm: [0, 0, 0], normal: [1, 0, 0], aperture, rule });
}

describe("reflection", () => {
  it("is d − 2(d·n)n", () => {
    fc.assert(
      fc.property(unitVec, unitVec, (d, n) => {
        assertVecNear(reflectDirection(d, n), [
          d[0] - 2 * dot(d, n) * n[0],
          d[1] - 2 * dot(d, n) * n[1],
          d[2] - 2 * dot(d, n) * n[2],
        ]);
      }),
    );
  });

  it("keeps the angle: the beam in and the beam out make equal angles with the normal", () => {
    fc.assert(
      fc.property(unitVec, unitVec, (d, n) => {
        const out = reflectDirection(d, n);
        assertNear(dot(scale(d, -1), n), dot(out, n));
        assertNear(length(out), 1);
      }),
    );
  });

  it("keeps the part of the direction along the mirror and flips the part across it", () => {
    fc.assert(
      fc.property(unitVec, unitVec, (d, n) => {
        const out = reflectDirection(d, n);
        const alongMirror = (v: Vec3): Vec3 => [v[0] - dot(v, n) * n[0], v[1] - dot(v, n) * n[1], v[2] - dot(v, n) * n[2]];
        assertVecNear(alongMirror(out), alongMirror(d));
        assertNear(dot(out, n), -dot(d, n));
      }),
    );
  });

  it("is the same whichever way the normal points", () => {
    fc.assert(fc.property(unitVec, unitVec, (d, n) => assertVecNear(reflectDirection(d, n), reflectDirection(d, scale(n, -1)))));
  });

  it("is a half turn about the normal composed with a flip, so it commutes with any rotation", () => {
    fc.assert(
      fc.property(unitVec, unitVec, quat, (d, n, q) => {
        assertVecNear(reflectDirection(rotate(q, d), rotate(q, n)), rotate(q, reflectDirection(d, n)), 1e-8);
      }),
    );
  });

  it("twice over returns the beam", () => {
    fc.assert(fc.property(unitVec, unitVec, (d, n) => assertVecNear(reflectDirection(reflectDirection(d, n), n), d, 1e-8)));
  });
});

describe("splitting", () => {
  it("shares the power: R + T = 1 when lossless", () => {
    fc.assert(
      fc.property(beam, unitVec, losslessSplit, (b, n, rule) => {
        const out = applyRule(rule, n, b, [0, 0, 0]);
        assert.equal(out.length, 2);
        assertNear(
          out.reduce((sum, o) => sum + o.power, 0),
          b.power,
          1e-9,
        );
      }),
    );
  });

  it("never makes power, and a lossy surface keeps less than it was given", () => {
    fc.assert(
      fc.property(beam, unitVec, anyRule, (b, n, rule) => {
        const total = applyRule(rule, n, b, [0, 0, 0]).reduce((sum, o) => sum + o.power, 0);
        assert.ok(total <= b.power * (1 + 1e-12));
      }),
    );
  });

  it("sends the transmitted share straight on and the reflected share by the law of reflection", () => {
    fc.assert(
      fc.property(beam, unitVec, fraction, (b, n, r) => {
        const rule: SurfaceRule = { kind: "split", reflectance: r, transmittance: 1 - r };
        const [through, reflected] = applyRule(rule, n, b, [0, 0, 0]);
        assert.deepEqual(through.direction, b.direction);
        assertNear(through.power, b.power * (1 - r), 1e-9);
        assertVecNear(reflected.direction, reflectDirection(b.direction, n));
        assertNear(reflected.power, b.power * r, 1e-9);
      }),
    );
  });

  it("drops a branch with no power, so R = 0 gives one beam and T = 0 gives one", () => {
    const b: TracedBeam = { originMm: [-1, 0, 0], direction: [1, 0, 0], power: 1 };
    const n: Vec3 = [1, 0, 0];
    assert.equal(applyRule({ kind: "split", reflectance: 0, transmittance: 1 }, n, b, [0, 0, 0]).length, 1);
    assert.equal(applyRule({ kind: "split", reflectance: 1, transmittance: 0 }, n, b, [0, 0, 0]).length, 1);
  });

  it("gives zero beams for a block, one for a pass or a reflect", () => {
    const b: TracedBeam = { originMm: [-1, 0, 0], direction: [1, 0, 0], power: 1 };
    const n: Vec3 = [1, 0, 0];
    assert.equal(applyRule({ kind: "block" }, n, b, [0, 0, 0]).length, 0);
    assert.equal(applyRule({ kind: "pass" }, n, b, [0, 0, 0]).length, 1);
    assert.equal(applyRule({ kind: "reflect" }, n, b, [0, 0, 0]).length, 1);
  });
});

describe("running a rule backwards", () => {
  it("gives back the input for a pass and a reflect, power and all", () => {
    fc.assert(
      fc.property(beam, unitVec, point, fc.constantFrom<SurfaceRule>({ kind: "pass" }, { kind: "reflect" }), (b, n, hit, rule) => {
        const [out] = applyRule(rule, n, b, hit);
        const [back] = applyRule(rule, n, reverse(out), hit);
        assertVecNear(back.direction, reverse(b).direction);
        assertNear(back.power, b.power, 1e-9);
        assert.deepEqual(back.originMm, hit);
      }),
    );
  });

  it("gives back the input direction from each branch of a split", () => {
    fc.assert(
      fc.property(beam, unitVec, point, losslessSplit, (b, n, hit, rule) => {
        for (const branch of applyRule(rule, n, b, hit)) {
          const backs = applyRule(rule, n, reverse(branch), hit);
          const recovered = backs.some((back) => {
            const want = reverse(b).direction;
            return Math.hypot(back.direction[0] - want[0], back.direction[1] - want[1], back.direction[2] - want[2]) < 1e-8;
          });
          assert.ok(recovered, "no branch of the reversed beam retraces the input");
        }
      }),
    );
  });

  it("sends the same ray back to the same surface point", () => {
    fc.assert(
      fc.property(unitVec, fc.double({ min: 0.5, max: 5, noNaN: true }), (d, distance) => {
        const surface = mirrorAtOrigin({ kind: "circle", radiusMm: 1e6 });
        const start = scale(d, -distance);
        const forward = interact(surface, { originMm: start, direction: d, power: 1 });
        fc.pre(forward !== null);
        const [out] = forward!.outgoing;
        const backward = interact(surface, { originMm: [out.originMm[0] + out.direction[0], out.originMm[1] + out.direction[1], out.originMm[2] + out.direction[2]], direction: reverse(out).direction, power: 1 });
        fc.pre(backward !== null);
        assertVecNear(backward!.hitMm, forward!.hitMm, 1e-6);
      }),
    );
  });
});

describe("purity", () => {
  it("gives deep-equal output for the same input, and never touches the input", () => {
    fc.assert(
      fc.property(beam, unitVec, point, anyRule, (b, n, hit, rule) => {
        const frozen = deepFreeze({ b: structuredClone(b), n: [...n] as Vec3, hit: [...hit] as Vec3, rule: structuredClone(rule) });
        const first = applyRule(frozen.rule, frozen.n, frozen.b, frozen.hit);
        const second = applyRule(frozen.rule, frozen.n, frozen.b, frozen.hit);
        assert.deepEqual(first, second);
        assert.deepEqual(frozen.b, b);
        assert.deepEqual(frozen.rule, rule);
      }),
    );
  });

  it("holds for interact and placeSurface on frozen inputs", () => {
    fc.assert(
      fc.property(beam, quat, point, anyRule, (b, q, at, rule) => {
        const surface = deepFreeze(mirrorAtOrigin(circle, structuredClone(rule)));
        const pose = deepFreeze({ positionMm: [...at] as Vec3, orientation: [...q] as Quat });
        const frozenBeam = deepFreeze(structuredClone(b));
        assert.deepEqual(placeSurface(surface, pose), placeSurface(surface, pose));
        const placed = placeSurface(surface, pose);
        assert.deepEqual(interact(placed, frozenBeam), interact(placed, frozenBeam));
      }),
    );
  });
});

describe("intersect", () => {
  it("hits a mirror's centre head on", () => {
    const hit = intersect(mirrorAtOrigin(), { originMm: [-5, 0, 0], direction: [1, 0, 0], power: 1 });
    assert.deepEqual(hit, [0, 0, 0]);
  });

  it("misses a circular aperture by a hair and catches it by a hair", () => {
    const b = (y: number): TracedBeam => ({ originMm: [-5, y, 0], direction: [1, 0, 0], power: 1 });
    assert.notEqual(intersect(mirrorAtOrigin(), b(10 - 1e-9)), null);
    assert.equal(intersect(mirrorAtOrigin(), b(10 + 1e-9)), null);
  });

  it("measures a rectangular aperture along its own width and height", () => {
    const wide: Aperture = { kind: "rect", widthMm: 20, heightMm: 4, widthAxis: [0, 0, 1] };
    const surface = mirrorAtOrigin(wide);
    const b = (y: number, z: number): TracedBeam => ({ originMm: [-5, y, z], direction: [1, 0, 0], power: 1 });
    assert.notEqual(intersect(surface, b(0, 9)), null);
    assert.equal(intersect(surface, b(0, 11)), null);
    assert.notEqual(intersect(surface, b(1.9, 0)), null);
    assert.equal(intersect(surface, b(2.1, 0)), null);
  });

  it("ignores a beam pointing away, a beam parallel to the plane, and one that starts on the surface", () => {
    const surface = mirrorAtOrigin();
    assert.equal(intersect(surface, { originMm: [-5, 0, 0], direction: [-1, 0, 0], power: 1 }), null);
    assert.equal(intersect(surface, { originMm: [-5, 0, 0], direction: [0, 1, 0], power: 1 }), null);
    assert.equal(intersect(surface, { originMm: [0, 0, 0], direction: [1, 0, 0], power: 1 }), null);
  });

  it("is hit from either side", () => {
    const surface = mirrorAtOrigin();
    assert.notEqual(intersect(surface, { originMm: [5, 0, 0], direction: [-1, 0, 0], power: 1 }), null);
  });

  it("reflects a head-on beam straight back and a 45° beam through a right angle", () => {
    const surface = mirrorAtOrigin();
    const head = interact(surface, { originMm: [-5, 0, 0], direction: [1, 0, 0], power: 1 })!;
    assertVecNear(head.outgoing[0].direction, [-1, 0, 0]);
    const slanted = interact(surface, { originMm: [-5, -5, 0], direction: normalize([1, 1, 0]), power: 1 })!;
    assertVecNear(slanted.outgoing[0].direction, normalize([-1, 1, 0]));
  });
});

describe("placing a surface on a Component", () => {
  const rectOn = (widthAxis: Vec3): Surface =>
    makeSurface({
      positionMm: [3, 1, -2],
      normal: [1, 0, 0],
      aperture: { kind: "rect", widthMm: 10, heightMm: 5, widthAxis },
      rule: { kind: "reflect" },
    });

  it("keeps the normal unit and the width axis in the plane", () => {
    fc.assert(
      fc.property(quat, point, (q, at) => {
        const placed = placeSurface(rectOn([0, 0, 1]), { positionMm: at, orientation: q });
        assertNear(length(placed.normal), 1, 1e-9);
        assert.equal(placed.aperture.kind, "rect");
        if (placed.aperture.kind === "rect") assertNear(dot(placed.aperture.widthAxis, placed.normal), 0, 1e-9);
      }),
    );
  });

  it("is the identity for the identity pose at the origin", () => {
    const surface = rectOn([0, 0, 1]);
    const placed = placeSurface(surface, { positionMm: [0, 0, 0], orientation: [0, 0, 0, 1] });
    assertVecNear(placed.positionMm, surface.positionMm);
    assertVecNear(placed.normal, surface.normal);
  });

  it("turns the whole Component's light with it: reflecting then placing equals placing then reflecting", () => {
    fc.assert(
      fc.property(quat, point, unitVec, (q, at, d) => {
        const surface = mirrorAtOrigin();
        const placed = placeSurface(surface, { positionMm: at, orientation: q });
        assertVecNear(reflectDirection(rotate(q, d), placed.normal), rotate(q, reflectDirection(d, surface.normal)), 1e-8);
      }),
    );
  });

  it("moves the aperture's height axis with the width axis", () => {
    const q: Quat = canonical([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
    const placed = placeSurface(rectOn([0, 0, 1]), { positionMm: [0, 0, 0], orientation: q });
    if (placed.aperture.kind !== "rect") throw new Error("rect aperture expected");
    assertVecNear(cross(placed.normal, placed.aperture.widthAxis), rotate(q, cross([1, 0, 0], [0, 0, 1])), 1e-9);
  });
});

describe("makeSurface", () => {
  const base = { positionMm: [0, 0, 0] as Vec3, normal: [1, 0, 0] as Vec3, aperture: circle, rule: { kind: "reflect" } as SurfaceRule };

  it("accepts a well-formed surface and hands it back", () => {
    assert.deepEqual(makeSurface(base), base);
  });

  it("rejects what the types can't rule out", () => {
    assert.throws(() => makeSurface({ ...base, normal: [2, 0, 0] }), /unit length/);
    assert.throws(() => makeSurface({ ...base, aperture: { kind: "circle", radiusMm: 0 } }), /radius/);
    assert.throws(() => makeSurface({ ...base, aperture: { kind: "rect", widthMm: 1, heightMm: -1, widthAxis: [0, 0, 1] } }), /sides/);
    assert.throws(() => makeSurface({ ...base, aperture: { kind: "rect", widthMm: 1, heightMm: 1, widthAxis: [1, 0, 0] } }), /plane/);
    assert.throws(() => makeSurface({ ...base, aperture: { kind: "rect", widthMm: 1, heightMm: 1, widthAxis: [0, 0, 2] } }), /unit length/);
    assert.throws(() => makeSurface({ ...base, rule: { kind: "split", reflectance: 0.7, transmittance: 0.7 } }), /R \+ T/);
    assert.throws(() => makeSurface({ ...base, rule: { kind: "split", reflectance: -0.1, transmittance: 0.5 } }), /R, T/);
  });
});
