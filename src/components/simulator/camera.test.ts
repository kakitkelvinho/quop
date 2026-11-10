import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type Frame, expectedElectrons, expose, frameRange } from "./camera.ts";

const flat = (value: number, width = 200, height = 200): Frame => ({
  width,
  height,
  pixels: new Float32Array(width * height).fill(value),
  wavelengths: new Float64Array(width),
  positions: new Float64Array(height),
});

function stats(a: ArrayLike<number>): { mean: number; variance: number } {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  const mean = s / a.length;
  let v = 0;
  for (let i = 0; i < a.length; i++) v += (a[i] - mean) ** 2;
  return { mean, variance: v / (a.length - 1) };
}

// 4 units × 100 photons/s/unit × 2 s × QE 0.5 = 400 e⁻ per pixel.
const settings = { photonsPerUnit: 100, exposure: 2, quantumEfficiency: 0.5, readNoise: 10, gain: 2, offset: 100, seed: 7 };

describe("expose", () => {
  it("computes expected electrons from photons, exposure and QE", () => {
    assert.equal(expectedElectrons(flat(4, 2, 2), settings)[0], 400);
  });

  it("is reproducible with the same seed and differs with another", () => {
    const a = expose(flat(4, 50, 50), settings);
    const b = expose(flat(4, 50, 50), settings);
    const c = expose(flat(4, 50, 50), { ...settings, seed: 8 });
    assert.deepEqual(a.pixels, b.pixels);
    assert.notDeepEqual(a.pixels, c.pixels);
  });

  it("has the variance of shot plus read noise", () => {
    // counts = e⁻ / gain + offset: mean 400/2 + 100 = 300,
    // variance (400 + 10²) / 2² + 1/12 (rounding) = 125.08.
    const { mean, variance } = stats(expose(flat(4), settings).pixels);
    assert.ok(Math.abs(mean - 300) < 0.3, `mean ${mean}`);
    assert.ok(Math.abs(variance / 125.08 - 1) < 0.05, `variance ${variance}`);
  });

  it("is Poisson for a faint frame with no read noise", () => {
    const { mean, variance } = stats(expose(flat(0.03), { photonsPerUnit: 100, exposure: 1, seed: 3 }).pixels);
    assert.ok(Math.abs(mean - 3) < 0.05, `mean ${mean}`);
    assert.ok(Math.abs(variance / 3 - 1) < 0.05, `variance ${variance}`);
  });

  it("clips at saturation, 2^bitDepth − 1", () => {
    const frame = expose(flat(1e6, 20, 20), { ...settings, bitDepth: 8 });
    assert.deepEqual(frameRange(frame), { min: 255, max: 255 });
    const dark = expose(flat(0, 20, 20), { ...settings, offset: 0, readNoise: 5 });
    assert.ok(frameRange(dark).min >= 0);
  });

  it("keeps the frame's axes", () => {
    const frame = flat(1, 3, 2);
    frame.wavelengths.set([1, 2, 3]);
    assert.deepEqual(expose(frame, settings).wavelengths, frame.wavelengths);
  });
});
