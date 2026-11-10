import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Field,
  checkSampling,
  circularAperture,
  createField,
  gridCoordinates,
  propagate,
  thinLens,
} from "./angular-spectrum.ts";
import { fft2, fftshift2, ifft2, ifftshift2 } from "./fft.ts";

const wavelength = 1e-6;
const k = (2 * Math.PI) / wavelength;

// A Gaussian waist exp(−r²/w0²) at the grid centre, times an optional tilt e^{i kx x}.
function gaussian(n: number, size: number, w0: number, kx = 0): Field {
  const field = createField(n);
  const x = gridCoordinates(n, size);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const a = Math.exp(-(x[c] ** 2 + x[r] ** 2) / w0 ** 2);
      field.re[r * n + c] = a * Math.cos(kx * x[c]);
      field.im[r * n + c] = a * Math.sin(kx * x[c]);
    }
  }
  return field;
}

// 1/e² intensity radius from the second moment: w = 2 sqrt(<x²>).
function radius(field: Field, size: number): number {
  const x = gridCoordinates(field.n, size);
  let sum = 0;
  let sumX2 = 0;
  for (let r = 0; r < field.n; r++) {
    for (let c = 0; c < field.n; c++) {
      const i = r * field.n + c;
      const p = field.re[i] ** 2 + field.im[i] ** 2;
      sum += p;
      sumX2 += p * x[c] ** 2;
    }
  }
  return 2 * Math.sqrt(sumX2 / sum);
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe("propagate", () => {
  // w0 = 0.1 mm, zR = π w0²/λ ≈ 31 mm; a 3 mm, 256² grid samples z ≤ zR.
  const n = 256;
  const size = 3e-3;
  const w0 = 1e-4;
  const zR = (Math.PI * w0 ** 2) / wavelength;

  it("spreads a Gaussian beam as w(z) = w0 sqrt(1 + (z/zR)²) with the Gouy phase on axis", () => {
    const start = gaussian(n, size, w0);
    const centre = (n / 2) * n + n / 2;
    for (const z of [0.5 * zR, zR, -zR]) {
      assert.ok(checkSampling({ n, size, wavelength, z }).ok);
      const out = propagate(start, { size, wavelength, z });
      const w = w0 * Math.sqrt(1 + (z / zR) ** 2);
      assert.ok(Math.abs(radius(out, size) / w - 1) < 1e-3, `w at z = ${z}`);
      // u(0, z) = e^{+ikz} / (1 + i z/zR): amplitude w0/w, phase kz − atan(z/zR).
      const amp = Math.hypot(out.re[centre], out.im[centre]);
      assert.ok(Math.abs(amp / (w0 / w) - 1) < 1e-5, `amplitude at z = ${z}`);
      const phase = Math.atan2(out.im[centre], out.re[centre]);
      assert.ok(Math.abs(wrap(phase - (k * z - Math.atan(z / zR)))) < 1e-4, `phase at z = ${z}`);
    }
  });

  it("returns the input after propagating forward then back", () => {
    const start = gaussian(n, size, w0, 0.01 * k);
    const there = propagate(start, { size, wavelength, z: 0.02 });
    const back = propagate(there, { size, wavelength, z: -0.02 });
    for (let i = 0; i < n * n; i++) {
      assert.ok(Math.abs(back.re[i] - start.re[i]) < 1e-12);
      assert.ok(Math.abs(back.im[i] - start.im[i]) < 1e-12);
    }
  });

  it("leaves the input field alone and is the identity at z = 0", () => {
    const start = gaussian(16, size, 4e-4);
    const copy = start.re.slice();
    const same = propagate(start, { size, wavelength, z: 0 });
    assert.deepEqual(start.re, copy);
    for (let i = 0; i < 256; i++) assert.ok(Math.abs(same.re[i] - start.re[i]) < 1e-14);
  });

  it("drops evanescent components", () => {
    // dx = λ/4: the highest frequencies on the grid are evanescent.
    const m = 16;
    const L = (m * wavelength) / 4;
    const field = createField(m);
    for (let c = 0; c < m; c++) for (let r = 0; r < m; r++) field.re[r * m + c] = c % 2 === 0 ? 1 : -1;
    const out = propagate(field, { size: L, wavelength, z: 1e-6 });
    for (let i = 0; i < m * m; i++) assert.ok(Math.abs(out.re[i]) < 1e-12 && Math.abs(out.im[i]) < 1e-12);
  });

  it("runs a 1024² propagation well under a second", (t) => {
    const big = gaussian(1024, 1e-2, 1e-3);
    propagate(big, { size: 1e-2, wavelength, z: 0.01 }); // warm up
    const t0 = performance.now();
    propagate(big, { size: 1e-2, wavelength, z: 0.05 });
    const ms = performance.now() - t0;
    t.diagnostic(`1024² propagation: ${ms.toFixed(0)} ms`);
    console.log(`1024² propagation: ${ms.toFixed(0)} ms`);
    assert.ok(ms < 1000);
  });
});

describe("propagate against the MATLAB propTF.m", () => {
  // propTF.m, line for line: H = exp(−ikz sqrt(…)) on the centred grid,
  // U0 = fftshift(fft2(fftshift(u0))), u1 = ifftshift(ifft2(ifftshift(H.*U0))).
  function propTF(u0: Field, L: number, lambda: number, z: number): Field {
    const { n } = u0;
    const re = u0.re.slice();
    const im = u0.im.slice();
    const dx = L / n;
    const kk = (2 * Math.PI) / lambda;
    fftshift2(re, im, n);
    fft2(re, im, n);
    fftshift2(re, im, n);
    for (let r = 0; r < n; r++) {
      const fy = -1 / (2 * dx) + r / L;
      for (let c = 0; c < n; c++) {
        const fx = -1 / (2 * dx) + c / L;
        const i = r * n + c;
        const s = 1 - (lambda * fx) ** 2 - (lambda * fy) ** 2;
        if (fx * fx + fy * fy > 1 / lambda ** 2) {
          re[i] = 0;
          im[i] = 0;
          continue;
        }
        const phase = -kk * z * Math.sqrt(s);
        const [a, b] = [re[i], im[i]];
        re[i] = a * Math.cos(phase) - b * Math.sin(phase);
        im[i] = a * Math.sin(phase) + b * Math.cos(phase);
      }
    }
    ifftshift2(re, im, n);
    ifft2(re, im, n);
    ifftshift2(re, im, n);
    return { n, re, im };
  }
  const conjugate = (f: Field): Field => ({ n: f.n, re: f.re.slice(), im: f.im.map((v) => -v) });

  // A tilted Gaussian plus an off-centre copy, so no symmetry hides a sign error.
  const n = 64;
  const size = 2e-3;
  const z = 0.05;
  const u = gaussian(n, size, 0.2e-3, 3e4);
  for (let i = 0; i < u.re.length; i++) u.im[i] += 0.3 * u.re[(i + 5 * n + 3) % u.re.length];

  function assertClose(a: Field, b: Field) {
    for (let i = 0; i < a.re.length; i++) {
      assert.ok(Math.abs(a.re[i] - b.re[i]) < 1e-12 && Math.abs(a.im[i] - b.im[i]) < 1e-12, `sample ${i}`);
    }
  }

  it("propagate(u, z) equals backpropTF(u, z), i.e. propTF(u, −z)", () => {
    assertClose(propagate(u, { size, wavelength, z }), propTF(u, size, wavelength, -z));
  });

  it("propagate(conj(u), z) equals conj(propTF(u, z)): same physics, opposite convention", () => {
    assertClose(propagate(conjugate(u), { size, wavelength, z }), conjugate(propTF(u, size, wavelength, z)));
  });
});

describe("thinLens", () => {
  it("focuses a collimated beam through a circular aperture to an Airy spot, first zero at 1.22 λf/D", () => {
    // dx = 10 µm, D = 0.64 mm, f = 50 mm: zero at 95 µm, about 9.5 pixels.
    const n = 512;
    const size = 5.12e-3;
    const D = 0.64e-3;
    const f = 0.05;
    const dx = size / n;
    assert.ok(checkSampling({ n, size, wavelength, z: f }).ok);
    const plane = createField(n);
    plane.re.fill(1);
    const lensed = thinLens(circularAperture(plane, { size, diameter: D }), { size, wavelength, f });
    const focus = propagate(lensed, { size, wavelength, z: f });

    const row = (n / 2) * n;
    const I = (c: number) => focus.re[row + c] ** 2 + focus.im[row + c] ** 2;
    const c0 = n / 2;
    // Converges: peak near (πD²/(4λf))² ≈ 41 times the input intensity, at the centre.
    assert.ok(Math.abs(I(c0) / ((Math.PI * D * D) / (4 * wavelength * f)) ** 2 - 1) < 0.05);
    assert.ok(I(c0) >= I(c0 + 1) && I(c0) >= I(c0 - 1));
    // First minimum along +x, refined with a parabola through three samples.
    let j = c0 + 1;
    while (I(j + 1) < I(j)) j++;
    const [a, b, c] = [I(j - 1), I(j), I(j + 1)];
    const zero = (j - c0 + (0.5 * (a - c)) / (a - 2 * b + c)) * dx;
    const want = (1.22 * wavelength * f) / D;
    assert.ok(Math.abs(zero - want) < dx, `first zero ${zero} m, want ${want} m`);
    assert.ok(I(j) < 5e-3 * I(c0));
  });

  it("makes a negative lens diverge", () => {
    const n = 128;
    const size = 4e-3;
    const start = gaussian(n, size, 3e-4);
    const z = 0.05;
    const free = radius(propagate(start, { size, wavelength, z }), size);
    const diverged = radius(propagate(thinLens(start, { size, wavelength, f: -0.1 }), { size, wavelength, z }), size);
    const focused = radius(propagate(thinLens(start, { size, wavelength, f: 0.1 }), { size, wavelength, z }), size);
    assert.ok(diverged > free && focused < free);
  });
});

describe("circularAperture", () => {
  it("keeps samples inside the radius, about a chosen centre", () => {
    const n = 8;
    const size = 8; // dx = 1, x = −4…3
    const field = createField(n);
    field.re.fill(1);
    const out = circularAperture(field, { size, diameter: 2.5, cx: 1, cy: -1 });
    const kept: [number, number][] = [];
    const x = gridCoordinates(n, size);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (out.re[r * n + c] === 1) kept.push([x[c], x[r]]);
    // (1, −1) and its 4 nearest neighbours; the diagonals at √2 > 1.25 are cut.
    assert.equal(kept.length, 5);
  });
});

describe("checkSampling", () => {
  it("agrees with Voelz's dx ≥ λz/L and reports the numbers", () => {
    const n = 256;
    const size = 3e-3;
    const dx = size / n;
    const zCrit = (dx * size) / wavelength;
    const near = checkSampling({ n, size, wavelength, z: 0.9 * zCrit });
    assert.equal(near.ok, true);
    assert.equal(near.regime, "transfer-function");
    assert.equal(near.dx, dx);
    assert.ok(Math.abs(near.criticalDx - 0.9 * dx) < 1e-18);
    assert.ok(near.maxPhaseStep > 0.8 * Math.PI && near.maxPhaseStep < Math.PI);

    const far = checkSampling({ n, size, wavelength, z: -1.2 * zCrit });
    assert.equal(far.ok, false);
    assert.equal(far.regime, "impulse-response");
    assert.ok(far.maxPhaseStep > Math.PI);
  });
});
