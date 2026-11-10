// The polariton ladder: a dark-exciton reservoir feeding N + 1 energy bins up
// the lower polariton branch, with thermalisation between the bins.
// Eqs. (C12)–(C13) of Shishkov, Andrianov, Zasedatelev, Phys. Rev. B 110,
// 134321 (2024), with the vibrational occupations set to zero and the pump fed
// straight into the dark excitons:
//
//   dN_R/dt = P(t) − γ_Exc N_R − (N_R / N_mol) Σ_m G_m (n_m + D_m)
//   dn_j/dt = −γ_j n_j + G_j (N_R / N_mol)(n_j + D_j)
//             + Σ_m [ W_jm (n_j + D_j) n_m − W_mj (n_m + D_m) n_j ]
//
// N_R is the number of dark excitons (the paper's n_ExcD times N_mol), n_j the
// number of polaritons in bin j, D_j the number of states in bin j, and
// P = γ_Exc ϰ the absorbed pump rate. W_jm is the thermalisation rate from bin
// m into bin j: γ_th downward, γ_th·exp(−(E_j − E_m)/k_B T) upward.
//
// SI units: energies in J, rates in s⁻¹, time in s, wave vectors in rad/m,
// area in m², temperature in K. Populations are numbers of particles.
//
// With one bin (bins = 0) this is the two-population model of
// rate-equations.ts with R = G_0 / N_mol; see `toRateParams`.

import { type Pump, type RateParams, pumpRate } from "./rate-equations.ts";
import { type StiffOptions, integrateStiff, luFactor, luSolve } from "./stiff.ts";

/** Reduced Planck constant, J s. */
export const HBAR = 1.054571817e-34;
/** Boltzmann constant, J/K. */
export const K_B = 1.380649e-23;
/** One electronvolt, J. */
export const EV = 1.602176634e-19;

export interface LadderParams {
  /** Cavity photon energy at normal incidence ħω_Cav(0), J. */
  cavityEnergy0: number;
  /** Cavity curvature α_Cav in E_Cav(k) = E_Cav(0) + α_Cav k², J m². */
  cavityCurvature: number;
  /** Dressed exciton energy ħω_Exc, J. */
  excitonEnergy: number;
  /** Rabi energy ħΩ_R, J: half the splitting between the branches at resonance. */
  rabiEnergy: number;
  /** Vibration quantum ħω_Vib, J. */
  vibrationEnergy: number;
  /** Huang–Rhys factor Λ², dimensionless. */
  huangRhys: number;
  /** Cavity photon decay rate γ_Cav, s⁻¹. */
  cavityDecay: number;
  /** Exciton decay rate γ_Exc, s⁻¹. Also the reservoir's decay rate. */
  excitonDecay: number;
  /** Exciton dephasing rate Γ_Exc, s⁻¹: the width of the vibron resonance. */
  excitonDephasing: number;
  /** Thermalisation rate γ_th per pair of states, s⁻¹. */
  thermalisation: number;
  /** Environment temperature T, K. */
  temperature: number;
  /** Number of molecules N_mol in the pumped area. */
  molecules: number;
  /** Pumped area S, m². */
  area: number;
  /** Largest in-plane wave vector on the ladder, rad/m. */
  kMax: number;
  /** Number of excited bins N; the ladder has N + 1 bins. 0 leaves only k = 0. */
  bins: number;
}

/**
 * Table II of Phys. Rev. B 110, 134321: 2.52 eV cavity with 2 meV µm²
 * curvature, 2.72 eV exciton, 50 meV Rabi energy, 200 meV vibration, 290 K,
 * 1e8 molecules over 500 µm², 100 bins over |k| ≤ 2 µm⁻¹.
 */
export const TABLE_II: LadderParams = {
  cavityEnergy0: 2.52 * EV,
  cavityCurvature: 2e-3 * EV * 1e-12,
  excitonEnergy: 2.72 * EV,
  rabiEnergy: 0.05 * EV,
  vibrationEnergy: 0.2 * EV,
  huangRhys: 1,
  cavityDecay: (2.5e-3 * EV) / HBAR,
  excitonDecay: (1e-5 * EV) / HBAR,
  excitonDephasing: (1e-2 * EV) / HBAR,
  thermalisation: (1e-5 * EV) / HBAR,
  temperature: 290,
  molecules: 1e8,
  area: 500e-12,
  kMax: 2e6,
  bins: 100,
};

