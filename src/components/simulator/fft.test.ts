import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fft, fft2, fftshift, fftshift2, ifft, ifft2, ifftshift2 } from "./fft.ts";

// Deterministic pseudo-random samples in [−1, 1).
function noise(length: number, seed: number): Float64Array {
  const out = new Float64Array(length);
  let s = seed >>> 0;
  for (let i = 0; i < length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = s / 2 ** 31 - 1;
  }
  return out;
}

function maxDiff(a: Float64Array, b: Float64Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

function energy(re: Float64Array, im: Float64Array): number {
  let e = 0;
  for (let i = 0; i < re.length; i++) e += re[i] * re[i] + im[i] * im[i];
  return e;
}

describe("fft", () => {
  it("matches a direct DFT", () => {
    const n = 16;
    const re = noise(n, 1);
    const im = noise(n, 2);
    const wantRe = new Float64Array(n);
    const wantIm = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < n; j++) {
        const a = (-2 * Math.PI * j * k) / n;
        wantRe[k] += re[j] * Math.cos(a) - im[j] * Math.sin(a);
        wantIm[k] += re[j] * Math.sin(a) + im[j] * Math.cos(a);
      }
    }
    fft(re, im);
    assert.ok(maxDiff(re, wantRe) < 1e-12);
    assert.ok(maxDiff(im, wantIm) < 1e-12);
  });

  it("round-trips through ifft", () => {
    for (const n of [1, 2, 8, 1024]) {
      const re0 = noise(n, 3);
      const im0 = noise(n, 4);
      const re = re0.slice();
      const im = im0.slice();
      fft(re, im);
      ifft(re, im);
      assert.ok(maxDiff(re, re0) < 1e-13, `n = ${n}`);
      assert.ok(maxDiff(im, im0) < 1e-13, `n = ${n}`);
    }
  });

  it("satisfies Parseval: Σ|x|² = Σ|X|²/n", () => {
    const n = 512;
    const re = noise(n, 5);
    const im = noise(n, 6);
    const before = energy(re, im);
    fft(re, im);
    assert.ok(Math.abs(energy(re, im) / n - before) < 1e-10 * before);
  });

  it("transforms a Gaussian into a Gaussian", () => {
    // exp(−πx²) is its own Fourier transform; with centred sampling,
    // fftshift(fft(fftshift(g)))·dx approximates it on f = (k − n/2)/(n dx).
    const n = 64;
    const dx = 1 / Math.sqrt(n);
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let j = 0; j < n; j++) re[j] = Math.exp(-Math.PI * ((j - n / 2) * dx) ** 2);
    fftshift(re, im);
    fft(re, im);
    fftshift(re, im);
    const df = 1 / (n * dx);
    for (let k = 0; k < n; k++) {
      const f = (k - n / 2) * df;
      assert.ok(Math.abs(re[k] * dx - Math.exp(-Math.PI * f * f)) < 1e-12, `k = ${k}`);
      assert.ok(Math.abs(im[k] * dx) < 1e-12, `k = ${k}`);
    }
  });

  it("rejects a size that isn't a power of two", () => {
    assert.throws(() => fft(new Float64Array(12), new Float64Array(12)), /power of two/);
  });
});

describe("fft2", () => {
  it("round-trips and satisfies Parseval", () => {
    const n = 64;
    const re0 = noise(n * n, 7);
    const im0 = noise(n * n, 8);
    const re = re0.slice();
    const im = im0.slice();
    fft2(re, im, n);
    assert.ok(Math.abs(energy(re, im) / (n * n) - energy(re0, im0)) < 1e-10 * energy(re0, im0));
    ifft2(re, im, n);
    assert.ok(maxDiff(re, re0) < 1e-13);
    assert.ok(maxDiff(im, im0) < 1e-13);
  });

  it("is separable: a product of 1D signals transforms to the product of their FFTs", () => {
    const n = 16;
    const ar = noise(n, 9);
    const ai = noise(n, 10);
    const br = noise(n, 11);
    const bi = noise(n, 12);
    const re = new Float64Array(n * n);
    const im = new Float64Array(n * n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        re[r * n + c] = br[r] * ar[c] - bi[r] * ai[c];
        im[r * n + c] = br[r] * ai[c] + bi[r] * ar[c];
      }
    }
    fft2(re, im, n);
    fft(ar, ai);
    fft(br, bi);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        assert.ok(Math.abs(re[r * n + c] - (br[r] * ar[c] - bi[r] * ai[c])) < 1e-11);
        assert.ok(Math.abs(im[r * n + c] - (br[r] * ai[c] + bi[r] * ar[c])) < 1e-11);
      }
    }
  });
});

describe("fftshift", () => {
  it("moves sample 0 to the centre, in 1D and 2D, and undoes itself", () => {
    const re = Float64Array.from([0, 1, 2, 3, 4, 5]);
    const im = new Float64Array(6);
    fftshift(re, im);
    assert.deepEqual([...re], [3, 4, 5, 0, 1, 2]);

    const n = 4;
    const re2 = Float64Array.from({ length: n * n }, (_, i) => i);
    const im2 = new Float64Array(n * n);
    fftshift2(re2, im2, n);
    assert.equal(re2[(n / 2) * n + n / 2], 0);
    assert.deepEqual([...re2.slice(0, 4)], [10, 11, 8, 9]);
    ifftshift2(re2, im2, n);
    assert.deepEqual([...re2], Array.from({ length: n * n }, (_, i) => i));
  });
});
