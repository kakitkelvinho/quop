import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type RateParams,
  type PulsedPump,
  powerSeries,
  pumpRate,
  simulate,
  steadyState,
  thresholdPump,
} from "./rate-equations.ts";

// Reservoir–condensate rate equations for a non-resonantly pumped polariton
// condensate, in SI units.

// γ_0 = 1/(5 ps), γ_R = 1/(1 ns), R = 1e-4 /ps. P_th = 2e12 /s, n_R saturates at γ_0/R = 2000.
const params: RateParams = { gammaR: 1e9, gamma0: 2e11, R: 1e8 };
const Pth = thresholdPump(params);

const relClose = (a: number, b: number, tol: number) =>
  assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${a} vs ${b} (rel tol ${tol})`);
const last = (xs: number[]) => xs[xs.length - 1];

describe("thresholdPump", () => {
  it("is γ_R γ_0 / R", () => {
    relClose(Pth, 2e12, 1e-12);
  });
});

describe("steadyState", () => {
  it("balances the rate equations", () => {
    for (const P of [0.01 * Pth, Pth, 50 * Pth]) {
      const { nR, n0 } = steadyState(params, P);
      const scatter = params.R * nR * (n0 + 1);
      relClose(scatter, params.gamma0 * n0, 1e-10);
      relClose(params.gammaR * nR + params.gamma0 * n0, P, 1e-10);
    }
  });

  it("well above threshold clamps n_R at γ_0/R and gives n_0 ≈ (P − P_th)/γ_0", () => {
    const P = 1000 * Pth;
    const { nR, n0 } = steadyState(params, P);
    relClose(nR, params.gamma0 / params.R, 1e-3);
    relClose(n0, (P - Pth) / params.gamma0, 1e-3);
  });

  it("well below threshold keeps n_0 ≪ 1 and linear in P", () => {
    const a = steadyState(params, 1e-4 * Pth);
    const b = steadyState(params, 1e-3 * Pth);
    assert.ok(b.n0 < 1e-3);
    relClose(b.n0 / a.n0, 10, 1e-3);
  });

  it("is empty with no pump and rejects a negative one", () => {
    assert.deepEqual(steadyState(params, 0), { nR: 0, n0: 0 });
    assert.throws(() => steadyState(params, -1), RangeError);
  });
});

describe("simulate (CW)", () => {
  for (const factor of [0.01, 0.5, 2, 10, 100]) {
    it(`converges to the closed-form steady state at P = ${factor} P_th`, () => {
      const P = factor * Pth;
      const sim = simulate(params, { kind: "cw", rate: P });
      const ss = steadyState(params, P);
      relClose(last(sim.nR), ss.nR, 1e-6);
      relClose(last(sim.n0), ss.n0, 1e-6);
    });
  }

  it("conserves n_R + n_0 with no decay and no pump", () => {
    const closed = { gammaR: 0, gamma0: 0, R: 1e8 };
    const sim = simulate(closed, { kind: "cw", rate: 0 }, { duration: 1e-9, initial: { nR: 1e4, n0: 0 } });
    for (let i = 0; i < sim.t.length; i++) relClose(sim.nR[i] + sim.n0[i], 1e4, 1e-12);
    // Everything ends up in the condensate.
    assert.ok(last(sim.nR) < 1e-3);
  });
});

describe("pulsed pump", () => {
  const pulse = (energy: number): PulsedPump => ({ kind: "pulse", energy, fwhm: 2e-12 });

  it("injects `energy` particles with the given FWHM", () => {
    const p = pulse(1e4);
    const dt = 1e-15;
    let total = 0;
    for (let t = 0; t < 12e-12; t += dt) total += pumpRate(p, t) * dt;
    relClose(total, 1e4, 1e-6);
    const peak = pumpRate(p, 6e-12);
    relClose(pumpRate(p, 5e-12), peak / 2, 1e-9);
    relClose(pumpRate(p, 7e-12), peak / 2, 1e-9);
  });

  it("accounts for every injected particle as decay or emission", () => {
    const sim = simulate(params, pulse(5e3));
    // γ_R ∫ n_R dt + γ_0 ∫ n_0 dt = injected, once everything has decayed.
    let reservoirLoss = 0;
    for (let i = 1; i < sim.t.length; i++) {
      reservoirLoss += 0.5 * params.gammaR * (sim.nR[i] + sim.nR[i - 1]) * (sim.t[i] - sim.t[i - 1]);
    }
    assert.ok(last(sim.nR) < 1e-3 && last(sim.n0) < 1e-3);
    relClose(reservoirLoss + last(sim.emitted), 5e3, 1e-3);
  });

  it("shows threshold as a kink in time-integrated emission vs pulse energy", () => {
    const energies = [10, 20, 40, 2e3, 3e3, 1e5, 2e5];
    const series = powerSeries(params, energies.map(pulse));
    const emission = series.map((p) => ("emission" in p ? p.emission : NaN));
    const efficiency = emission.map((e, i) => e / energies[i]);

    // Below: spontaneous scattering only, emission linear at R/(γ_R + R) ≈ 1/11 per particle.
    relClose(efficiency[0], efficiency[2], 0.01);
    assert.ok(efficiency[0] < 0.1);
    // Across threshold the slope jumps by an order of magnitude.
    const slowSlope = (emission[2] - emission[0]) / (energies[2] - energies[0]);
    const kinkSlope = (emission[4] - emission[3]) / (energies[4] - energies[3]);
    assert.ok(kinkSlope > 10 * slowSlope, `${kinkSlope} vs ${slowSlope}`);
    // Well above: stimulated scattering sends nearly every particle to the condensate.
    assert.ok(efficiency[5] > 0.99);
    relClose(emission[6] / emission[5], 2, 0.01);
  });
});

describe("powerSeries (CW)", () => {
  it("gives the closed-form steady state and emission rate per pump", () => {
    const [low, high] = powerSeries(params, [
      { kind: "cw", rate: 0.1 * Pth },
      { kind: "cw", rate: 10 * Pth },
    ]);
    assert.ok("n0" in low && "n0" in high);
    assert.deepEqual({ nR: high.nR, n0: high.n0 }, steadyState(params, 10 * Pth));
    relClose(high.emissionRate, params.gamma0 * high.n0, 1e-12);
    assert.ok(low.n0 < 1 && high.n0 > 50);
  });
});
