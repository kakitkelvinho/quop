import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { integrateStiff, luFactor, luSolve } from "./stiff.ts";

const relClose = (a: number, b: number, tol: number) =>
  assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${a} vs ${b} (rel tol ${tol})`);

describe("luFactor / luSolve", () => {
  it("solves a system that needs pivoting", () => {
    // [[0, 2, 1], [1, 1, 0], [2, 0, 3]] x = [7, 3, 11] has x = [1, 2, 3].
    const a = Float64Array.from([0, 2, 1, 1, 1, 0, 2, 0, 3]);
    const x = luSolve(luFactor(a, 3), Float64Array.from([7, 3, 11]));
    [1, 2, 3].forEach((v, i) => relClose(x[i], v, 1e-13));
  });

  it("throws on a singular matrix", () => {
    assert.throws(() => luFactor(Float64Array.from([1, 2, 2, 4]), 2), RangeError);
  });
});

describe("integrateStiff", () => {
  it("follows a stiff forced relaxation that an explicit method could not afford", () => {
    // y' = −λ (y − cos t) − sin t, y(0) = 1, has y = cos t for any λ.
    const lambda = 1e8;
    const run = integrateStiff(
      (t, y, out) => {
        out[0] = -lambda * (y[0] - Math.cos(t)) - Math.sin(t);
      },
      (_t, _y, out) => {
        out[0] = -lambda;
      },
      [1],
      0,
      10,
    );
    relClose(run.y[run.y.length - 1][0], Math.cos(10), 1e-4);
    assert.equal(run.t[run.t.length - 1], 10);
    // Explicit stability would need about λ·10/3 ≈ 3e8 steps.
    assert.ok(run.t.length < 5000, `${run.t.length} steps`);
  });

  it("matches the exact solution of a linear system with widely separated rates", () => {
    // y1' = −y1, y2' = 1e6 (y1 − y2): y2 trails y1 by 1e-6.
    const run = integrateStiff(
      (_t, y, out) => {
        out[0] = -y[0];
        out[1] = 1e6 * (y[0] - y[1]);
      },
      (_t, _y, out) => {
        out.set([-1, 0, 1e6, -1e6]);
      },
      [1, 0],
      0,
      3,
      { rtol: 1e-7 },
    );
    const end = run.y[run.y.length - 1];
    // rtol bounds the error of each step; over the run they add up.
    relClose(end[0], Math.exp(-3), 1e-4);
    relClose(end[1], Math.exp(-3) / (1 - 1e-6), 1e-4);
  });

  it("is second order: a tenth of the tolerance costs about 10^(1/3) more steps", () => {
    const steps = (rtol: number) =>
      integrateStiff(
        (_t, y, out) => {
          out[0] = -y[0] * y[0];
        },
        (_t, y, out) => {
          out[0] = -2 * y[0];
        },
        [1],
        0,
        100,
        { rtol, atol: 1e-14 },
      ).t.length;
    const ratio = steps(1e-8) / steps(1e-5);
    assert.ok(ratio > 5 && ratio < 20, `ratio ${ratio}`);
  });

  it("keeps populations non-negative when asked", () => {
    const run = integrateStiff(
      (_t, y, out) => {
        out[0] = -1e9 * y[0];
      },
      (_t, _y, out) => {
        out[0] = -1e9;
      },
      [1],
      0,
      1,
      { nonNegative: true },
    );
    assert.ok(run.y.every((y) => y[0] >= 0));
    assert.ok(run.y[run.y.length - 1][0] < 1e-9);
  });

  it("returns the start alone for an empty span and rejects a reversed one", () => {
    const f = (_t: number, _y: Float64Array, out: Float64Array) => out.fill(0);
    assert.deepEqual(integrateStiff(f, f, [2], 1, 1).t, [1]);
    assert.throws(() => integrateStiff(f, f, [2], 1, 0), RangeError);
  });
});
