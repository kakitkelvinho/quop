// The camera at the spectrometer's exit: its pixel grid, the frame type, and
// `expose`, which turns a frame of light into a frame of counts with shot
// noise, read noise and saturation. SI units: m, s.

import { createRandom } from "./random.ts";

/** A camera's pixel grid. Columns run along the dispersion, rows along the slit. */
export interface Camera {
  /** Number of columns (pixels along the dispersion). */
  columns: number;
  /** Number of rows (pixels along the slit). */
  rows: number;
  /** Pixel pitch along the dispersion, m. */
  pixelWidth: number;
  /** Pixel pitch along the slit, m. Defaults to pixelWidth. */
  pixelHeight?: number;
}

/** A typical scientific CCD: 1024 × 256 pixels of 26 µm. */
export const DEFAULT_CAMERA: Camera = { columns: 1024, rows: 256, pixelWidth: 26e-6, pixelHeight: 26e-6 };

/**
 * One camera frame. `pixels` is row-major: pixel (row, column) is at
 * `row * width + column`. Rows are positions along the slit, columns are
 * wavelengths, both increasing with index.
 */
export interface Frame {
  width: number;
  height: number;
  pixels: Float32Array;
  /** Wavelength at each column centre, m (length `width`). */
  wavelengths: Float64Array;
  /** Position along the slit imaged onto each row centre, m (length `height`). */
  positions: Float64Array;
}

export interface ExposureSettings {
  /** Photons per second arriving per unit of frame intensity. */
  photonsPerUnit: number;
  /** Exposure time, s. */
  exposure: number;
  /** Quantum efficiency, photoelectrons per photon, 0..1. Default 1. */
  quantumEfficiency?: number;
  /** Read noise, e⁻ rms per pixel. Default 0. */
  readNoise?: number;
  /** Gain, e⁻ per count (the usual CCD convention: counts = e⁻ / gain). Default 1. */
  gain?: number;
  /** ADC bit depth; counts saturate at 2^bitDepth − 1. Default 16. */
  bitDepth?: number;
  /** Bias offset added to every pixel, counts. Default 0. */
  offset?: number;
  /** Seed for the noise generator. Default 0. */
  seed?: number;
}

/** Pixel pitch along the slit, m. */
export function pixelHeightOf(camera: Camera): number {
  return camera.pixelHeight ?? camera.pixelWidth;
}

/** Expected photoelectrons in each pixel, before noise. */
export function expectedElectrons(frame: Frame, settings: ExposureSettings): Float64Array {
  const scale = settings.photonsPerUnit * settings.exposure * (settings.quantumEfficiency ?? 1);
  const out = new Float64Array(frame.pixels.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, frame.pixels[i]) * scale;
  return out;
}

/**
 * Exposes a frame of light: expected photoelectrons, Poisson shot noise,
 * Gaussian read noise, conversion to counts by the gain, rounding, and
 * clipping to [0, 2^bitDepth − 1]. The same seed gives the same frame.
 */
export function expose(frame: Frame, settings: ExposureSettings): Frame {
  const readNoise = settings.readNoise ?? 0;
  const gain = settings.gain ?? 1;
  const offset = settings.offset ?? 0;
  const saturation = 2 ** (settings.bitDepth ?? 16) - 1;
  const rng = createRandom(settings.seed ?? 0);
  const mean = expectedElectrons(frame, settings);
  const pixels = new Float32Array(mean.length);
  for (let i = 0; i < mean.length; i++) {
    let electrons = rng.poisson(mean[i]);
    if (readNoise > 0) electrons += readNoise * rng.normal();
    const counts = Math.round(electrons / gain + offset);
    pixels[i] = Math.min(saturation, Math.max(0, counts));
  }
  return { ...frame, pixels };
}

/** Smallest and largest pixel value, for an image view's colour scale. */
export function frameRange(frame: Frame): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of frame.pixels) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return frame.pixels.length ? { min, max } : { min: 0, max: 0 };
}
