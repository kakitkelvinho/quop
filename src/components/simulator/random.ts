// A small seeded random number generator: uniform, normal and Poisson draws.
// sfc32 seeded through splitmix32, so the same seed gives the same sequence.

export interface Random {
  /** Uniform on the open interval (0, 1). */
  uniform(): number;
  /** Standard normal, mean 0 and variance 1. */
  normal(): number;
  /** Poisson with the given mean (≥ 0); returns a non-negative integer. */
  poisson(mean: number): number;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/** log Γ(x) for x > 0 (Lanczos, about 15 digits). */
export function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** A generator for an integer seed (any number; it is folded to 32 bits). */
export function createRandom(seed: number): Random {
  const mix = splitmix32(Math.floor(seed) | 0);
  let a = mix();
  let b = mix();
  let c = mix();
  let d = mix();
  const next32 = (): number => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t;
  };
  for (let i = 0; i < 12; i++) next32();

  const uniform = (): number => (next32() + 0.5) / 4294967296;

  let spare = NaN;
  const normal = (): number => {
    if (!Number.isNaN(spare)) {
      const s = spare;
      spare = NaN;
      return s;
    }
    const r = Math.sqrt(-2 * Math.log(uniform()));
    const phi = 2 * Math.PI * uniform();
    spare = r * Math.sin(phi);
    return r * Math.cos(phi);
  };

  // Small means: multiply uniforms (Knuth). Large means: PTRS, Hörmann (1993).
  const poisson = (mean: number): number => {
    if (!(mean > 0)) return 0;
    if (mean < 10) {
      const limit = Math.exp(-mean);
      let k = 0;
      let p = uniform();
      while (p > limit) {
        k++;
        p *= uniform();
      }
      return k;
    }
    const smu = Math.sqrt(mean);
    const b = 0.931 + 2.53 * smu;
    const aa = -0.059 + 0.02483 * b;
    const invAlpha = 1.1239 + 1.1328 / (b - 3.4);
    const vr = 0.9277 - 3.6224 / (b - 2);
    const logMean = Math.log(mean);
    for (;;) {
      const u = uniform() - 0.5;
      const v = uniform();
      const us = 0.5 - Math.abs(u);
      const k = Math.floor(((2 * aa) / us + b) * u + mean + 0.43);
      if (us >= 0.07 && v <= vr) return k;
      if (k < 0 || (us < 0.013 && v > us)) continue;
      const lhs = Math.log(v) + Math.log(invAlpha) - Math.log(aa / (us * us) + b);
      if (lhs <= -mean + k * logMean - logGamma(k + 1)) return k;
    }
  };

  return { uniform, normal, poisson };
}
