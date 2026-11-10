import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type PolaritonParams, polaritonBranches } from "./dispersion.ts";
import { type EmissionState, emissionMap, gaussian, lorentzian, mapIntegral } from "./emission-map.ts";

// The module works in SI; the tests talk in eV and meV and convert.
const EV = 1.602176634e-19;
const MEV = 1e-3 * EV;

const params: PolaritonParams = { excitonEnergy: 1.6 * EV, cavityEnergy0: 1.59 * EV, rabiSplitting: 10 * MEV, nEff: 3.5 };
const e0 = polaritonBranches(params, 0).lower;

const linspace = (a: number, b: number, n: number) => Float64Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

const state: EmissionState = {
  occupation: (theta) => 40 * Math.exp(-((theta / 0.15) ** 2)),
  linewidth: 0.5 * MEV,
  condensatePopulation: 300,
  condensateShift: 2 * MEV,
  condensateLinewidth: 0.2 * MEV,
  condensateAngularWidth: 0.02,
};

// Angles ±0.3 rad with θ = 0 on the grid; energies 100 meV either side of the
// lower branch (it spans a few meV here) in 0.05 meV steps.
const angles = linspace(-0.3, 0.3, 301);
const energies = linspace(e0 - 100 * MEV, e0 + 110 * MEV, 4201);
const grid = { angles, energies };

// Trapezoid ∫ f dθ on the same angles, so only the energy tails are in play.
function angularIntegral(f: (theta: number) => number): number {
  let s = 0;
  for (let i = 1; i < angles.length; i++) s += 0.5 * (f(angles[i]) + f(angles[i - 1])) * (angles[i] - angles[i - 1]);
  return s;
}

// A Lorentzian of half width g centred d inside each edge loses ≈ g/(π d) per
// side: 0.25 meV / (π · 100 meV) ≈ 0.08 %. Allow 0.5 % for truncation.
const TOL = 5e-3;

describe("emissionMap layout", () => {
  it("is row-major with angle rows and energy columns", () => {
    const small = { angles: [-0.1, 0, 0.1], energies: [e0 - MEV, e0, e0 + MEV, e0 + 2 * MEV] };
    const map = emissionMap(params, state, small);
    assert.equal(map.width, 4);
    assert.equal(map.height, 3);
    assert.equal(map.data.length, 12);
    assert.deepEqual(Array.from(map.angles), small.angles);
    const theta = small.angles[2];
    const energy = small.energies[1];
    const b = polaritonBranches(params, theta);
    const expected =
      state.occupation(theta) * b.lowerPhotonFraction * lorentzian(energy - b.lower, state.linewidth) +
      state.condensatePopulation * gaussian(theta, state.condensateAngularWidth) * lorentzian(energy - e0 - state.condensateShift, state.condensateLinewidth);
    assert.ok(Math.abs(map.data[2 * 4 + 1] - expected) < 1e-12 * expected);
  });
});

describe("emissionMap normalisation", () => {
  it("returns ∫ occupation · photon fraction dθ for the incoherent part", () => {
    const map = emissionMap(params, { ...state, condensatePopulation: 0 }, grid);
    const put = angularIntegral((t) => state.occupation(t) * polaritonBranches(params, t).lowerPhotonFraction);
    assert.ok(Math.abs(mapIntegral(map) / put - 1) < TOL);
  });

  it("returns n0 for the condensate", () => {
    const map = emissionMap(params, { ...state, occupation: () => 0 }, grid);
    assert.ok(Math.abs(mapIntegral(map) / state.condensatePopulation - 1) < TOL);
  });

  it("adds the two", () => {
    const map = emissionMap(params, state, grid);
    const put = angularIntegral((t) => state.occupation(t) * polaritonBranches(params, t).lowerPhotonFraction) + state.condensatePopulation;
    assert.ok(Math.abs(mapIntegral(map) / put - 1) < TOL);
  });
});

// FWHM of a sampled peak, interpolating linearly at the half-maximum crossings.
function fwhm(xs: ArrayLike<number>, ys: ArrayLike<number>): { peak: number; width: number } {
  let k = 0;
  for (let i = 1; i < ys.length; i++) if (ys[i] > ys[k]) k = i;
  const half = ys[k] / 2;
  let l = k;
  while (ys[l - 1] > half) l--;
  let r = k;
  while (ys[r + 1] > half) r++;
  const left = xs[l - 1] + ((half - ys[l - 1]) / (ys[l] - ys[l - 1])) * (xs[l] - xs[l - 1]);
  const right = xs[r] + ((ys[r] - half) / (ys[r] - ys[r + 1])) * (xs[r + 1] - xs[r]);
  return { peak: xs[k], width: right - left };
}

describe("emissionMap condensate", () => {
  // Fine grid around the condensate: 0.005 meV and 0.0005 rad steps.
  const fine = { angles: linspace(-0.05, 0.05, 201), energies: linspace(e0 - 5 * MEV, e0 + 8 * MEV, 2601) };
  const zeroRow = 100;

  it("peaks at E−(0) + shift with the given energy FWHM", () => {
    const map = emissionMap(params, { ...state, occupation: () => 0 }, fine);
    assert.equal(map.angles[zeroRow], 0);
    const row = map.data.subarray(zeroRow * map.width, (zeroRow + 1) * map.width);
    const { peak, width } = fwhm(map.energies, row);
    assert.ok(Math.abs(peak - (e0 + state.condensateShift)) <= 0.005 * MEV / 2 + 1e-9 * MEV);
    assert.ok(Math.abs(width / state.condensateLinewidth - 1) < 1e-3);
  });

  it("has the given angular FWHM, centred on θ = 0", () => {
    const map = emissionMap(params, { ...state, occupation: () => 0 }, fine);
    const col = Math.round((e0 + state.condensateShift - fine.energies[0]) / (0.005 * MEV));
    const column = Array.from({ length: map.height }, (_, i) => map.data[i * map.width + col]);
    const { peak, width } = fwhm(map.angles, column);
    assert.equal(peak, 0);
    assert.ok(Math.abs(width / state.condensateAngularWidth - 1) < 1e-3);
  });

  it("still peaks at E−(0) + shift over the incoherent background", () => {
    const map = emissionMap(params, state, fine);
    const row = map.data.subarray(zeroRow * map.width, (zeroRow + 1) * map.width);
    const { peak } = fwhm(map.energies, row);
    assert.ok(Math.abs(peak - (e0 + state.condensateShift)) <= 0.005 * MEV);
  });
});
