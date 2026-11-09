import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type Camera, DEFAULT_CAMERA } from "./camera.ts";
import {
  HC,
  type Spectrometer,
  columnWavelengths,
  disperse,
  gratingAngles,
  linearDispersion,
  positionOf,
  slitImageWidth,
  wavelengthAt,
} from "./spectrometer.ts";

// 1200 /mm, 500 mm, 800 nm centre, default 15° included angle.
const spec: Spectrometer = { grooveDensity: 1.2e6, focalLength: 0.5, centreWavelength: 800e-9 };
const camera: Camera = DEFAULT_CAMERA;
const sum = (a: ArrayLike<number>) => Array.from(a).reduce((s, v) => s + v, 0);
const close = (actual: number, expected: number, rel: number) =>
  assert.ok(Math.abs(actual - expected) <= rel * Math.abs(expected), `${actual} vs ${expected}`);

// One slit cell at rows 128 only (y from 1 to 11 µm), one narrow energy cell at λ.
function line(lambda: number, widthJ = 0): Parameters<typeof disperse>[0] {
  const e = HC / lambda;
  return {
    positions: [6e-6],
    positionEdges: [1e-6, 11e-6],
    energies: [e],
    energyEdges: [e - widthJ / 2, e + widthJ / 2],
    intensity: [1],
  };
}

describe("grating geometry", () => {
  it("matches the hand calculation of the linear dispersion", () => {
    // d = 833.33 nm, D = 15°: sin φ = 800 / (2 · 833.33 · cos 7.5°) → φ = 28.9563°,
    // β = φ − 7.5° = 21.4563°, dλ/dx = d cos β / f = 1.55116 nm/mm.
    const { alpha, beta } = gratingAngles(spec);
    close((alpha * 180) / Math.PI, 36.45627, 1e-6);
    close((beta * 180) / Math.PI, 21.45627, 1e-6);
    close(linearDispersion(spec), 1.551162e-6, 1e-6);
    close(linearDispersion(spec), 1.5e-6, 0.05);
  });

  it("puts the centre wavelength at the camera centre, with the slope of the dispersion", () => {
    close(wavelengthAt(spec, 0), 800e-9, 1e-12);
    const h = 1e-6;
    close((wavelengthAt(spec, h) - wavelengthAt(spec, -h)) / (2 * h), linearDispersion(spec), 1e-8);
    close(positionOf(spec, wavelengthAt(spec, 5e-3)), 5e-3, 1e-9);
    const w = columnWavelengths(spec, camera);
    assert.ok(w[0] < 800e-9 && w[camera.columns - 1] > 800e-9);
    close((w[512] + w[511]) / 2, 800e-9, 1e-7);
  });

  it("returns NaN for a wavelength the grating can't send forward", () => {
    assert.ok(Number.isNaN(positionOf(spec, 3e-6)));
  });
});

describe("disperse", () => {
  it("lands a line narrower than a pixel in the right column and row", () => {
    const w = columnWavelengths(spec, camera);
    const frame = disperse(line(w[700], 1e-25), spec, camera);
    assert.equal(frame.width, camera.columns);
    assert.equal(frame.height, camera.rows);
    assert.equal(frame.pixels.length, camera.columns * camera.rows);
    close(frame.pixels[128 * camera.columns + 700], 1, 1e-6);
    close(sum(frame.pixels), 1, 1e-6);
  });

  it("spreads a line over the slit image with a wide slit", () => {
    const wide = { ...spec, slitWidth: 260e-6 };
    const image = slitImageWidth(wide);
    close(image, 260e-6 * 0.8642024, 1e-6); // w cos α / cos β
    const row = disperse(line(800e-9), wide, camera).pixels.subarray(128 * camera.columns, 129 * camera.columns);
    const lit = Array.from(row.keys()).filter((j) => row[j] > 1e-7);
    const extent = lit[lit.length - 1] - lit[0] + 1;
    const pixels = image / camera.pixelWidth; // 8.64 pixels
    assert.ok(extent >= pixels && extent <= pixels + 2, `extent ${extent}`);
    close(Math.max(...row), camera.pixelWidth / image, 1e-4); // a fully lit column
    close(sum(row), 1, 1e-6);
  });

  it("conserves the total when the spectrum sits inside the camera", () => {
    // Uneven grids in position and energy, a Gaussian band near 800 nm.
    const positions = [-1.2e-3, -0.7e-3, -0.1e-3, 0.4e-3, 1.5e-3];
    const energies: number[] = [];
    for (let i = 0; i < 300; i++) energies.push(HC / 805e-9 + i * i * 2e-25);
    const e0 = HC / 800e-9;
    const intensity: number[] = [];
    for (let p = 0; p < positions.length; p++) {
      for (const e of energies) intensity.push((p + 1) * Math.exp(-(((e - e0) / 2e-21) ** 2)));
    }
    const frame = disperse({ positions, energies, intensity }, { ...spec, slitWidth: 50e-6, magnification: 1.5 }, camera);
    close(sum(frame.pixels), sum(intensity), 1e-6);
  });

  it("maps slit position to rows through the magnification", () => {
    const input = { ...line(800e-9), positions: [13e-6], positionEdges: [0, 26e-6] };
    const frame = disperse(input, { ...spec, magnification: 2 }, camera);
    const rowSum = (i: number) => sum(frame.pixels.subarray(i * camera.columns, (i + 1) * camera.columns));
    close(rowSum(128), 0.5, 1e-6);
    close(rowSum(129), 0.5, 1e-6);
    close(frame.positions[128], 6.5e-6, 1e-9);
  });

  it("loses light that misses the camera", () => {
    assert.equal(sum(disperse(line(700e-9), spec, camera).pixels), 0);
  });
});