/** The ladder derived from physical parameters; arrays have one entry per bin. */
export interface Ladder {
  params: LadderParams;
  /** Bin energy E_j, J, equally spaced from the bottom of the lower branch. */
  energy: Float64Array;
  /** In-plane wave vector of bin j, rad/m. */
  k: Float64Array;
  /** Photon fraction cos²φ_j, 0..1. */
  photonFraction: Float64Array;
  /** Polariton decay rate γ_j = γ_Cav cos²φ_j + γ_Exc sin²φ_j, s⁻¹. */
  decay: Float64Array;
  /** Vibron-assisted scattering rate G_j from the reservoir, s⁻¹. */
  coupling: Float64Array;
  /** Number of polariton states D_j in bin j; D_0 = 1. */
  states: Float64Array;
  /** Thermalisation rates W_jm from bin m into bin j, s⁻¹, row-major. */
  thermal: Float64Array;
}

/** Lower polariton energy (J) and photon fraction at in-plane wave vector k (rad/m). */
export function lowerBranch(p: LadderParams, k: number): { energy: number; photonFraction: number } {
  const eC = p.cavityEnergy0 + p.cavityCurvature * k * k;
  const delta = p.excitonEnergy - eC;
  const root = Math.hypot(delta, 2 * p.rabiEnergy);
  return {
    energy: 0.5 * (p.excitonEnergy + eC) - 0.5 * root,
    photonFraction: root === 0 ? 0.5 : 0.5 * (1 + delta / root),
  };
}

/** Derives the bins of the ladder from its physical parameters. */
export function buildLadder(p: LadderParams): Ladder {
  if (!Number.isInteger(p.bins) || p.bins < 0) throw new RangeError("buildLadder: bins must be an integer ≥ 0");
  if (!(p.molecules > 0)) throw new RangeError("buildLadder: molecules must be positive");
  if (p.bins > 0 && !(p.kMax > 0)) throw new RangeError("buildLadder: kMax must be positive");
  if (p.bins > 0 && !(p.cavityCurvature > 0)) throw new RangeError("buildLadder: cavityCurvature must be positive");
  if (p.bins > 0 && !(p.temperature > 0)) throw new RangeError("buildLadder: temperature must be positive");

  const m = p.bins + 1;
  const e0 = lowerBranch(p, 0).energy;
  const dE = p.bins > 0 ? (lowerBranch(p, p.kMax).energy - e0) / p.bins : 0;
  // States are uniform in the k plane, S/(2π)² each, and bins of equal energy
  // on a parabolic branch are rings of equal area π k_max² / N. One state per
  // ±k pair is counted (the paper's S δE / 4π α_Pol).
  const perBin = p.bins > 0 ? (p.area * p.kMax * p.kMax) / (4 * Math.PI * p.bins) : 0;

  const ladder: Ladder = {
    params: p,
    energy: new Float64Array(m),
    k: new Float64Array(m),
    photonFraction: new Float64Array(m),
    decay: new Float64Array(m),
    coupling: new Float64Array(m),
    states: new Float64Array(m),
    thermal: new Float64Array(m * m),
  };
  const halfWidth = 0.5 * HBAR * p.excitonDephasing;
  for (let j = 0; j < m; j++) {
    const e = e0 + j * dE;
    // Invert the branch: (E − E_Exc)(E − E_Cav) = (ħΩ_R)² gives E_Cav, then k.
    const eC = e - (p.rabiEnergy * p.rabiEnergy) / (e - p.excitonEnergy);
    const k = j === 0 ? 0 : Math.sqrt(Math.max(0, eC - p.cavityEnergy0) / p.cavityCurvature);
    const c2 = lowerBranch(p, k).photonFraction;
    const detuning = p.excitonEnergy - e - p.vibrationEnergy;
    ladder.energy[j] = e;
    ladder.k[j] = k;
    ladder.photonFraction[j] = c2;
    ladder.decay[j] = p.cavityDecay * c2 + p.excitonDecay * (1 - c2);
    // [PRB] Eq. (39): a Lorentzian in the detuning from the vibron resonance.
    ladder.coupling[j] =
      (p.huangRhys * p.rabiEnergy * p.rabiEnergy * p.excitonDephasing * c2) /
      (detuning * detuning + halfWidth * halfWidth);
    ladder.states[j] = j === 0 ? 1 : perBin;
  }
  const kT = K_B * p.temperature;
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      if (i === j) continue;
      ladder.thermal[j * m + i] = p.thermalisation * (j < i ? 1 : Math.exp(-((j - i) * dE) / kT));
    }
  }
  return ladder;
}

