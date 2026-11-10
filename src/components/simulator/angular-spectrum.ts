// Scalar wave propagation by the angular spectrum (transfer function)
// method, a port of propTF.m / backpropTF.m in the style of Voelz,
// "Computational Fourier Optics". SI units throughout (m).
//
// Grid: square, side length L (`size`), n samples per side, dx = L/n,
// x_j = (j − n/2)·dx for j = 0…n−1, so x = 0 sits at index n/2.
// Frequencies fx = −1/(2dx) : 1/L : 1/(2dx) − 1/L, as in MATLAB.
//
// Sign convention: physics, e^{i(kz − ωt)}. A wave travelling +z has phase
// +kz, an outgoing spherical wave goes as e^{+ikr}, and a converging one
// (what a positive lens makes) as e^{−ikr²/(2f)}. The transfer function is
// then H = exp(+i k z sqrt(1 − (λfx)² − (λfy)²)). The FFT itself keeps
// MATLAB's e^{−i…} forward kernel; only H and the lens carry the
// convention. Goodman and Voelz use this same sign.
//
// The MATLAB propTF.m this ports uses the engineering e^{i(ωt − kz)}:
// H = exp(−i k z sqrt(…)), and backpropTF.m flips it to +. So
// propagate(u, z) here equals backpropTF(u, z) there, and for fields in
// each code's own convention (complex conjugates of each other),
// propagate(conj(u), z) = conj(propTF(u, z)).

import { fft2, fftshift2, ifft2, ifftshift2, isPowerOfTwo } from "./fft.ts";

/**
 * A complex scalar field on an n×n grid, row-major (index = row·n + col,
 * row along y, col along x), n a power of two.
 */
export type Field = { n: number; re: Float64Array; im: Float64Array };

export type PropagationOptions = {
  /** Physical side length L of the square grid (m). */
  size: number;
  /** Wavelength λ (m). */
  wavelength: number;
  /** Distance (m); negative back-propagates. */
  z: number;
};

/** A zero field on an n×n grid. */
export function createField(n: number): Field {
  if (!isPowerOfTwo(n) || n < 2) throw new Error(`grid size must be a power of two ≥ 2, got ${n}`);
  return { n, re: new Float64Array(n * n), im: new Float64Array(n * n) };
}

/** A copy of a field. */
export function cloneField(field: Field): Field {
  return { n: field.n, re: field.re.slice(), im: field.im.slice() };
}

/** Sample positions x_j = (j − n/2)·L/n (m), the same for y. */
export function gridCoordinates(n: number, size: number): Float64Array {
  const x = new Float64Array(n);
  const dx = size / n;
  for (let j = 0; j < n; j++) x[j] = (j - n / 2) * dx;
  return x;
}

/**
 * Propagates a field a distance z (returns a new field). Same steps as
 * propTF.m: U2 = ifftshift(ifft2(H .* fft2(fftshift(u1)))), with the exact
 * H = exp(+i k z sqrt(1 − (λfx)² − (λfy)²)) (physics sign, see above) and evanescent components
 * (λ²(fx² + fy²) > 1) set to zero. Negative z back-propagates.
 */
export function propagate(field: Field, { size, wavelength, z }: PropagationOptions): Field {
  const { n } = field;
  const out = cloneField(field);
  const { re, im } = out;
  fftshift2(re, im, n);
  fft2(re, im, n);
  // Multiply by H in unshifted frequency order: index i ↔ (i < n/2 ? i : i − n)/L.
  const k = (2 * Math.PI) / wavelength;
  const lf = new Float64Array(n);
  for (let i = 0; i < n; i++) lf[i] = (wavelength * (i < n / 2 ? i : i - n)) / size;
  for (let r = 0; r < n; r++) {
    const ly2 = lf[r] * lf[r];
    for (let c = 0; c < n; c++) {
      const idx = r * n + c;
      const s = 1 - ly2 - lf[c] * lf[c];
      if (s < 0) {
        re[idx] = 0;
        im[idx] = 0;
        continue;
      }
      const phase = k * z * Math.sqrt(s);
      const hr = Math.cos(phase);
      const hi = Math.sin(phase);
      const ur = re[idx];
      const ui = im[idx];
      re[idx] = ur * hr - ui * hi;
      im[idx] = ur * hi + ui * hr;
    }
  }
  ifft2(re, im, n);
  ifftshift2(re, im, n);
  return out;
}

