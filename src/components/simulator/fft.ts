// Radix-2 complex FFT on split arrays (re, im), 1D and 2D, in place.
// Conventions match MATLAB: forward X[k] = sum x[j] e^{-2πi jk/n} (no
// scaling), inverse carries the 1/n (1/n² in 2D), so ifft(fft(x)) = x.

type Plan = { n: number; cos: Float64Array; sin: Float64Array; rev: Uint32Array };

const plans = new Map<number, Plan>();

/** True for 1, 2, 4, 8, … */
export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

// Twiddles cos/sin(2πk/n) for k < n/2 and the bit-reversal permutation,
// built once per size.
function plan(n: number): Plan {
  let p = plans.get(n);
  if (p) return p;
  if (!isPowerOfTwo(n)) throw new Error(`FFT size must be a power of two, got ${n}`);
  const half = n >> 1;
  const cos = new Float64Array(half);
  const sin = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    cos[k] = Math.cos((2 * Math.PI * k) / n);
    sin[k] = Math.sin((2 * Math.PI * k) / n);
  }
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0, v = i; b < bits; b++, v >>= 1) r = (r << 1) | (v & 1);
    rev[i] = r;
  }
  p = { n, cos, sin, rev };
  plans.set(n, p);
  return p;
}

// Unscaled transform of n contiguous samples starting at `offset`.
// sign = -1 forward, +1 inverse.
function transform(re: Float64Array, im: Float64Array, n: number, offset: number, sign: number): void {
  const { cos, sin, rev } = plan(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = offset + i;
      const b = offset + j;
      const tr = re[a];
      re[a] = re[b];
      re[b] = tr;
      const ti = im[a];
      im[a] = im[b];
      im[b] = ti;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = offset; start < offset + n; start += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cos[k];
        const wi = sign * sin[k];
        const a = start + j;
        const b = a + half;
        const br = re[b];
        const bi = im[b];
        const tr = wr * br - wi * bi;
        const ti = wr * bi + wi * br;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

function checkLength(re: Float64Array, im: Float64Array, length: number): void {
  if (re.length !== length || im.length !== length) {
    throw new Error(`expected re and im of length ${length}, got ${re.length} and ${im.length}`);
  }
}

/** In-place 1D FFT. Length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  checkLength(re, im, re.length);
  transform(re, im, re.length, 0, -1);
}

/** In-place 1D inverse FFT, scaled by 1/n. */
export function ifft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  checkLength(re, im, n);
  transform(re, im, n, 0, 1);
  for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] /= n;
  }
}

// Rows in place, then columns through a scratch buffer.
function transform2(re: Float64Array, im: Float64Array, n: number, sign: number): void {
  checkLength(re, im, n * n);
  for (let row = 0; row < n; row++) transform(re, im, n, row * n, sign);
  const cr = new Float64Array(n);
  const ci = new Float64Array(n);
  for (let col = 0; col < n; col++) {
    for (let r = 0, i = col; r < n; r++, i += n) {
      cr[r] = re[i];
      ci[r] = im[i];
    }
    transform(cr, ci, n, 0, sign);
    for (let r = 0, i = col; r < n; r++, i += n) {
      re[i] = cr[r];
      im[i] = ci[r];
    }
  }
}

/** In-place 2D FFT of a row-major n×n array, n a power of two. */
export function fft2(re: Float64Array, im: Float64Array, n: number): void {
  transform2(re, im, n, -1);
}

/** In-place 2D inverse FFT, scaled by 1/n². */
export function ifft2(re: Float64Array, im: Float64Array, n: number): void {
  transform2(re, im, n, 1);
  const scale = 1 / (n * n);
  for (let i = 0; i < n * n; i++) {
    re[i] *= scale;
    im[i] *= scale;
  }
}

function swapHalves(a: Float64Array): void {
  const half = a.length >> 1;
  for (let i = 0; i < half; i++) {
    const t = a[i];
    a[i] = a[i + half];
    a[i + half] = t;
  }
}

/**
 * In-place 1D fftshift: moves the zero-frequency sample to index n/2.
 * For even n (all power-of-two sizes but 1) it is its own inverse.
 */
export function fftshift(re: Float64Array, im: Float64Array): void {
  if (re.length % 2 !== 0) throw new Error("fftshift needs an even length");
  swapHalves(re);
  swapHalves(im);
}

/** In-place 1D ifftshift; identical to fftshift for even n. */
export const ifftshift = fftshift;

function swapQuadrants(a: Float64Array, n: number): void {
  const h = n >> 1;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const j = (r + h) * n + ((c + h) % n);
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
  }
}

/** In-place 2D fftshift of a row-major n×n array (swaps diagonal quadrants). */
export function fftshift2(re: Float64Array, im: Float64Array, n: number): void {
  if (n % 2 !== 0) throw new Error("fftshift2 needs an even size");
  checkLength(re, im, n * n);
  swapQuadrants(re, n);
  swapQuadrants(im, n);
}

/** In-place 2D ifftshift; identical to fftshift2 for even n. */
export const ifftshift2 = fftshift2;
