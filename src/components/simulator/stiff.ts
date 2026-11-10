// Stiff ODE support: dense LU and an adaptive Rosenbrock integrator.
// For systems where the explicit integrator of integrate.ts would need steps
// far shorter than the dynamics of interest, such as the polariton ladder
// above threshold. Units are whatever the caller uses.

/** Writes dy/dt at time t for state y into `out`. */
export type DerivativeInto = (t: number, y: Float64Array, out: Float64Array) => void;

/** Writes the Jacobian ∂f_i/∂y_j at (t, y) into `out`, row-major n × n. */
export type JacobianInto = (t: number, y: Float64Array, out: Float64Array) => void;

/** An LU factorisation with partial pivoting, as left by `luFactor`. */
export interface LU {
  n: number;
  /** L (unit diagonal, below) and U (on and above the diagonal), row-major. */
  lu: Float64Array;
  /** Row swapped with row i at elimination step i. */
  pivots: Int32Array;
}

/**
 * Factorises the n × n row-major matrix `a` in place. Throws if a pivot is
 * exactly zero (singular matrix).
 */
export function luFactor(a: Float64Array, n: number): LU {
  if (a.length !== n * n) throw new RangeError("luFactor: matrix must be n × n");
  const pivots = new Int32Array(n);
  for (let k = 0; k < n; k++) {
    let p = k;
    let best = Math.abs(a[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(a[i * n + k]);
      if (v > best) {
        best = v;
        p = i;
      }
    }
    if (!(best > 0)) throw new RangeError("luFactor: matrix is singular");
    pivots[k] = p;
    if (p !== k) {
      for (let j = 0; j < n; j++) {
        const tmp = a[k * n + j];
        a[k * n + j] = a[p * n + j];
        a[p * n + j] = tmp;
      }
    }
    const inv = 1 / a[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const row = i * n;
      const m = a[row + k] * inv;
      if (m === 0) continue;
      a[row + k] = m;
      for (let j = k + 1; j < n; j++) a[row + j] -= m * a[k * n + j];
    }
  }
  return { n, lu: a, pivots };
}

/** Solves A x = b in place: `b` comes in as the right-hand side, leaves as x. */
export function luSolve(f: LU, b: Float64Array): Float64Array {
  const { n, lu, pivots } = f;
  // Rows of L were swapped along with the rest, so permute b fully first.
  for (let k = 0; k < n; k++) {
    const p = pivots[k];
    if (p !== k) {
      const tmp = b[k];
      b[k] = b[p];
      b[p] = tmp;
    }
  }
  for (let k = 0; k < n; k++) {
    const bk = b[k];
    if (bk !== 0) for (let i = k + 1; i < n; i++) b[i] -= lu[i * n + k] * bk;
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= lu[i * n + j] * b[j];
    b[i] = s / lu[i * n + i];
  }
  return b;
}

export interface StiffOptions {
  /** Relative tolerance per component. Default 1e-5. */
  rtol?: number;
  /** Absolute tolerance, scalar or per component. Default 1e-9. */
  atol?: number | ArrayLike<number>;
  /** Largest step allowed, in time units. Default: the whole span. */
  maxStep?: number;
  /** First step to try, in time units. Default: span × 1e-6. */
  initialStep?: number;
  /** Give up after this many steps (accepted or rejected). Default 1e6. */
  maxSteps?: number;
  /** Clip negative components to zero after each step. Default false. */
  nonNegative?: boolean;
}

/** Time points and the state at each, starting at t0 and ending at t1. */
export interface StiffTrajectory {
  t: number[];
  y: Float64Array[];
}

// The modified Rosenbrock pair of Shampine and Reichelt (MATLAB's ode23s):
// second order, L-stable, one LU and three right-hand sides per step, the last
// reused as the first of the next step. With d = 1/(2 + √2), W = I − h d J and
// T = ∂f/∂t:
//   k1 = W⁻¹ (f0 + h d T)
//   f1 = f(t + h/2, y + (h/2) k1),  k2 = W⁻¹ (f1 − k1) + k1
//   y⁺ = y + h k2
//   f2 = f(t + h, y⁺)
//   k3 = W⁻¹ (f2 − (6 + √2)(k2 − f1) − 2 (k1 − f0) + h d T)
//   error ≈ (h/6)(k1 − 2 k2 + k3)
const D = 1 / (2 + Math.SQRT2);
const E32 = 6 + Math.SQRT2;

/**
 * Integrates the stiff system dy/dt = f(t, y) from t0 to t1 (t1 ≥ t0) and
 * returns every accepted step. ∂f/∂t is taken by a forward difference.
 */
export function integrateStiff(
  f: DerivativeInto,
  jacobian: JacobianInto,
  y0: ArrayLike<number>,
  t0: number,
  t1: number,
  options: StiffOptions = {},
): StiffTrajectory {
  if (!(t1 >= t0)) throw new RangeError("integrateStiff: t1 must be at or after t0");
  const n = y0.length;
  let y = Float64Array.from(y0);
  const out: StiffTrajectory = { t: [t0], y: [y] };
  if (t1 === t0) return out;

  const span = t1 - t0;
  const rtol = options.rtol ?? 1e-5;
  const atol = options.atol ?? 1e-9;
  const atolAt = typeof atol === "number" ? () => atol : (i: number) => atol[i];
  const maxStep = Math.min(options.maxStep ?? span, span);
  const maxSteps = options.maxSteps ?? 1e6;

  const a = new Float64Array(n * n);
  const jac = new Float64Array(n * n);
  let f0 = new Float64Array(n);
  let f2 = new Float64Array(n);
  const f1 = new Float64Array(n);
  const dfdt = new Float64Array(n);
  const k1 = new Float64Array(n);
  const k2 = new Float64Array(n);
  const k3 = new Float64Array(n);
  const stage = new Float64Array(n);

  let t = t0;
  let h = Math.min(options.initialStep ?? span * 1e-6, maxStep);
  let steps = 0;
  let fresh = true; // f0, jac and dfdt need evaluating at (t, y)
  f(t, y, f0);
  while (t < t1) {
    if (++steps > maxSteps) throw new RangeError("integrateStiff: too many steps");
    const last = t + h >= t1 || t1 - (t + h) < 1e-12 * span;
    if (last) h = t1 - t;
    if (!(h > 0) || t + h === t) throw new RangeError("integrateStiff: step size underflow");

    if (fresh) {
      jacobian(t, y, jac);
      fresh = false;
    }
    // ∂f/∂t over a small fraction of the step being tried.
    const dtT = Math.max(1e-4 * h, 1e-12 * Math.max(Math.abs(t), span));
    f(t + dtT, y, dfdt);
    for (let i = 0; i < n; i++) dfdt[i] = (dfdt[i] - f0[i]) / dtT;

    const hd = h * D;
    for (let i = 0; i < n * n; i++) a[i] = -hd * jac[i];
    for (let i = 0; i < n; i++) a[i * n + i] += 1;
    const lu = luFactor(a, n);

    for (let i = 0; i < n; i++) k1[i] = f0[i] + hd * dfdt[i];
    luSolve(lu, k1);
    for (let i = 0; i < n; i++) stage[i] = y[i] + 0.5 * h * k1[i];
    f(t + 0.5 * h, stage, f1);
    for (let i = 0; i < n; i++) k2[i] = f1[i] - k1[i];
    luSolve(lu, k2);
    const next = new Float64Array(n);
    let finite = true;
    for (let i = 0; i < n; i++) {
      k2[i] += k1[i];
      let v = y[i] + h * k2[i];
      if (options.nonNegative && v < 0) v = 0;
      if (!Number.isFinite(v)) finite = false;
      next[i] = v;
    }
    let err = Infinity;
    if (finite) {
      f(t + h, next, f2);
      for (let i = 0; i < n; i++) k3[i] = f2[i] - E32 * (k2[i] - f1[i]) - 2 * (k1[i] - f0[i]) + hd * dfdt[i];
      luSolve(lu, k3);
      err = 0;
      for (let i = 0; i < n; i++) {
        const scale = atolAt(i) + rtol * Math.max(Math.abs(y[i]), Math.abs(next[i]));
        const e = ((h / 6) * (k1[i] - 2 * k2[i] + k3[i])) / scale;
        err += e * e;
      }
      err = Math.sqrt(err / n);
      if (Number.isNaN(err)) err = Infinity;
    }

    if (err <= 1) {
      t = last ? t1 : t + h;
      y = next;
      out.t.push(t);
      out.y.push(y);
      [f0, f2] = [f2, f0];
      fresh = true;
    }
    const factor = err === 0 ? 5 : 0.8 / Math.cbrt(err);
    h = Math.min(h * Math.min(5, Math.max(0.2, factor)), maxStep);
  }
  return out;
}
