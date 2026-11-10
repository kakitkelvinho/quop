// Polariton dispersion from two coupled oscillators: a planar cavity photon
// and an exciton, coupled with Rabi splitting ħΩ. SI units: energies in J,
// angles in rad (in-plane emission angle θ, measured in air).

export interface PolaritonParams {
  /** Exciton energy E_X, J. Taken as flat in angle. */
  excitonEnergy: number;
  /** Cavity photon energy at normal incidence E_C0, J. */
  cavityEnergy0: number;
  /** Rabi splitting ħΩ, J (the gap between branches at zero detuning). */
  rabiSplitting: number;
  /** Effective cavity refractive index n_eff, dimensionless, > 1. */
  nEff: number;
}

export interface PolaritonBranches {
  /** Lower polariton energy E−(θ), J. */
  lower: number;
  /** Upper polariton energy E+(θ), J. */
  upper: number;
  /** Photon (Hopfield) fraction |C|² of the lower branch, 0..1. */
  lowerPhotonFraction: number;
  /** Photon fraction of the upper branch, 0..1 (= 1 − lowerPhotonFraction). */
  upperPhotonFraction: number;
}

/** Cavity photon energy E_C(θ) = E_C0 / sqrt(1 − sin²θ / n_eff²), J. θ in rad. */
export function cavityEnergy(p: PolaritonParams, theta: number): number {
  const s = Math.sin(theta) / p.nEff;
  return p.cavityEnergy0 / Math.sqrt(1 - s * s);
}

/** Both branches and their photon fractions at angle θ (rad). */
export function polaritonBranches(p: PolaritonParams, theta: number): PolaritonBranches {
  const eC = cavityEnergy(p, theta);
  // Δ = E_X − E_C; the lower branch is photon-like when Δ is large and positive.
  const delta = p.excitonEnergy - eC;
  const root = Math.hypot(delta, p.rabiSplitting);
  const mid = 0.5 * (eC + p.excitonEnergy);
  // root is 0 only with no coupling at exact resonance; split the weight evenly.
  const lowerPhotonFraction = root === 0 ? 0.5 : 0.5 * (1 + delta / root);
  return {
    lower: mid - 0.5 * root,
    upper: mid + 0.5 * root,
    lowerPhotonFraction,
    upperPhotonFraction: 1 - lowerPhotonFraction,
  };
}

/** Lower polariton energy E−(θ), J. */
export function lowerPolaritonEnergy(p: PolaritonParams, theta: number): number {
  return polaritonBranches(p, theta).lower;
}

/** Upper polariton energy E+(θ), J. */
export function upperPolaritonEnergy(p: PolaritonParams, theta: number): number {
  return polaritonBranches(p, theta).upper;
}
