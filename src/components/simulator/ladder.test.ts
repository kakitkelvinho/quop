import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EV,
  HBAR,
  K_B,
  type LadderParams,
  TABLE_II,
  buildLadder,
  ladderPowerSeries,
  ladderSteadyState,
  ladderThreshold,
  simulateLadder,
  toRateParams,
} from "./ladder.ts";
import { simulate, steadyState, thresholdPump } from "./rate-equations.ts";

// The polariton ladder of Phys. Rev. B 110, 134321 with its Table II defaults.

const relClose = (a: number, b: number, tol: number, what = "") =>
  assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${what} ${a} vs ${b} (rel tol ${tol})`);
const sum = (xs: ArrayLike<number>) => Array.from(xs).reduce((s, v) => s + v, 0);

const ladder = buildLadder(TABLE_II);
const Pth = ladderThreshold(ladder);

describe("buildLadder with Table II", () => {
  it("gives the lower polariton, photon fraction and coupling at k = 0", () => {
    relClose(ladder.energy[0] / EV, 2.508, 2e-4);
    relClose(ladder.photonFraction[0], 0.947, 5e-4);
    relClose((HBAR * ladder.coupling[0]) / EV, 0.144, 2e-3);
    relClose((HBAR * ladder.decay[0]) / EV, 2.5e-3 * 0.9472 + 1e-5 * 0.0528, 1e-4);
  });

  it("has 101 bins holding 160 states over |k| ≤ 2 µm⁻¹", () => {
    assert.equal(ladder.energy.length, 101);
    assert.equal(ladder.states[0], 1);
    relClose(sum(ladder.states), 160.155, 1e-5);
    assert.equal(ladder.k[0], 0);
    relClose(ladder.k[100], 2e6, 1e-9);
    relClose((ladder.energy[100] - ladder.energy[0]) / EV, 7.5629e-3, 1e-4);
  });

  it("weights upward thermalisation by the Boltzmann factor", () => {
    const m = ladder.energy.length;
    const gap = ladder.energy[30] - ladder.energy[10];
    assert.equal(ladder.thermal[10 * m + 30], TABLE_II.thermalisation);
    relClose(ladder.thermal[30 * m + 10], TABLE_II.thermalisation * Math.exp(-gap / (K_B * 290)), 1e-12);
    assert.equal(ladder.thermal[10 * m + 10], 0);
  });

  it("rejects a negative or fractional bin count", () => {
    assert.throws(() => buildLadder({ ...TABLE_II, bins: -1 }), RangeError);
    assert.throws(() => buildLadder({ ...TABLE_II, bins: 1.5 }), RangeError);
  });
});

describe("ladderSteadyState", () => {
  it("puts the threshold at ϰ/N_mol = γ_0/G_0", () => {
    relClose(Pth / (TABLE_II.excitonDecay * TABLE_II.molecules), ladder.decay[0] / ladder.coupling[0], 1e-12);
    relClose(ladder.decay[0] / ladder.coupling[0], 0.016436, 1e-4);
    const below = ladderSteadyState(ladder, 0.5 * Pth);
    const above = ladderSteadyState(ladder, 2 * Pth);
    assert.ok(below.occupation[0] < 10, `n0 below ${below.occupation[0]}`);
    assert.ok(above.occupation[0] > 1000, `n0 above ${above.occupation[0]}`);
  });

  it("clamps the reservoir at γ_0/G_0 above threshold while n_0 grows linearly", () => {
    const clamp = ladder.decay[0] / ladder.coupling[0];
    const [a, b, c] = ladderPowerSeries(ladder, [50 * Pth, 100 * Pth, 200 * Pth]);
    for (const s of [a, b, c]) {
      assert.ok(s.reservoirPerMolecule < clamp);
      relClose(s.reservoirPerMolecule, clamp, 5e-3);
    }
    // Every extra absorbed photon leaves through the k = 0 bin: dn_0/dP = 1/γ_0.
    const slope1 = (b.occupation[0] - a.occupation[0]) / (50 * Pth);
    const slope2 = (c.occupation[0] - b.occupation[0]) / (100 * Pth);
    relClose(slope1, 1 / ladder.decay[0], 1e-2);
    relClose(slope2, slope1, 2e-3);
  });

  it("matches the reference script below, at and above threshold to 1 %", () => {
    // research/simulator-model/ladder.py at ϰ = x · ϰ_th:
    // [x, n_ExcD, n_0, Σn, n_1, n_50, n_100]
    const reference = [
      [0.1, 0.001551547497281318, 0.176839907344722, 38.93688770329574, 0.28235343538911467, 0.3598192362838537, 0.6022825773207163],
      [1, 0.009970147991844093, 150.17649963348893, 2732.679578220713, 178.70174659705376, 14.848110234134742, 11.657574293843004],
      [5, 0.01573412361412098, 25281.878062920016, 28054.60871800632, 538.4691401992845, 10.413937652310826, 5.136961260512665],
    ];
    for (const [x, nD, n0, total, n1, n50, n100] of reference) {
      const s = ladderSteadyState(ladder, x * Pth);
      relClose(s.reservoirPerMolecule, nD, 1e-2, `nD at ${x}`);
      relClose(s.occupation[0], n0, 1e-2, `n0 at ${x}`);
      relClose(sum(s.occupation), total, 1e-2, `total at ${x}`);
      relClose(s.occupation[1], n1, 1e-2, `n1 at ${x}`);
      relClose(s.occupation[50], n50, 1e-2, `n50 at ${x}`);
      relClose(s.occupation[100], n100, 1e-2, `n100 at ${x}`);
    }
  });

  it("balances pump against reservoir decay and polariton decay", () => {
    for (const x of [0.3, 1, 30]) {
      const s = ladderSteadyState(ladder, x * Pth);
      const lost = TABLE_II.excitonDecay * s.reservoir + sum(s.occupation.map((n, j) => ladder.decay[j] * n));
      relClose(lost, x * Pth, 1e-8);
    }
  });

  it("reports occupation per state and emitted photons per bin", () => {
    const s = ladderSteadyState(ladder, 2 * Pth);
    relClose(s.reservoir, s.reservoirPerMolecule * TABLE_II.molecules, 1e-14);
    assert.equal(s.perState[0], s.occupation[0]);
    relClose(s.perState[40], s.occupation[40] / ladder.states[40], 1e-14);
    relClose(s.emission[40], TABLE_II.cavityDecay * ladder.photonFraction[40] * s.occupation[40], 1e-14);
  });

  it("gives the same answer from a cold start, a warm start and raw parameters", () => {
    const cold = ladderSteadyState(ladder, 3 * Pth);
    const warm = ladderSteadyState(ladder, 3 * Pth, { initial: ladderSteadyState(ladder, 0.2 * Pth) });
    const raw = ladderSteadyState(TABLE_II, 3 * Pth);
    for (const s of [warm, raw]) {
      relClose(s.reservoir, cold.reservoir, 1e-8);
      for (const j of [0, 1, 50, 100]) relClose(s.occupation[j], cold.occupation[j], 1e-8);
    }
  });

  it("is empty with no pump and rejects a negative one", () => {
    const s = ladderSteadyState(ladder, 0);
    assert.equal(s.reservoir, 0);
    assert.equal(sum(s.occupation), 0);
    assert.throws(() => ladderSteadyState(ladder, -1), RangeError);
  });

  it("solves a 30-point power series in well under a second", () => {
    const pumps = Array.from({ length: 30 }, (_, i) => Pth * 10 ** (-2 + (3 * i) / 29));
    const start = performance.now();
    const series = ladderPowerSeries(ladder, pumps);
    const elapsed = performance.now() - start;
    assert.equal(series.length, 30);
    assert.ok(elapsed < 1000, `${elapsed.toFixed(0)} ms`);
    for (let i = 1; i < 30; i++) assert.ok(series[i].occupation[0] > series[i - 1].occupation[0]);
  });
});

describe("one bin", () => {
  const single = buildLadder({ ...TABLE_II, bins: 0 });
  const rate = toRateParams(single);

  it("maps onto the two-population model with R = G_0 / N_mol", () => {
    assert.equal(single.energy.length, 1);
    relClose(rate.R, single.coupling[0] / TABLE_II.molecules, 1e-14);
    relClose(thresholdPump(rate), ladderThreshold(single), 1e-12);
    relClose(ladderThreshold(single), Pth, 1e-12);
  });

  it("reproduces the closed-form steady state", () => {
    for (const x of [0.01, 0.5, 1, 2, 50]) {
      const P = x * thresholdPump(rate);
      const exact = steadyState(rate, P);
      const s = ladderSteadyState(single, P);
      relClose(s.reservoir, exact.nR, 1e-8, `nR at ${x}`);
      relClose(s.occupation[0], exact.n0, 1e-8, `n0 at ${x}`);
    }
  });

  it("emits what the two-population model emits for a pulse", () => {
    const pump = { kind: "pulse", energy: (3 * thresholdPump(rate)) / rate.gammaR, fwhm: 200e-15 } as const;
    const two = simulate(rate, pump);
    const one = simulateLadder(single, pump);
    // The ladder counts photons only, γ_Cav cos²φ of the decay γ_0.
    const photons = (TABLE_II.cavityDecay * single.photonFraction[0]) / single.decay[0];
    relClose(one.emitted[0], photons * two.emitted[two.emitted.length - 1], 2e-3);
  });
});

describe("thermalisation alone", () => {
  // No pump, no feeding, no decay: only the exchange between bins is left.
  const closed: LadderParams = { ...TABLE_II, bins: 20, huangRhys: 0, cavityDecay: 0, excitonDecay: 0 };
  const box = buildLadder(closed);
  const occupation = new Float64Array(21);
  occupation[20] = 400;
  occupation[7] = 100;
  const run = simulateLadder(box, { kind: "cw", rate: 0 }, { duration: 1e-7, initial: { reservoir: 0, occupation } });
  const end = run.states[run.states.length - 1];

  it("conserves the polariton number", () => {
    for (const s of run.states) relClose(sum(s.occupation), 500, 1e-9);
  });

  it("relaxes to a Bose–Einstein distribution at the environment temperature", () => {
    // f/(1 + f) = exp(−(E − μ)/k_B T): the log of the left side is a line in E of slope −1/k_B T.
    const kT = K_B * closed.temperature;
    const mu = (j: number) => box.energy[j] + kT * Math.log(end.perState[j] / (1 + end.perState[j]));
    for (let j = 1; j <= 20; j++) relClose(mu(j) - box.energy[0], mu(0) - box.energy[0], 1e-6, `bin ${j}`);
    // The chemical potential sits below the branch, and occupation falls with energy.
    assert.ok(mu(0) < box.energy[0]);
    for (let j = 1; j <= 20; j++) assert.ok(end.perState[j] < end.perState[j - 1]);
  });
});

describe("simulateLadder", () => {
  const small = buildLadder({ ...TABLE_II, bins: 20 });
  const smallPth = ladderThreshold(small);

  it("settles on the steady state under a constant pump", () => {
    const steady = ladderSteadyState(small, 2 * smallPth);
    const run = simulateLadder(small, { kind: "cw", rate: 2 * smallPth });
    const end = run.states[run.states.length - 1];
    relClose(end.reservoir, steady.reservoir, 1e-6);
    for (const j of [0, 1, 10, 20]) relClose(end.occupation[j], steady.occupation[j], 1e-6);
    assert.ok(run.states.every((s) => s.reservoir >= 0 && s.occupation.every((n) => n >= 0)));
  });

  it("accounts for every absorbed particle of a pulse", () => {
    const energy = (3 * smallPth) / TABLE_II.excitonDecay;
    const run = simulateLadder(small, { kind: "pulse", energy, fwhm: 200e-15 });
    let reservoirLoss = 0;
    for (let i = 1; i < run.t.length; i++) {
      reservoirLoss +=
        0.5 * (run.t[i] - run.t[i - 1]) * TABLE_II.excitonDecay * (run.states[i].reservoir + run.states[i - 1].reservoir);
    }
    // emitted is the photon part of each bin's decay; scale back to the whole decay.
    const polaritonLoss = sum(
      run.emitted.map((e, j) => (e * small.decay[j]) / (TABLE_II.cavityDecay * small.photonFraction[j])),
    );
    relClose(reservoirLoss + polaritonLoss, energy, 2e-3);
    // Well above threshold most of the pulse comes out as light.
    assert.ok(sum(run.emitted) > 0.5 * energy);
    assert.ok(Math.max(...run.states.map((s) => s.occupation[0])) > 1e4);
  });

  it("emits more than proportionally across threshold", () => {
    const emitted = (x: number) =>
      sum(simulateLadder(small, { kind: "pulse", energy: (x * smallPth) / TABLE_II.excitonDecay, fwhm: 200e-15 }).emitted);
    assert.ok(emitted(3) / emitted(0.3) > 20);
  });
});
