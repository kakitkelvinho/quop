import { type Camera, type ExposureSettings, type Frame, expose, pixelHeightOf } from "./camera.ts";
import { type LadderParams, type LadderPowerPoint, HBAR, TABLE_II, buildLadder, ladderPowerSeries, ladderThreshold } from "./ladder.ts";
import { type Classification, type RayMatrix, type RelayElement, classify, multiply, pathLengthScale, relayFromPath } from "./ray-transfer.ts";
import { HC, type Spectrometer, columnWavelengths, positionOf, rowPositions, slitImageWidth, wavelengthAt } from "./spectrometer.ts";

const C = 299792458;

export interface Objective {
  /** Objective focal length, m. The sample is at its front focal plane by default. */
  focalLength: number;
  /** Numerical aperture in air, dimensionless. */
  numericalAperture: number;
  /** Sample displacement from the front focal plane, m. */
  sampleDefocus?: number;
}

export interface PowerSeriesConfig {
  model: LadderParams;
  /** Absorbed continuous-wave pump rates, particles/s. */
  pumpRates: readonly number[];
  objective: Objective;
  /** Lenses and free-space distances from the objective back focal plane to the slit, in beam order. */
  relay: readonly RelayElement[];
  spectrometer: Spectrometer;
  camera: Camera;
  /** Fraction of photons emitted into the modelled slit path, dimensionless. */
  collectionEfficiency: number;
  /** Camera exposure duration, s. */
  exposure: number;
  /** Quantum efficiency, photoelectrons per incident photon. */
  quantumEfficiency: number;
  /** Incoherent bin angular FWHM, rad; resolves the rings into a smooth branch. */
  thermalAngularWidth: number;
  /** Ground-state angular FWHM, rad. */
  condensateAngularWidth: number;
  /** Ground-state spectral FWHM, J; a phenomenological input. */
  condensateLinewidth: number;
  /** Ground-state blueshift per ground-state polariton, J/particle. */
  blueshiftPerPolariton: number;
  /** Ground-state blueshift per reservoir exciton, J/particle. */
  blueshiftPerReservoir: number;
  /** Optional seeded camera noise and ADC conversion. Omit for expected photoelectron counts. */
  noise?: Omit<ExposureSettings, "photonsPerUnit" | "exposure" | "quantumEfficiency">;
}

export interface RelayReport {
  matrix: RayMatrix;
  classification: Classification;
  /** Angle-to-position scale at the slit near normal emission, m/rad. */
  angleScale: number;
  /** Largest accepted |sin θ| in air. */
  numericalAperture: number;
}

export type PowerSeriesResult =
  | { status: "unsupported-relay"; relay: RelayReport }
  | { status: "ok"; relay: RelayReport; points: Array<{ pump: number; populations: LadderPowerPoint; frame: Frame }> };

/** The corrected objective maps x to the back focal plane with x = f sin θ. */
export function objectiveToBackFocalPlane(objective: Objective): RayMatrix {
  if (!(objective.focalLength > 0)) throw new RangeError("objective focal length must be positive");
  if (!(objective.numericalAperture > 0 && objective.numericalAperture <= 1)) throw new RangeError("objective NA must be in (0, 1]");
  const f = objective.focalLength;
  return multiply({ A: 0, B: f, C: -1 / f, D: 0 }, { A: 1, B: objective.sampleDefocus ?? 0, C: 0, D: 1 });
}

/** Reports the plane at the slit before any frame is computed. */
export function inspectRelay(config: Pick<PowerSeriesConfig, "objective" | "relay">): RelayReport {
  const afterObjective = relayFromPath(config.relay).matrix;
  const matrix = multiply(afterObjective, objectiveToBackFocalPlane(config.objective));
  const classification = classify(matrix, { lengthScale: pathLengthScale(config.relay) + config.objective.focalLength });
  return { matrix, classification, angleScale: matrix.B, numericalAperture: config.objective.numericalAperture };
}