/**
 * Threshold pump rate, particles/s: P_th = γ_Exc N_mol γ_0 / G_0, where the
 * k = 0 bin alone would reach gain. In the paper's pump parameter,
 * ϰ_th / N_mol = γ_0 / G_0.
 */
export function ladderThreshold(ladder: Ladder): number {
  const { params: p, decay, coupling } = ladder;
  return (p.excitonDecay * p.molecules * decay[0]) / coupling[0];
}

/** The two-population model (rate-equations.ts) this ladder reduces to with one bin. */
export function toRateParams(ladder: Ladder): RateParams {
  return {
    gammaR: ladder.params.excitonDecay,
    gamma0: ladder.decay[0],
    R: ladder.coupling[0] / ladder.params.molecules,
  };
}

/** Populations of the ladder at one moment. */
export interface LadderState {
  /** Dark excitons N_R, particles. */
  reservoir: number;
  /** Dark excitons per molecule N_R / N_mol (the paper's n_ExcD). */
  reservoirPerMolecule: number;
  /** Polaritons n_j in each bin, particles. */
  occupation: Float64Array;
  /** Polaritons per state n_j / D_j in each bin. */
  perState: Float64Array;
  /** Photons leaving each bin, γ_Cav cos²φ_j n_j, photons/s. */
  emission: Float64Array;
}

function toState(ladder: Ladder, y: ArrayLike<number>): LadderState {
  const m = ladder.energy.length;
  const occupation = new Float64Array(m);
  const perState = new Float64Array(m);
  const emission = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    occupation[j] = y[j + 1];
    perState[j] = y[j + 1] / ladder.states[j];
    emission[j] = ladder.params.cavityDecay * ladder.photonFraction[j] * y[j + 1];
  }
  return {
    reservoir: y[0],
    reservoirPerMolecule: y[0] / ladder.params.molecules,
    occupation,
    perState,
    emission,
  };
}

function toVector(state: Pick<LadderState, "reservoir" | "occupation">, m: number): Float64Array {
  if (state.occupation.length !== m) throw new RangeError("ladder: state has the wrong number of bins");
  const y = new Float64Array(m + 1);
  y[0] = state.reservoir;
  y.set(state.occupation, 1);
  return y;
}

/**
 * Right-hand side and Jacobian for the state y = [N_R, n_0, …, n_N] under a
 * pump rate P(t), particles/s.
 */
export function ladderSystem(ladder: Ladder, pump: (t: number) => number) {
  const { decay, coupling, states, thermal } = ladder;
  const m = decay.length;
  const size = m + 1;
  const nMol = ladder.params.molecules;
  const gExc = ladder.params.excitonDecay;
  const into = new Float64Array(m); // Σ_m W_jm n_m
  const out = new Float64Array(m); // Σ_m W_mj (n_m + D_m)

  const sums = (y: Float64Array) => {
    into.fill(0);
    out.fill(0);
    for (let j = 0; j < m; j++) {
      const row = j * m;
      const final = y[j + 1] + states[j];
      let s = 0;
      for (let i = 0; i < m; i++) {
        s += thermal[row + i] * y[i + 1];
        out[i] += thermal[row + i] * final;
      }
      into[j] = s;
    }
  };

  const f = (t: number, y: Float64Array, dy: Float64Array) => {
    sums(y);
    const x = y[0] / nMol;
    let feed = 0;
    for (let j = 0; j < m; j++) {
      const n = y[j + 1];
      const final = n + states[j];
      const g = coupling[j] * x * final;
      feed += g;
      dy[j + 1] = -decay[j] * n + g + final * into[j] - n * out[j];
    }
    dy[0] = pump(t) - gExc * y[0] - feed;
  };

  const jacobian = (_t: number, y: Float64Array, a: Float64Array) => {
    sums(y);
    const x = y[0] / nMol;
    let gain = 0;
    for (let j = 0; j < m; j++) {
      const n = y[j + 1];
      const final = n + states[j];
      const row = (j + 1) * size;
      gain += coupling[j] * final;
      a[j + 1] = -coupling[j] * x;
      a[row] = (coupling[j] * final) / nMol;
      for (let i = 0; i < m; i++) a[row + i + 1] = final * thermal[j * m + i] - n * thermal[i * m + j];
      a[row + j + 1] += -decay[j] + coupling[j] * x + into[j] - out[j];
    }
    a[0] = -gExc - gain / nMol;
  };

  return { f, jacobian, size };
}

