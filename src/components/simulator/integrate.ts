// General Runge–Kutta integrator for dy/dt = f(t, y) over a state vector.
// Adaptive Dormand–Prince 5(4) by default, or classic fixed-step RK4.
// Units are whatever the caller uses; the simulator passes seconds.

/** Right-hand side: returns dy/dt at time t for state y. */
export type Derivative = (t: number, y: readonly number[]) => number[];

export interface IntegrateOptions {
  /** "dopri5" (adaptive, default) or "rk4" (fixed step). */
  method?: "dopri5" | "rk4";
  /** Relative tolerance per component (dopri5). Default 1e-6. */
  rtol?: number;
  /** Absolute tolerance, scalar or per component (dopri5). Default 1e-9. */
  atol?: number | readonly number[];
  /** Largest step allowed, in time units (dopri5). Default: the whole span. */
  maxStep?: number;
  /** First step to try, in time units (dopri5). Default: estimated. */
  initialStep?: number;
  /** Step size for rk4, in time units. Default: span / 1000. */
  step?: number;
  /** Give up after this many steps (accepted or rejected). Default 1e6. */
  maxSteps?: number;
}

/** Time points and the state at each, starting at t0 and ending at t1. */
export interface Trajectory {
  t: number[];
  y: number[][];
}

/** Integrates from t0 to t1 (t1 ≥ t0) and returns every accepted step. */
export function integrate(
  f: Derivative,
  y0: readonly number[],
  t0: number,
  t1: number,
  options: IntegrateOptions = {},
): Trajectory {
  if (!(t1 >= t0)) throw new RangeError("integrate: t1 must be at or after t0");
  if (t1 === t0) return { t: [t0], y: [[...y0]] };
  return options.method === "rk4" ? rk4(f, y0, t0, t1, options) : dopri5(f, y0, t0, t1, options);
}

function rk4(f: Derivative, y0: readonly number[], t0: number, t1: number, o: IntegrateOptions): Trajectory {
  const span = t1 - t0;
  const n = Math.max(1, Math.ceil(span / (o.step ?? span / 1000) - 1e-9));
  if (n > (o.maxSteps ?? 1e6)) throw new RangeError("integrate: too many steps");
  const h = span / n;
  const t = [t0];
  const y = [[...y0]];
  let cur = [...y0];
  for (let i = 0; i < n; i++) {
    const ti = t0 + i * h;
    const k1 = f(ti, cur);
    const k2 = f(ti + h / 2, axpy(cur, h / 2, k1));
    const k3 = f(ti + h / 2, axpy(cur, h / 2, k2));
    const k4 = f(ti + h, axpy(cur, h, k3));
    cur = cur.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    t.push(i === n - 1 ? t1 : t0 + (i + 1) * h);
    y.push(cur);
  }
  return { t, y };
}

// Dormand–Prince 5(4) tableau.
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
const A: number[][] = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
// Fifth-order minus embedded fourth-order weights.
const E = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40];

function dopri5(f: Derivative, y0: readonly number[], t0: number, t1: number, o: IntegrateOptions): Trajectory {
  const rtol = o.rtol ?? 1e-6;
  const atolOpt = o.atol ?? 1e-9;
  const atol = (j: number) => (typeof atolOpt === "number" ? atolOpt : atolOpt[j]);
  const span = t1 - t0;
  const maxStep = Math.min(o.maxStep ?? span, span);
  const maxSteps = o.maxSteps ?? 1e6;
  const dim = y0.length;

  // Max-norm of an error vector scaled by the tolerances.
  const norm = (v: readonly number[], a: readonly number[], b: readonly number[]) => {
    let m = 0;
    for (let j = 0; j < dim; j++) {
      const sc = atol(j) + rtol * Math.max(Math.abs(a[j]), Math.abs(b[j]));
      m = Math.max(m, Math.abs(v[j]) / sc);
    }
    return m;
  };

  let t = t0;
  let y = [...y0];
  let k1 = f(t, y);
  let h = Math.min(o.initialStep ?? initialStep(f, t, y, k1, norm, span), maxStep);
  const ts = [t0];
  const ys = [[...y0]];
  let steps = 0;

  while (t < t1) {
    if (++steps > maxSteps) throw new RangeError("integrate: too many steps");
    const last = t + h >= t1 - 1e-12 * span;
    if (last) h = t1 - t;
    if (h <= 16 * Number.EPSILON * Math.max(Math.abs(t), span)) throw new RangeError("integrate: step size underflow");

    const k = [k1];
    for (let s = 1; s < 7; s++) {
      const ys1 = y.slice();
      for (let j = 0; j < dim; j++) {
        let acc = 0;
        for (let r = 0; r < s; r++) acc += A[s][r] * k[r][j];
        ys1[j] += h * acc;
      }
      // Stage 7 is the fifth-order solution itself (FSAL).
      if (s === 6) {
        const k7 = f(t + h, ys1);
        k.push(k7);
        const errVec = new Array<number>(dim);
        for (let j = 0; j < dim; j++) {
          let e = 0;
          for (let r = 0; r < 7; r++) e += E[r] * k[r][j];
          errVec[j] = h * e;
        }
        let err = norm(errVec, y, ys1);
        if (!Number.isFinite(err) || ys1.some((v) => !Number.isFinite(v))) err = Infinity;
        if (err <= 1) {
          t = last ? t1 : t + h;
          y = ys1;
          k1 = k7;
          ts.push(t);
          ys.push(y);
          h *= clamp(0.9 * Math.pow(Math.max(err, 1e-10), -0.2), 0.2, 10);
        } else {
          h *= clamp(0.9 * Math.pow(err, -0.2), 0.1, 1);
        }
        h = Math.min(h, maxStep);
      } else {
        k.push(f(t + C[s] * h, ys1));
      }
    }
  }
  return { t: ts, y: ys };
}

// Starting step estimate after Hairer, Nørsett & Wanner (II.4), scaled to the span.
function initialStep(
  f: Derivative,
  t: number,
  y: readonly number[],
  f0: readonly number[],
  norm: (v: readonly number[], a: readonly number[], b: readonly number[]) => number,
  span: number,
): number {
  const d0 = norm(y, y, y);
  const d1 = norm(f0, y, y);
  const h0 = d0 < 1e-5 || d1 < 1e-5 ? 1e-6 * span : (0.01 * d0) / d1;
  const y1 = axpy(y, h0, f0);
  const f1 = f(t + h0, y1);
  const d2 = norm(f1.map((v, j) => v - f0[j]), y, y) / h0;
  const dmax = Math.max(d1, d2);
  const h1 = dmax <= 1e-15 ? Math.max(1e-6 * span, h0 * 1e-3) : Math.pow(0.01 / dmax, 0.2);
  return Math.min(100 * h0, h1);
}

function axpy(y: readonly number[], a: number, x: readonly number[]): number[] {
  return y.map((v, j) => v + a * x[j]);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
