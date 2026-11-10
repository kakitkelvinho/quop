// Reservoir–condensate rate equations for a non-resonantly pumped polariton
// condensate:
//   dn_R/dt = P(t) − γ_R n_R − R n_R (n_0 + 1)
//   dn_0/dt = R n_R (n_0 + 1) − γ_0 n_0
// SI units throughout: time in s, rates in s⁻¹, populations in particles.

import { type IntegrateOptions, integrate } from "./integrate.ts";

export interface RateParams {
  /** Reservoir decay rate γ_R, s⁻¹. */
  gammaR: number;
  /** Condensate decay rate γ_0, s⁻¹ (all of it counted as emission). */
  gamma0: number;
  /** Scattering rate R from reservoir into the condensate, s⁻¹ per particle. */
  R: number;
}

/** Continuous-wave pump at a constant rate, particles/s. */
export interface CwPump {
  kind: "cw";
  rate: number;
}

/** Gaussian pulse injecting `energy` particles in total. */
export interface PulsedPump {
  kind: "pulse";
  /** Total injected particles, ∫P dt. */
  energy: number;
  /** Full width at half maximum of P(t), s. */
  fwhm: number;
  /** Time of the pulse peak, s. Default 3·fwhm, so almost none is cut off at t = 0. */
  center?: number;
}

export type Pump = CwPump | PulsedPump;

/** Populations n_R and n_0, particles. */
export interface Populations {
  nR: number;
  n0: number;
}

const FWHM_TO_SIGMA = 1 / (2 * Math.sqrt(2 * Math.LN2));

/** Threshold pump rate P_th = γ_R γ_0 / R, particles/s. */
export function thresholdPump(params: RateParams): number {
  return (params.gammaR * params.gamma0) / params.R;
}

/** Pump rate P(t), particles/s, at time t (s). */
export function pumpRate(pump: Pump, t: number): number {
  if (pump.kind === "cw") return pump.rate;
  const sigma = pump.fwhm * FWHM_TO_SIGMA;
  const x = (t - pulseCenter(pump)) / sigma;
  return (pump.energy / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * x * x);
}

function pulseCenter(pump: PulsedPump): number {
  return pump.center ?? 3 * pump.fwhm;
}

/** dy/dt for state y = [n_R, n_0] under the given pump. */
export function rateEquations(params: RateParams, pump: Pump) {
  const { gammaR, gamma0, R } = params;
  return (t: number, y: readonly number[]): number[] => {
    const [nR, n0] = y;
    const scatter = R * nR * (n0 + 1);
    return [pumpRate(pump, t) - gammaR * nR - scatter, scatter - gamma0 * n0];
  };
}

/**
 * Closed-form steady state for a constant pump P (particles/s).
 * From dn_0/dt = 0 and the total balance P = γ_R n_R + γ_0 n_0:
 *   γ_0 n_0² + (γ_0 + P_th − P) n_0 − P = 0, take the non-negative root.
 */
export function steadyState(params: RateParams, P: number): Populations {
  const { gammaR, gamma0, R } = params;
  if (!(P >= 0)) throw new RangeError("steadyState: pump must be non-negative");
  if (P === 0) return { nR: 0, n0: 0 };
  if (R === 0) return { nR: P / gammaR, n0: 0 };
  if (gamma0 === 0) throw new RangeError("steadyState: no steady state without condensate decay");
  const b = gamma0 + thresholdPump(params) - P;
  const disc = Math.sqrt(b * b + 4 * gamma0 * P);
  // Pick the form that avoids cancellation.
  const n0 = b > 0 ? (2 * P) / (b + disc) : (disc - b) / (2 * gamma0);
  const nR = (gamma0 * n0) / (R * (n0 + 1));
  return { nR, n0 };
}

export interface SimulateOptions extends IntegrateOptions {
  /** End time, s. Default: CW 20/γ_R; pulse peak + 5·fwhm + 20/γ_R. */
  duration?: number;
  /** Starting populations. Default empty. */
  initial?: Populations;
}

/** Time trace of a simulation. Times in s, populations in particles. */
export interface Simulation {
  t: number[];
  nR: number[];
  n0: number[];
  /** Cumulative emission γ_0 ∫ n_0 dt from t = 0, photons. */
  emitted: number[];
}

/** Integrates the rate equations from empty (or `initial`) under a pump. */
export function simulate(params: RateParams, pump: Pump, options: SimulateOptions = {}): Simulation {
  const { duration, initial, ...integrateOptions } = options;
  const f = rateEquations(params, pump);
  // Emission rides along as a third component.
  const g = (t: number, y: readonly number[]) => [...f(t, y), params.gamma0 * y[1]];
  const opts: IntegrateOptions = { rtol: 1e-8, atol: 1e-10, ...integrateOptions };
  const y0 = [initial?.nR ?? 0, initial?.n0 ?? 0, 0];

  let trajectory;
  if (pump.kind === "cw") {
    trajectory = integrate(g, y0, 0, duration ?? 20 / slowestRate(params), opts);
  } else {
    // Resolve the pulse with short steps, then let the decay run freely.
    const end = duration ?? pulseCenter(pump) + 5 * pump.fwhm + 20 / slowestRate(params);
    const split = Math.min(pulseCenter(pump) + 5 * pump.fwhm, end);
    const maxStep = Math.min(opts.maxStep ?? Infinity, pump.fwhm / 10);
    const a = integrate(g, y0, 0, split, { ...opts, maxStep });
    const b = integrate(g, a.y[a.y.length - 1], split, end, opts);
    trajectory = { t: [...a.t, ...b.t.slice(1)], y: [...a.y, ...b.y.slice(1)] };
  }
  return {
    t: trajectory.t,
    nR: trajectory.y.map((v) => v[0]),
    n0: trajectory.y.map((v) => v[1]),
    emitted: trajectory.y.map((v) => v[2]),
  };
}

// Slowest nonzero decay rate, sets the default run length.
function slowestRate(params: RateParams): number {
  const rates = [params.gammaR, params.gamma0].filter((r) => r > 0);
  if (rates.length === 0) throw new RangeError("simulate: give a duration when nothing decays");
  return Math.min(...rates);
}

export type PowerSeriesPoint =
  | {
      pump: CwPump;
      /** Steady-state populations, particles. */
      nR: number;
      n0: number;
      /** Steady-state emission rate γ_0 n_0, photons/s. */
      emissionRate: number;
    }
  | {
      pump: PulsedPump;
      /** Time-integrated emission γ_0 ∫ n_0 dt, photons. */
      emission: number;
      /** Largest condensate population reached, particles. */
      peakN0: number;
    };

/** Per pump: closed-form steady state (CW) or integrated emission of one pulse. */
export function powerSeries(
  params: RateParams,
  pumps: readonly Pump[],
  options: SimulateOptions = {},
): PowerSeriesPoint[] {
  return pumps.map((pump): PowerSeriesPoint => {
    if (pump.kind === "cw") {
      const { nR, n0 } = steadyState(params, pump.rate);
      return { pump, nR, n0, emissionRate: params.gamma0 * n0 };
    }
    const sim = simulate(params, pump, options);
    const emission = sim.emitted[sim.emitted.length - 1];
    return { pump, emission, peakN0: sim.n0.reduce((m, v) => Math.max(m, v), 0) };
  });
}