/**
 * A thin lens of focal length f (returns a new field): the quadratic phase
 * exp(−i k (x² + y²)/(2f)), as in Voelz, under the e^{+ikz} convention
 * above: it turns a plane wave into one converging at z = f for f > 0,
 * and diverging for f < 0.
 */
export function thinLens(field: Field, { size, wavelength, f }: { size: number; wavelength: number; f: number }): Field {
  const { n } = field;
  const out = cloneField(field);
  const x = gridCoordinates(n, size);
  const a = -Math.PI / (wavelength * f); // −k/(2f)
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const idx = r * n + c;
      const phase = a * (x[c] * x[c] + x[r] * x[r]);
      const hr = Math.cos(phase);
      const hi = Math.sin(phase);
      const ur = out.re[idx];
      const ui = out.im[idx];
      out.re[idx] = ur * hr - ui * hi;
      out.im[idx] = ur * hi + ui * hr;
    }
  }
  return out;
}

/**
 * A circular aperture of the given diameter centred at (cx, cy) (default
 * the grid centre): zeroes samples with r > D/2 (returns a new field).
 */
export function circularAperture(
  field: Field,
  { size, diameter, cx = 0, cy = 0 }: { size: number; diameter: number; cx?: number; cy?: number },
): Field {
  const { n } = field;
  const out = cloneField(field);
  const x = gridCoordinates(n, size);
  const r2max = (diameter / 2) ** 2;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if ((x[c] - cx) ** 2 + (x[r] - cy) ** 2 > r2max) {
        out.re[r * n + c] = 0;
        out.im[r * n + c] = 0;
      }
    }
  }
  return out;
}

export type SamplingCheck = {
  /** True when H's phase never steps more than π between neighbouring frequency samples. */
  ok: boolean;
  /** "transfer-function" when dx ≥ λ|z|/L (Voelz: TF is the right choice), else "impulse-response". */
  regime: "transfer-function" | "impulse-response";
  /** Grid spacing L/n (m). */
  dx: number;
  /** Voelz's critical spacing λ|z|/L (m). */
  criticalDx: number;
  /** Largest |Δphase| of H between adjacent propagating frequency samples (rad). */
  maxPhaseStep: number;
};

/**
 * Whether an n×n grid of side L samples a propagation over z adequately
 * with the transfer function method, i.e. whether H's phase aliases.
 * Paraxially the max step is ≈ π λ|z|/(dx L), so the two tests agree.
 */
export function checkSampling({ n, size, wavelength, z }: { n: number } & PropagationOptions): SamplingCheck {
  const dx = size / n;
  const criticalDx = (wavelength * Math.abs(z)) / size;
  const k = (2 * Math.PI) / wavelength;
  // Frequencies in MATLAB order, times λ.
  const lf = new Float64Array(n);
  for (let i = 0; i < n; i++) lf[i] = (wavelength * (i - n / 2)) / size;
  // The step along fx grows with |fy|, so scan every row.
  let maxPhaseStep = 0;
  for (let r = 0; r < n; r++) {
    const ly2 = lf[r] * lf[r];
    let prev = NaN;
    for (let c = 0; c < n; c++) {
      const s = 1 - ly2 - lf[c] * lf[c];
      const phase = s >= 0 ? k * z * Math.sqrt(s) : NaN;
      if (!Number.isNaN(phase) && !Number.isNaN(prev)) {
        maxPhaseStep = Math.max(maxPhaseStep, Math.abs(phase - prev));
      }
      prev = phase;
    }
  }
  return {
    ok: maxPhaseStep <= Math.PI,
    regime: dx >= criticalDx ? "transfer-function" : "impulse-response",
    dx,
    criticalDx,
    maxPhaseStep,
  };
}