export interface SteadyStateOptions {
  /** Starting populations, e.g. the previous point of a power series. Default: solved from empty. */
  initial?: Pick<LadderState, "reservoir" | "occupation">;
  /** Relative size of the last Newton step at which to stop. Default 1e-10. */
  tolerance?: number;
  /** Give up after this many linear solves. Default 400. */
  maxIterations?: number;
}

/**
 * Steady state under a constant pump rate P (particles/s; P = γ_Exc ϰ).
 * Takes implicit Euler steps of growing length (each one a Newton step on the
 * step equation), which follow the physical transient at first and turn into
 * Newton's method on dy/dt = 0 as the step grows.
 */
export function ladderSteadyState(
  ladderOrParams: Ladder | LadderParams,
  P: number,
  options: SteadyStateOptions = {},
): LadderState {
  if (!(P >= 0)) throw new RangeError("ladderSteadyState: pump must be non-negative");
  const ladder = "energy" in ladderOrParams ? ladderOrParams : buildLadder(ladderOrParams);
  const m = ladder.energy.length;
  const { f, jacobian, size } = ladderSystem(ladder, () => P);
  const tol = options.tolerance ?? 1e-10;
  const maxIterations = options.maxIterations ?? 400;

  const y = options.initial ? toVector(options.initial, m) : new Float64Array(size);
  const dy = new Float64Array(size);
  const a = new Float64Array(size * size);
  const trial = new Float64Array(size);

  // Fastest and slowest rates in the problem bracket the step lengths.
  let fastest = ladder.params.excitonDecay;
  for (let j = 0; j < m; j++) fastest = Math.max(fastest, ladder.decay[j], ladder.coupling[j]);
  if (!(fastest > 0)) throw new RangeError("ladderSteadyState: nothing decays, so there is no steady state");
  const dtMin = 1 / fastest;
  // Past this the step is taken as infinite: plain Newton on dy/dt = 0.
  const dtMax = 1e10 / fastest;
  // A given starting point is probably close: try Newton on it straight away.
  let dt = options.initial ? dtMax : dtMin;

  for (let iter = 0; iter < maxIterations; iter++) {
    f(0, y, dy);
    jacobian(0, y, a);
    // Solve (I/dt − J) δ = f.
    for (let i = 0; i < size * size; i++) a[i] = -a[i];
    const invDt = dt >= dtMax ? 0 : 1 / dt;
    for (let i = 0; i < size; i++) a[i * size + i] += invDt;
    let ok = true;
    let step = 0;
    try {
      luSolve(luFactor(a, size), dy);
    } catch {
      ok = false;
    }
    if (ok) {
      for (let i = 0; i < size; i++) {
        const v = y[i] + dy[i];
        if (!Number.isFinite(v)) ok = false;
        // A population cannot go negative; a step that tries to is too long.
        if (v < -1e-9 * (Math.abs(y[i]) + 1)) ok = false;
        trial[i] = Math.max(v, 0);
        step = Math.max(step, Math.abs(dy[i]) / (Math.abs(trial[i]) + 1e-300));
      }
    }
    if (!ok) {
      dt = dt >= dtMax ? 1e-4 * dtMax : Math.max(dt * 0.1, 1e-3 * dtMin);
      continue;
    }
    y.set(trial);
    if (dt >= dtMax && step < tol) return toState(ladder, y);
    dt = Math.min(dt * 10, dtMax);
  }
  throw new RangeError("ladderSteadyState: did not converge");
}

