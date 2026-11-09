import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type PolaritonParams, cavityEnergy, lowerPolaritonEnergy, polaritonBranches, upperPolaritonEnergy } from "./dispersion.ts";

// The module works in SI; the tests talk in eV and convert.
const EV = 1.602176634e-19;

const resonant: PolaritonParams = { excitonEnergy: 1.6 * EV, cavityEnergy0: 1.6 * EV, rabiSplitting: 0.01 * EV, nEff: 3.5 };

describe("polaritonBranches", () => {
  it("splits the branches by exactly ħΩ at zero detuning and θ = 0, half photon each", () => {
    const b = polaritonBranches(resonant, 0);
    assert.ok(Math.abs(b.upper - b.lower - resonant.rabiSplitting) < 1e-12 * resonant.rabiSplitting);
    assert.equal(b.lowerPhotonFraction, 0.5);
    assert.equal(b.upperPhotonFraction, 0.5);
  });

  it("keeps the trace and the fractions summing right at any angle", () => {
    for (const theta of [-0.4, -0.1, 0.05, 0.3, 0.6]) {
      const b = polaritonBranches(resonant, theta);
      const eC = cavityEnergy(resonant, theta);
      assert.ok(Math.abs(b.lower + b.upper - (eC + resonant.excitonEnergy)) < 1e-12 * EV);
      assert.ok(Math.abs(b.lowerPhotonFraction + b.upperPhotonFraction - 1) < 1e-15);
      // Anticrossing: lower below both bare modes, upper above both.
      assert.ok(b.lower < Math.min(eC, resonant.excitonEnergy));
      assert.ok(b.upper > Math.max(eC, resonant.excitonEnergy));
    }
  });

  it("makes the lower branch less photonic as the cavity rises past the exciton with angle", () => {
    const f = (theta: number) => polaritonBranches(resonant, theta).lowerPhotonFraction;
    assert.ok(f(0) > f(0.3));
    assert.ok(f(0.3) > f(0.6));
  });

  it("follows the bare cavity at large negative detuning", () => {
    const p: PolaritonParams = { excitonEnergy: 1.8 * EV, cavityEnergy0: 1.5 * EV, rabiSplitting: 0.001 * EV, nEff: 3.5 };
    for (const theta of [0, 0.2, 0.5]) {
      const b = polaritonBranches(p, theta);
      // Second-order shift is (ħΩ)²/(4Δ) ≈ 1e-6 eV here.
      assert.ok(Math.abs(lowerPolaritonEnergy(p, theta) - cavityEnergy(p, theta)) < 2e-6 * EV);
      assert.ok(Math.abs(upperPolaritonEnergy(p, theta) - p.excitonEnergy) < 2e-6 * EV);
      assert.ok(b.lowerPhotonFraction > 0.9999);
    }
  });
});

describe("cavityEnergy", () => {
  it("is E_C0 at normal incidence and even in θ", () => {
    assert.equal(cavityEnergy(resonant, 0), resonant.cavityEnergy0);
    assert.equal(cavityEnergy(resonant, 0.3), cavityEnergy(resonant, -0.3));
  });

  it("is parabolic at small angle: E_C ≈ E_C0 (1 + θ² / (2 n_eff²))", () => {
    for (const theta of [0.005, 0.02, 0.05]) {
      const rise = cavityEnergy(resonant, theta) - resonant.cavityEnergy0;
      const parabola = (resonant.cavityEnergy0 * theta * theta) / (2 * resonant.nEff ** 2);
      // The next order is O(θ²) relative to the parabola.
      assert.ok(Math.abs(rise - parabola) < parabola * theta * theta);
    }
  });
});
