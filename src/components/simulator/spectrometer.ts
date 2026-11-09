// An imaging Czerny–Turner spectrometer: grating geometry, the wavelength at
// each camera column, and `disperse`, which images intensity against
// (position along the slit, photon energy) onto the camera's pixel grid.
// SI units: m, J, rad.
//
// Grating equation mλ = d (sin α + sin β), with α the angle of incidence and
// β the angle of diffraction, both from the grating normal. The included
// (deviation) angle D = α − β is fixed by the layout; turning the grating by
// φ sets α = φ + D/2, β = φ − D/2, so mλ = 2 d cos(D/2) sin φ. Collimating and
// camera mirrors share the focal length f.

import { type Camera, type Frame, pixelHeightOf } from "./camera.ts";

/** Planck constant × speed of light, J·m. */
export const HC = 6.62607015e-34 * 299792458;

export interface Spectrometer {
  /** Grooves per metre (1200 /mm = 1.2e6 /m). */
  grooveDensity: number;
  /** Focal length of the collimating and camera mirrors, m. */
  focalLength: number;
  /** Wavelength at the centre of the camera, m. */
  centreWavelength: number;
  /** Included angle D = α − β, rad. Default DEFAULT_INCLUDED_ANGLE. */
  includedAngle?: number;
  /** Diffraction order m. Default 1. */
  order?: number;
  /** Entrance slit width, m. Default 0 (an ideal slit). */
  slitWidth?: number;
  /** Magnification from slit to camera along the slit. Default 1. */
  magnification?: number;
}

/** A typical Czerny–Turner included angle, 15°, in rad. */
export const DEFAULT_INCLUDED_ANGLE = (15 * Math.PI) / 180;

export interface GratingAngles {
  /** Angle of incidence α, rad. */
  alpha: number;
  /** Angle of diffraction β at the centre wavelength, rad. */
  beta: number;
  /** Grating rotation φ = (α + β) / 2, rad. */
  rotation: number;
}

/** Grating angles that put the centre wavelength on the camera centre. NaN if unreachable. */
export function gratingAngles(spec: Spectrometer): GratingAngles {
  const d = 1 / spec.grooveDensity;
  const half = (spec.includedAngle ?? DEFAULT_INCLUDED_ANGLE) / 2;
  const m = spec.order ?? 1;
  const rotation = Math.asin((m * spec.centreWavelength) / (2 * d * Math.cos(half)));
  return { alpha: rotation + half, beta: rotation - half, rotation };
}

/** Linear dispersion at the camera centre, dλ/dx = d cos β / (m f), m per m. */
export function linearDispersion(spec: Spectrometer): number {
  const { beta } = gratingAngles(spec);
  return Math.cos(beta) / (spec.grooveDensity * (spec.order ?? 1) * spec.focalLength);
}

/** Wavelength reaching position x on the camera (from its centre, along the dispersion), m. */
export function wavelengthAt(spec: Spectrometer, x: number): number {
  const { alpha, beta } = gratingAngles(spec);
  const d = 1 / spec.grooveDensity;
  return (d / (spec.order ?? 1)) * (Math.sin(alpha) + Math.sin(beta + Math.atan(x / spec.focalLength)));
}

/** Camera position (from its centre) that wavelength λ reaches, m. NaN if it misses the camera side. */
export function positionOf(spec: Spectrometer, wavelength: number): number {
  const { alpha, beta } = gratingAngles(spec);
  const s = (spec.order ?? 1) * wavelength * spec.grooveDensity - Math.sin(alpha);
  if (!(Math.abs(s) <= 1)) return NaN;
  const gamma = Math.asin(s) - beta;
  if (Math.abs(gamma) >= Math.PI / 2) return NaN;
  return spec.focalLength * Math.tan(gamma);
}

/**
 * Width of the slit's image on the camera at the centre wavelength, m:
 * w cos α / cos β (equal mirrors).
 */
export function slitImageWidth(spec: Spectrometer): number {
  const { alpha, beta } = gratingAngles(spec);
  return ((spec.slitWidth ?? 0) * Math.cos(alpha)) / Math.cos(beta);
}

/** Wavelength at each column centre, m. */
export function columnWavelengths(spec: Spectrometer, camera: Camera): Float64Array {
  const out = new Float64Array(camera.columns);
  for (let j = 0; j < camera.columns; j++) {
    out[j] = wavelengthAt(spec, (j + 0.5 - camera.columns / 2) * camera.pixelWidth);
  }
  return out;
}

/** Slit position imaged onto each row centre, m. */
export function rowPositions(spec: Spectrometer, camera: Camera): Float64Array {
  const out = new Float64Array(camera.rows);
  const mag = spec.magnification ?? 1;
  const h = pixelHeightOf(camera);
  for (let i = 0; i < camera.rows; i++) out[i] = ((i + 0.5 - camera.rows / 2) * h) / mag;
  return out;
}

/**
 * Light at the entrance slit: intensity in each (position, energy) cell, row
 * major (`intensity[p * energies.length + e]`). Values are per cell, not per
 * unit energy, so the total is the plain sum. Cell edges default to midpoints
 * between centres; pass explicit edges (length n + 1) for other grids.
 */
export interface SlitInput {
  /** Cell centres along the slit, m, monotonic. */
  positions: ArrayLike<number>;
  /** Cell centres in photon energy, J, monotonic. */
  energies: ArrayLike<number>;
  intensity: ArrayLike<number>;
  positionEdges?: ArrayLike<number>;
  energyEdges?: ArrayLike<number>;
}