type SparseRow = { index: number; weight: number }[];

function rowKernel(centre: number, fwhm: number, camera: Camera, magnification: number, pupilRadius: number): SparseRow {
  const pitch = pixelHeightOf(camera);
  const sigma = Math.abs(fwhm * magnification) / (2 * Math.sqrt(2 * Math.LN2));
  const cameraCentre = centre * magnification;
  const centreIndex = cameraCentre / pitch + camera.rows / 2 - 0.5;
  const radius = Math.max(1, Math.ceil(4 * sigma / pitch));
  const first = Math.max(0, Math.floor(centreIndex) - radius);
  const last = Math.min(camera.rows - 1, Math.ceil(centreIndex) + radius);
  const row: SparseRow = [];
  let total = 0;
  for (let i = first; i <= last; i++) {
    const d = (i - centreIndex) * pitch;
    const weight = sigma > 0 ? Math.exp(-0.5 * (d / sigma) ** 2) : i === Math.round(centreIndex) ? 1 : 0;
    if (weight > 1e-8) { row.push({ index: i, weight }); total += weight; }
  }
  for (const item of row) item.weight /= total;
  return row.filter(({ index }) => Math.abs(((index + 0.5 - camera.rows / 2) * pitch) / magnification) <= pupilRadius);
}

function spectrumKernel(energy: number, fwhm: number, spec: Spectrometer, camera: Camera): Float64Array {
  const out = new Float64Array(camera.columns);
  if (!(fwhm > 0)) throw new RangeError("spectral linewidth must be positive");
  const centre = positionOf(spec, HC / energy);
  if (!Number.isFinite(centre) || Math.abs(centre) >= camera.columns * camera.pixelWidth / 2) return out;
  const gamma = fwhm / 2;
  const slitImage = Math.abs(slitImageWidth(spec));
  const slitSamples = slitImage > 0 ? 5 : 1;
  let total = 0;
  for (let j = 0; j < camera.columns; j++) {
    const left = (j - camera.columns / 2) * camera.pixelWidth;
    const right = left + camera.pixelWidth;
    let weight = 0;
    for (let s = 0; s < slitSamples; s++) {
      const shift = slitImage * ((s + 0.5) / slitSamples - 0.5);
      const low = HC / wavelengthAt(spec, right - shift);
      const high = HC / wavelengthAt(spec, left - shift);
      weight += (Math.atan((high - energy) / gamma) - Math.atan((low - energy) / gamma)) / (Math.PI * slitSamples);
    }
    out[j] = Math.max(0, weight);
    total += out[j];
  }
  // The modelled spectral band is inside the camera; collectionEfficiency
  // accounts for fixed loss outside the instrument's accepted band.
  if (total > 0) for (let j = 0; j < out.length; j++) out[j] /= total;
  return out;
}

function addMode(pixels: Float32Array, rows: SparseRow, spectrum: Float64Array, amount: number, columns: number): void {
  for (const row of rows) {
    const scale = amount * row.weight;
    const base = row.index * columns;
    for (let j = 0; j < columns; j++) pixels[base + j] += scale * spectrum[j];
  }
}