/** One point of a continuous-wave power series. */
export interface LadderPowerPoint extends LadderState {
  /** Pump rate P, particles/s. */
  pump: number;
}

/**
 * Steady states for a list of pump rates (particles/s), each started from the
 * previous one. Order the rates as you like; ascending is fastest.
 */
export function ladderPowerSeries(
  ladderOrParams: Ladder | LadderParams,
  pumps: ArrayLike<number>,
  options: Omit<SteadyStateOptions, "initial"> = {},
): LadderPowerPoint[] {
  const ladder = "energy" in ladderOrParams ? ladderOrParams : buildLadder(ladderOrParams);
  const points: LadderPowerPoint[] = [];
  let initial: LadderState | undefined;
  for (let i = 0; i < pumps.length; i++) {
    let state: LadderState;
    try {
      state = ladderSteadyState(ladder, pumps[i], { ...options, initial });
    } catch {
      state = ladderSteadyState(ladder, pumps[i], options);
    }
    initial = state;
    points.push({ pump: pumps[i], ...state });
  }
  return points;
}

export interface LadderSimulateOptions extends StiffOptions {
  /** End time, s. Default: CW 20/γ_Exc; pulse peak + 5·fwhm + 20/γ_Exc. */
  duration?: number;
  /** Starting populations. Default empty. */
  initial?: Pick<LadderState, "reservoir" | "occupation">;
}

/** Time trace of the ladder. */
export interface LadderSimulation {
  /** Times of the accepted steps, s. */
  t: number[];
  /** Populations at each time. */
  states: LadderState[];
  /** Time-integrated photons from each bin, γ_Cav cos²φ_j ∫ n_j dt, photons. */
  emitted: Float64Array;
}

/**
 * Integrates the ladder in time under a CW or pulsed pump (`Pump` of
 * rate-equations.ts: rate in particles/s, pulse energy in absorbed particles).
 * Uses the stiff integrator, since stimulated rates above threshold are many
 * orders faster than the reservoir decay.
 */
export function simulateLadder(
  ladderOrParams: Ladder | LadderParams,
  pump: Pump,
  options: LadderSimulateOptions = {},
): LadderSimulation {
  const ladder = "energy" in ladderOrParams ? ladderOrParams : buildLadder(ladderOrParams);
  const m = ladder.energy.length;
  const { duration, initial, ...stiff } = options;
  const { f, jacobian, size } = ladderSystem(ladder, (t) => pumpRate(pump, t));
  const y0 = initial ? toVector(initial, m) : new Float64Array(size);
  const opts: StiffOptions = { nonNegative: true, ...stiff };

  const slow = ladder.params.excitonDecay;
  const needDuration = () => {
    if (!(slow > 0)) throw new RangeError("simulateLadder: give a duration when the reservoir does not decay");
    return 20 / slow;
  };

  let t: number[];
  let ys: Float64Array[];
  if (pump.kind === "cw") {
    ({ t, y: ys } = integrateStiff(f, jacobian, y0, 0, duration ?? needDuration(), opts));
  } else {
    // Resolve the pulse with short steps, then let the decay run freely.
    const center = pump.center ?? 3 * pump.fwhm;
    const split0 = center + 5 * pump.fwhm;
    const end = duration ?? split0 + needDuration();
    const split = Math.min(split0, end);
    const maxStep = Math.min(opts.maxStep ?? Infinity, pump.fwhm / 10);
    const a = integrateStiff(f, jacobian, y0, 0, split, { ...opts, maxStep });
    const b = integrateStiff(f, jacobian, a.y[a.y.length - 1], split, end, opts);
    t = [...a.t, ...b.t.slice(1)];
    ys = [...a.y, ...b.y.slice(1)];
  }

  // Trapezoid rule over the accepted steps, second order like the integrator.
  const emitted = new Float64Array(m);
  for (let s = 1; s < t.length; s++) {
    const half = 0.5 * (t[s] - t[s - 1]);
    for (let j = 0; j < m; j++) emitted[j] += half * (ys[s][j + 1] + ys[s - 1][j + 1]);
  }
  for (let j = 0; j < m; j++) emitted[j] *= ladder.params.cavityDecay * ladder.photonFraction[j];

  return { t, states: ys.map((y) => toState(ladder, y)), emitted };
}
