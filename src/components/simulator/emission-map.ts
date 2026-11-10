// The emission map I(θ, E): what the sample emits against in-plane angle and
// photon energy. SI units: θ in rad, E in J, I in emitted population per rad
// per J, so the double integral over θ and E is a population.
//
// Two parts, each normalised on its own:
// - incoherent lower polaritons: occupation(θ)·C(θ)·L(E − E−(θ)), with C the
//   lower branch's photon fraction and L a unit-area Lorentzian. Its integral
//   is ∫ occupation(θ)·C(θ) dθ, the photon-weighted occupation.
// - the condensate: n0·G(θ)·L0(E − E−(0) − shift), with G a unit-area
//   Gaussian in angle centred on θ = 0. Its integral is n0 as given; fold a
//   photon fraction into n0 upstream if wanted.
// Blueshift and linewidths come in as numbers, so the caller owns their
// dependence on reservoir and condensate densities.

import { type PolaritonParams, polaritonBranches } from "./dispersion.ts";

export interface EmissionState {
  /** Lower-branch occupation per unit angle, 1/rad, as a function of θ (rad). */
  occupation: (theta: number) => number;
  /** FWHM of the incoherent lower-polariton line, J. Must be > 0. */
  linewidth: number;
  /** Condensate population n0, dimensionless. */
  condensatePopulation: number;
  /** Condensate energy above E−(0) (blueshift), J. */
  condensateShift: number;
  /** Condensate FWHM in energy, J. Must be > 0. */
  condensateLinewidth: number;
  /** Condensate FWHM in angle, rad. Must be > 0. */
  condensateAngularWidth: number;
}

export interface EmissionGrid {
  /** In-plane angles θ, rad, ascending. */
  angles: ArrayLike<number>;
  /** Photon energies E, J, ascending. */
  energies: ArrayLike<number>;
}

/**
 * I(θ, E) on the grid, row-major: one row per angle, one column per energy,
 * so data[i * width + j] = I(angles[i], energies[j]). width = energies.length,
 * height = angles.length. Units: 1/(rad·J).
 */
export interface EmissionMap {
  data: Float64Array;
  width: number;
  height: number;
  /** Row axis, rad. */
  angles: Float64Array;
  /** Column axis, J. */
  energies: Float64Array;
}

/** Unit-area Lorentzian of full width at half maximum `fwhm`, at offset x. */
export function lorentzian(x: number, fwhm: number): number {
  const g = 0.5 * fwhm;
  return g / (Math.PI * (x * x + g * g));
}

/** Unit-area Gaussian of full width at half maximum `fwhm`, at offset x. */
export function gaussian(x: number, fwhm: number): number {
  const sigma = fwhm / (2 * Math.sqrt(2 * Math.LN2));
  return Math.exp(-0.5 * (x / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Emission I(θ, E) from the polariton parameters and populations. */
export function emissionMap(params: PolaritonParams, state: EmissionState, grid: EmissionGrid): EmissionMap {
  const angles = Float64Array.from(grid.angles);
  const energies = Float64Array.from(grid.energies);
  const width = energies.length;
  const height = angles.length;
  const data = new Float64Array(width * height);

  const condensateEnergy = polaritonBranches(params, 0).lower + state.condensateShift;
  const condensateLine = new Float64Array(width);
  for (let j = 0; j < width; j++) {
    condensateLine[j] = state.condensatePopulation * lorentzian(energies[j] - condensateEnergy, state.condensateLinewidth);
  }

  for (let i = 0; i < height; i++) {
    const theta = angles[i];
    const branch = polaritonBranches(params, theta);
    const weight = state.occupation(theta) * branch.lowerPhotonFraction;
    const angular = gaussian(theta, state.condensateAngularWidth);
    const row = i * width;
    for (let j = 0; j < width; j++) {
      data[row + j] = weight * lorentzian(energies[j] - branch.lower, state.linewidth) + angular * condensateLine[j];
    }
  }

  return { data, width, height, angles, energies };
}

/** ∫∫ I dθ dE by the trapezoid rule over the map's own axes: a population. */
export function mapIntegral(map: EmissionMap): number {
  const { data, width, height, angles, energies } = map;
  let total = 0;
  let prevRow = 0;
  for (let i = 0; i < height; i++) {
    let rowSum = 0;
    for (let j = 0; j + 1 < width; j++) {
      rowSum += 0.5 * (data[i * width + j] + data[i * width + j + 1]) * (energies[j + 1] - energies[j]);
    }
    if (i > 0) total += 0.5 * (prevRow + rowSum) * (angles[i] - angles[i - 1]);
    prevRow = rowSum;
  }
  return total;
}