/** Simulates the steady-state ladder, its angular spectra, ideal Fourier relay, and camera. */
export function simulatePowerSeries(config: PowerSeriesConfig): PowerSeriesResult {
  const relay = inspectRelay(config);
  if (relay.classification.kind !== "fourier") return { status: "unsupported-relay", relay };
  if (!(config.collectionEfficiency >= 0 && config.collectionEfficiency <= 1)) throw new RangeError("collection efficiency must be in [0, 1]");
  if (!(config.exposure > 0) || !(config.quantumEfficiency >= 0 && config.quantumEfficiency <= 1)) throw new RangeError("invalid camera exposure or quantum efficiency");
  const ladder = buildLadder(config.model);
  const states = ladderPowerSeries(ladder, config.pumpRates);
  const { camera, spectrometer: spec } = config;
  const columns = camera.columns;
  const wavelengths = columnWavelengths(spec, camera);
  const positions = rowPositions(spec, camera);
  const mag = spec.magnification ?? 1;
  const scale = config.collectionEfficiency * config.exposure * config.quantumEfficiency;
  const pupilRadius = Math.abs(relay.angleScale) * config.objective.numericalAperture;
  const thermal: Array<{ rows: SparseRow[]; spectrum: Float64Array } | null> = [];
  for (let j = 1; j < ladder.energy.length; j++) {
    const sinTheta = HBAR * C * ladder.k[j] / ladder.energy[j];
    if (sinTheta > config.objective.numericalAperture) { thermal.push(null); continue; }
    const x = relay.angleScale * sinTheta;
    const width = Math.abs(relay.angleScale * Math.cos(Math.asin(sinTheta)) * config.thermalAngularWidth);
    thermal.push({
      rows: [rowKernel(-x, width, camera, mag, pupilRadius), rowKernel(x, width, camera, mag, pupilRadius)],
      spectrum: spectrumKernel(ladder.energy[j], HBAR * ladder.decay[j], spec, camera),
    });
  }
  const groundRows = rowKernel(0, Math.abs(relay.angleScale * config.condensateAngularWidth), camera, mag, pupilRadius);
  const points = states.map((state, index) => {
    const pixels = new Float32Array(camera.rows * columns);
    for (let j = 1; j < ladder.energy.length; j++) {
      const mode = thermal[j - 1];
      if (!mode) continue;
      const amount = state.emission[j] * scale / 2;
      for (const rows of mode.rows) addMode(pixels, rows, mode.spectrum, amount, columns);
    }
    const shiftedEnergy = ladder.energy[0] + config.blueshiftPerPolariton * state.occupation[0] + config.blueshiftPerReservoir * state.reservoir;
    const groundSpectrum = spectrumKernel(shiftedEnergy, config.condensateLinewidth, spec, camera);
    addMode(pixels, groundRows, groundSpectrum, state.emission[0] * scale, columns);
    const expected = { width: columns, height: camera.rows, pixels, wavelengths, positions };
    const frame = config.noise ? expose(expected, { ...config.noise, photonsPerUnit: 1, exposure: 1, quantumEfficiency: 1, seed: (config.noise.seed ?? 0) + index }) : expected;
    return { pump: state.pump, populations: state, frame };
  });
  return { status: "ok", relay, points };
}

const exampleModel = { ...TABLE_II };
const exampleLadder = buildLadder(exampleModel);
const exampleEnergy = exampleLadder.energy[0];
const exampleThreshold = ladderThreshold(exampleLadder);

/** Table II model, a 4f relay after a 4 mm objective, and a 512 × 512 camera. */
export const EXAMPLE_POWER_SERIES: PowerSeriesConfig = {
  model: exampleModel,
  pumpRates: Array.from({ length: 30 }, (_, i) => exampleThreshold * (0.1 + i * 0.1)),
  objective: { focalLength: 4e-3, numericalAperture: 0.42 },
  relay: [
    { kind: "space", d: 0.15 }, { kind: "lens", f: 0.15 },
    { kind: "space", d: 0.45 }, { kind: "lens", f: 0.3 }, { kind: "space", d: 0.3 },
  ],
  spectrometer: { grooveDensity: 1.2e6, focalLength: 0.5, centreWavelength: HC / exampleEnergy, slitWidth: 20e-6 },
  camera: { columns: 512, rows: 512, pixelWidth: 26e-6 },
  collectionEfficiency: 1e-8,
  exposure: 1e-6,
  quantumEfficiency: 0.8,
  thermalAngularWidth: 0.003,
  condensateAngularWidth: 0.01,
  condensateLinewidth: 0.5e-3 * 1.602176634e-19,
  blueshiftPerPolariton: 0,
  blueshiftPerReservoir: 0,
};