function edgesFromCentres(c: ArrayLike<number>): Float64Array {
  const n = c.length;
  const e = new Float64Array(n + 1);
  if (n === 1) {
    e[0] = e[1] = c[0];
    return e;
  }
  for (let i = 1; i < n; i++) e[i] = (c[i - 1] + c[i]) / 2;
  e[0] = c[0] - (c[1] - c[0]) / 2;
  e[n] = c[n - 1] + (c[n - 1] - c[n - 2]) / 2;
  return e;
}

// Cumulative fraction below u of a box of width a convolved with a box of
// width b, both centred on 0. Widths under `tiny` count as zero.
function boxesCdf(u: number, a: number, b: number, tiny: number): number {
  if (a < tiny) a = 0;
  if (b < tiny) b = 0;
  if (a === 0 && b === 0) return u >= 0 ? 1 : 0;
  if (a === 0 || b === 0) {
    const w = a + b;
    return Math.min(1, Math.max(0, u / w + 0.5));
  }
  const s = (a + b) / 2;
  const d = (a - b) / 2;
  const q = (t: number) => (t > 0 ? (t * t) / 2 : 0);
  const f = (q(u + s) - q(u + d) - q(u - d) + q(u - s)) / (a * b);
  return Math.min(1, Math.max(0, f));
}

// Adds `amount` spread as boxesCdf around `centre` over pixels of `pitch`
// (n pixels, centred on 0) into out[offset + j]. Light off the edges is lost.
function spread(
  out: Float64Array,
  offset: number,
  n: number,
  pitch: number,
  amount: number,
  centre: number,
  a: number,
  b: number,
): void {
  const half = (a + b) / 2;
  const j0 = Math.max(0, Math.floor((centre - half) / pitch + n / 2));
  const j1 = Math.min(n - 1, Math.floor((centre + half) / pitch + n / 2));
  if (j1 < j0) return;
  const tiny = pitch * 1e-6;
  let prev = boxesCdf((j0 - n / 2) * pitch - centre, a, b, tiny);
  for (let j = j0; j <= j1; j++) {
    const next = boxesCdf((j + 1 - n / 2) * pitch - centre, a, b, tiny);
    out[offset + j] += amount * (next - prev);
    prev = next;
  }
}

/**
 * Images the light at the slit onto the camera. Each energy cell maps to an
 * interval of camera position (energy → wavelength → x through the grating
 * equation), blurred by the slit image, and is shared among columns by
 * overlap. Each position cell maps to rows through the magnification, shared
 * by overlap. Light that lands on the camera keeps its total.
 */
export function disperse(input: SlitInput, spec: Spectrometer, camera: Camera): Frame {
  const nP = input.positions.length;
  const nE = input.energies.length;
  const pEdges = input.positionEdges ?? edgesFromCentres(input.positions);
  const eEdges = input.energyEdges ?? edgesFromCentres(input.energies);
  const { columns, rows, pixelWidth } = camera;
  const pixelHeight = pixelHeightOf(camera);
  const f = spec.focalLength;
  const mag = spec.magnification ?? 1;
  const slit = spec.slitWidth ?? 0;
  const { alpha, beta } = gratingAngles(spec);
  // Column weights for each energy cell, as a dense nE × columns table.
  const colWeights = new Float64Array(nE * columns);
  for (let e = 0; e < nE; e++) {
    const x0 = positionOf(spec, HC / eEdges[e]);
    const x1 = positionOf(spec, HC / eEdges[e + 1]);
    if (!Number.isFinite(x0) || !Number.isFinite(x1)) continue;
    const centre = (x0 + x1) / 2;
    // Slit image: w cos α / cos β(λ), stretched by 1 / cos²γ on the flat camera.
    const gamma = Math.atan(centre / f);
    const cosBeta = Math.cos(beta + gamma);
    const blur = (slit * Math.cos(alpha)) / (cosBeta * Math.cos(gamma) ** 2);
    spread(colWeights, e * columns, columns, pixelWidth, 1, centre, Math.abs(x1 - x0), blur);
  }

  // Spectrum per position cell on the columns, then shared among rows.
  const acc = new Float64Array(rows * columns);
  const rowWeights = new Float64Array(rows);
  const spectrum = new Float64Array(columns);
  for (let p = 0; p < nP; p++) {
    spectrum.fill(0);
    let any = false;
    for (let e = 0; e < nE; e++) {
      const v = input.intensity[p * nE + e];
      if (!v) continue;
      any = true;
      const base = e * columns;
      for (let j = 0; j < columns; j++) spectrum[j] += v * colWeights[base + j];
    }
    if (!any) continue;
    rowWeights.fill(0);
    const y0 = pEdges[p] * mag;
    const y1 = pEdges[p + 1] * mag;
    spread(rowWeights, 0, rows, pixelHeight, 1, (y0 + y1) / 2, Math.abs(y1 - y0), 0);
    for (let i = 0; i < rows; i++) {
      const w = rowWeights[i];
      if (!w) continue;
      const base = i * columns;
      for (let j = 0; j < columns; j++) acc[base + j] += w * spectrum[j];
    }
  }

  return {
    width: columns,
    height: rows,
    pixels: Float32Array.from(acc),
    wavelengths: columnWavelengths(spec, camera),
    positions: rowPositions(spec, camera),
  };
}
