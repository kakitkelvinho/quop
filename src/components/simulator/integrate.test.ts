import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { integrate } from "./integrate.ts";

// A general Runge–Kutta integrator: adaptive Dormand–Prince 5(4) or fixed RK4.

const relClose = (a: number, b: number, tol: number) =>
  assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${a} vs ${b} (rel tol ${tol})`);

describe("integrate", () => {
  it("solves exponential decay on picosecond scales to tolerance", () => {
    const k = 2e11; // 1/(5 ps)
    const out = integrate((_t, y) => [-k * y[0]], [1e4], 0, 50e-12, { rtol: 1e-9, atol: 1e-12 });
    assert.equal(out.t[0], 0);
    assert.equal(out.t[out.t.length - 1], 50e-12);
    out.t.forEach((t, i) => relClose(out.y[i][0], 1e4 * Math.exp(-k * t), 1e-7));
  });

  it("follows a harmonic oscillator over many periods", () => {
    const w = 2 * Math.PI * 1e9;
    const out = integrate((_t, y) => [y[1], -w * w * y[0]], [1, 0], 0, 10e-9, { rtol: 1e-10, atol: 1e-12 });
    const y = out.y[out.y.length - 1];
    assert.ok(Math.abs(y[0] - 1) < 1e-7);
    assert.ok(Math.abs(y[1] / w) < 1e-7);
  });

  it("keeps a small component accurate next to a large one", () => {
    // y0 ~ 1e4 decays fast; y1 ~ 1e-3 decays slowly. atol stays below y1.
    const out = integrate((_t, y) => [-2e11 * y[0], -1e9 * y[1]], [1e4, 1e-3], 0, 1e-9, { rtol: 1e-8, atol: 1e-12 });
    const y = out.y[out.y.length - 1];
    relClose(y[1], 1e-3 * Math.exp(-1), 1e-6);
    assert.ok(Math.abs(y[0]) < 1e-6);
  });

  it("lengthens its steps once a fast transient has died away", () => {
    const out = integrate((_t, y) => [-2e11 * y[0]], [1], 0, 1e-9);
    const steps = out.t.slice(1).map((t, i) => t - out.t[i]);
    assert.ok(out.t.length < 500);
    assert.ok(Math.max(...steps) > 5 * steps[0]);
  });

  it("respects maxStep", () => {
    const out = integrate(() => [0], [1], 0, 1e-9, { maxStep: 1e-11 });
    for (let i = 1; i < out.t.length; i++) assert.ok(out.t[i] - out.t[i - 1] <= 1e-11 * (1 + 1e-9));
    assert.ok(out.t.length >= 101);
  });

  it("takes fixed RK4 steps that land on t1, with fourth-order error", () => {
    const f = (_t: number, y: readonly number[]) => [-y[0]];
    const err = (step: number) => {
      const out = integrate(f, [1], 0, 1, { method: "rk4", step });
      assert.equal(out.t[out.t.length - 1], 1);
      return Math.abs(out.y[out.y.length - 1][0] - Math.exp(-1));
    };
    const out = integrate(f, [1], 0, 1, { method: "rk4", step: 0.1 });
    assert.equal(out.t.length, 11);
    const ratio = err(0.1) / err(0.05);
    assert.ok(ratio > 14 && ratio < 18, `error ratio ${ratio}`);
  });

  it("passes time to f for driven systems", () => {
    // dy/dt = cos t, y = sin t.
    const out = integrate((t) => [Math.cos(t)], [0], 0, 3, { rtol: 1e-10, atol: 1e-12 });
    assert.ok(Math.abs(out.y[out.y.length - 1][0] - Math.sin(3)) < 1e-9);
  });

  it("returns the start for an empty span and rejects a backward one", () => {
    assert.deepEqual(integrate(() => [1], [2], 5, 5), { t: [5], y: [[2]] });
    assert.throws(() => integrate(() => [1], [2], 5, 4), RangeError);
  });

  it("gives up after maxSteps", () => {
    assert.throws(() => integrate(() => [0], [1], 0, 1, { maxStep: 1e-3, maxSteps: 10 }), RangeError);
  });
});
