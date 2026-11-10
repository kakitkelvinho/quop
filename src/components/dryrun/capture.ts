// One capture of the Dry Run: a pulsed pump on the polariton ladder, the
// leakage collected by the objective, the slit at the Fourier plane, the
// spectrometer and the camera. Prototype for #341; the physics lives in
// ../simulator, unchanged. SI units inside; the parameters below say theirs.
//
// The chain, per pump pulse:
// 1. simulateLadder (ladder.ts) gives the photons leaking from each energy
//    bin over the whole pulse.
// 2. Bin 0 is one state at k = 0, the condensate; it leaks into a Gaussian
//    spot in k space as wide as the pumped spot allows (transform limit).
//    Bins 1…N are rings of equal area in the k plane; their photons are
//    spread evenly over their ring.
// 3. The slit sits at a Fourier plane, so a row of the slit is an emission
//    angle (x = scale · θ) and the slit's width picks a thin strip of k_y.
//    Each angle cell gets the photons in its strip, at the lower polariton's
//    energy for that k (lowerBranch) with its decay-limited linewidth ħγ(k).
// 4. disperse (spectrometer.ts) images that onto the camera; expose
//    (camera.ts) adds shot noise, read noise and the ADC.
//
// What the physics model does not have: polariton–polariton or
// polariton–reservoir interactions (so no blueshift), and any coherence of
// the condensate beyond its decay (so no linewidth narrowing). The curves read
// blueshift and linewidth off the capture as a lab would, and show what is
// there: nothing of either beyond what the shape of the leakage gives.

import { type Camera, type Frame, type ExposureSettings, expectedElectrons, expose } from "../simulator/camera.ts";
import { EV, HBAR, type Ladder, type LadderParams, TABLE_II, buildLadder, lowerBranch, simulateLadder } from "../simulator/ladder.ts";
import { HC, type Spectrometer, disperse } from "../simulator/spectrometer.ts";

/** ħc, J m. */
const HBAR_C = HBAR * 299792458;

/** The Dry Run's own parameters, as saved in its state file. Units in the names. */
export type DryRunParams = {
  /** Fewer energy bins on the ladder (the light physics model). */
  lightModel: boolean;
  /** Pump pulse FWHM, fs. */
  pulseFs: number;
  /** Pump wavelength, nm. */
  pumpNm: number;
  /** Fraction of pump photons that make a dark exciton, 0…1. */
  absorbed: number;
  /** Power series: lowest and highest fluence on the sample, µJ/cm², and how many captures. */
  seriesFrom: number;
  seriesTo: number;
  seriesPoints: number;
  /** Objective focal length, mm, and numerical aperture. */
  objectiveMm: number;
  objectiveNa: number;
  /** Spectrometer: grooves per mm, focal length mm, slit width µm. */
  grooves: number;
  spectrometerMm: number;
  slitUm: number;
  /** Camera region of interest, pixels, and pixel pitch, µm. */
  columns: number;
  rows: number;
  pixelUm: number;
  /** Pulse repetition rate, Hz; exposure, s; collection and transmission to the camera, 0…1. */
  repRateHz: number;
  exposureS: number;
  throughput: number;
  quantumEfficiency: number;
  readNoise: number;
  /** Attenuate each capture (as an ND filter would) so it never saturates. */
  autoAttenuate: boolean;
};

export const LIGHT_MODEL_BINS = 30;

export const DEFAULT_PARAMS: DryRunParams = {
  lightModel: false,
  pulseFs: 150,
  pumpNm: 400,
  absorbed: 1,
  seriesFrom: 0.02,
  seriesTo: 2,
  seriesPoints: 13,
  objectiveMm: 20,
  objectiveNa: 0.3,
  grooves: 1800,
  spectrometerMm: 750,
  slitUm: 50,
  columns: 256,
  rows: 256,
  pixelUm: 26,
  repRateHz: 1000,
  exposureS: 10,
  throughput: 0.05,
  quantumEfficiency: 0.9,
  readNoise: 5,
  autoAttenuate: true,
};

/** The ladder the parameters ask for: Table II, with fewer bins in the light model. */
export function ladderParams(params: DryRunParams): LadderParams {
  return { ...TABLE_II, bins: params.lightModel ? LIGHT_MODEL_BINS : TABLE_II.bins };
}

/** Pump photons absorbed per pulse (dark excitons made) at a fluence in µJ/cm². */
export function absorbedPerPulse(params: DryRunParams, fluence: number, area = TABLE_II.area): number {
  const energy = fluence * 1e-6 * (area * 1e4); // J on the pumped area
  return (energy * params.absorbed) / (HC / (params.pumpNm * 1e-9));
}

/** Fluences of the power series, µJ/cm², evenly spaced in log. */
export function seriesFluences(params: DryRunParams): number[] {
  const n = Math.max(1, Math.round(params.seriesPoints));
  if (n === 1) return [params.seriesFrom];
  const a = Math.log(params.seriesFrom);
  const b = Math.log(params.seriesTo);
  return Array.from({ length: n }, (_, i) => Math.exp(a + ((b - a) * i) / (n - 1)));
}

export function spectrometerOf(params: DryRunParams, ladder: Ladder): Spectrometer {
  // Centre the camera a little above the bottom of the branch, so the whole ladder fits.
  const m = ladder.energy.length;
  const e0 = ladder.energy[0];
  const eTop = ladder.energy[m - 1];
  const centre = e0 + 0.4 * (eTop - e0);
  return {
    grooveDensity: params.grooves * 1e3,
    focalLength: params.spectrometerMm * 1e-3,
    centreWavelength: HC / centre,
    slitWidth: params.slitUm * 1e-6,
  };
}

export function cameraOf(params: DryRunParams): Camera {
  return { columns: params.columns, rows: params.rows, pixelWidth: params.pixelUm * 1e-6, pixelHeight: params.pixelUm * 1e-6 };
}

/** Lorentzian of FWHM w: the fraction of its area between a and b (offsets from its centre). */
function lorentzArea(a: number, b: number, w: number): number {
  return (Math.atan((2 * b) / w) - Math.atan((2 * a) / w)) / Math.PI;
}

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26, |error| < 1.5e-7: plenty for a slit fraction.
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

export type CaptureResult = {
  fluence: number;
  /** Dark excitons made by the pulse. */
  absorbed: number;
  /** Photons leaking out of the cavity over the pulse, all angles: the physics model's output. */
  leakage: number;
  /** Of which from the k = 0 bin (the condensate). */
  condensateLeakage: number;
  /** Photons per pulse that reach the camera inside the region of interest. */
  onCamera: number;
  /** The capture, in counts, after noise. */
  capture: Frame;
  /** Attenuation applied (1 = none). */
  attenuation: number;
  /** Pixels at full scale in the capture. */
  saturated: number;
  /** Read off the noise-free capture near θ = 0: peak energy above E_LP(0), and FWHM, J. */
  peakShift: number;
  linewidth: number;
  /** Time spent, ms: the ladder, and the optics and camera. */
  ladderMs: number;
  opticsMs: number;
};

export type CaptureSetup = {
  /** Fourier scale at the slit, m per rad (sign ignored). */
  fourierScale: number;
};

/**
 * Light per pulse at the slit: rows are slit positions (one per camera row),
 * columns are energies. Photons in each cell.
 */
function slitLight(ladder: Ladder, emitted: Float64Array, params: DryRunParams, optics: CaptureSetup, spec: Spectrometer, camera: Camera) {
  const p = ladder.params;
  const scale = Math.abs(optics.fourierScale);
  const rows = camera.rows;
  const pitch = camera.pixelHeight ?? camera.pixelWidth;
  const thetaNa = Math.asin(Math.min(1, params.objectiveNa));
  const positions = new Float64Array(rows);
  for (let i = 0; i < rows; i++) positions[i] = (i + 0.5 - rows / 2) * pitch;

  // Energy cells: twice the camera's columns, over the energies the camera spans.
  const nE = 2 * camera.columns;
  const halfSpan = (camera.columns * camera.pixelWidth) / 2;
  const lamC = spec.centreWavelength;
  // λ span on the camera ≈ halfSpan · d cos β / f; take a generous margin.
  const d = 1 / spec.grooveDensity;
  const dLam = (halfSpan * d) / spec.focalLength;
  const eLo = HC / (lamC + 1.3 * dLam);
  const eHi = HC / (lamC - 1.3 * dLam);
  const energies = new Float64Array(nE);
  const edges = new Float64Array(nE + 1);
  for (let j = 0; j <= nE; j++) edges[j] = eLo + ((eHi - eLo) * j) / nE;
  for (let j = 0; j < nE; j++) energies[j] = 0.5 * (edges[j] + edges[j + 1]);

  const intensity = new Float64Array(rows * nE);
  const m = ladder.energy.length;
  const N = m - 1;
  const e0 = ladder.energy[0];
  const k0 = e0 / HBAR_C; // photon wave vector at the bottom of the branch
  // The slit's width as a strip of k_y.
  const dky = k0 * ((params.slitUm * 1e-6) / scale);
  // Thermal bins: photons per unit k area on each ring.
  const ringArea = N > 0 ? (Math.PI * p.kMax * p.kMax) / N : 1;
  const ringEdge = (j: number) => p.kMax * Math.sqrt(Math.max(0, j) / Math.max(N, 1));
  const density = (k: number) => {
    if (N === 0) return 0;
    const j = Math.min(N, Math.max(1, Math.round((k / p.kMax) ** 2 * N)));
    if (k > ringEdge(N + 0.5)) return 0;
    return emitted[j] / ringArea;
  };
  // Condensate: a Gaussian spot in k, transform limited by the pumped spot.
  const spot = 2 * Math.sqrt(p.area / Math.PI);
  const dkc = (4 * Math.LN2) / spot; // FWHM in k
  const sig = dkc / (2 * Math.sqrt(2 * Math.LN2));
  const yFraction = erf(dky / 2 / (sig * Math.SQRT2));
  const gamma0 = HBAR * ladder.decay[0];

  for (let i = 0; i < rows; i++) {
    const thA = (positions[i] - pitch / 2) / scale;
    const thB = (positions[i] + pitch / 2) / scale;
    const th = positions[i] / scale;
    if (Math.abs(th) > thetaNa) continue;
    const kA = k0 * Math.sin(thA);
    const kB = k0 * Math.sin(thB);
    const kx = Math.abs(k0 * Math.sin(th));
    const row = i * nE;
    // thermal: σ(k) · Δk_x · Δk_y, at E_LP(k) with ħγ(k)
    const thermal = density(kx) * Math.abs(kB - kA) * dky;
    if (thermal > 0) {
      const branch = lowerBranch(p, kx);
      const w = HBAR * (p.cavityDecay * branch.photonFraction + p.excitonDecay * (1 - branch.photonFraction));
      for (let j = 0; j < nE; j++) intensity[row + j] += thermal * lorentzArea(edges[j] - branch.energy, edges[j + 1] - branch.energy, w);
    }
    // condensate
    const xFraction = 0.5 * (erf(kB / (sig * Math.SQRT2)) - erf(kA / (sig * Math.SQRT2)));
    const cond = emitted[0] * xFraction * yFraction;
    if (cond > 0) {
      for (let j = 0; j < nE; j++) intensity[row + j] += cond * lorentzArea(edges[j] - e0, edges[j + 1] - e0, gamma0);
    }
  }
  return { positions, energies, intensity, energyEdges: edges };
}

/** Peak and FWHM of a spectrum on a column axis of energies (J); linear interpolation at the half points. */
export function peakAndWidth(spectrum: ArrayLike<number>, energy: ArrayLike<number>): { peak: number; fwhm: number } {
  let best = 0;
  for (let j = 1; j < spectrum.length; j++) if (spectrum[j] > spectrum[best]) best = j;
  const half = spectrum[best] / 2;
  if (!(half > 0)) return { peak: Number.NaN, fwhm: Number.NaN };
  const cross = (from: number, step: number) => {
    for (let j = from; j + step >= 0 && j + step < spectrum.length; j += step) {
      const a = spectrum[j];
      const b = spectrum[j + step];
      if (b < half) return energy[j] + ((a - half) / (a - b)) * (energy[j + step] - energy[j]);
    }
    return Number.NaN;
  };
  return { peak: energy[best], fwhm: Math.abs(cross(best, 1) - cross(best, -1)) };
}

/** Camera column energies, J, from its wavelengths. */
export function columnEnergies(frame: Frame): Float64Array {
  return Float64Array.from(frame.wavelengths, (lam) => HC / lam);
}

/** Emission angle of each camera row, rad. */
export function rowAngles(frame: Frame, optics: CaptureSetup): Float64Array {
  return Float64Array.from(frame.positions, (x) => x / Math.abs(optics.fourierScale));
}

/** One capture at one fluence (µJ/cm²). */
export function takeCapture(ladder: Ladder, params: DryRunParams, optics: CaptureSetup, fluence: number, seed = 1): CaptureResult {
  const t0 = performance.now();
  const absorbed = absorbedPerPulse(params, fluence, ladder.params.area);
  const run = simulateLadder(ladder, { kind: "pulse", energy: absorbed, fwhm: params.pulseFs * 1e-15 });
  const t1 = performance.now();

  const spec = spectrometerOf(params, ladder);
  const camera = cameraOf(params);
  const light = slitLight(ladder, run.emitted, params, optics, spec, camera);
  const frame = disperse(light, spec, camera);

  let onCamera = 0;
  for (const v of frame.pixels) onCamera += v;
  const base: ExposureSettings = {
    photonsPerUnit: params.repRateHz * params.throughput,
    exposure: params.exposureS,
    quantumEfficiency: params.quantumEfficiency,
    readNoise: params.readNoise,
    gain: 1,
    bitDepth: 16,
    offset: 0,
    seed,
  };
  const full = 2 ** 16 - 1;
  let attenuation = 1;
  if (params.autoAttenuate) {
    const mean = expectedElectrons(frame, base);
    let peak = 0;
    for (const v of mean) if (v > peak) peak = v;
    const target = 0.6 * full;
    if (peak > target) attenuation = target / peak;
  }
  const capture = expose(frame, { ...base, photonsPerUnit: base.photonsPerUnit * attenuation });
  let saturated = 0;
  for (const v of capture.pixels) if (v >= full) saturated += 1;

  // Peak and width near θ = 0: the rows within ±0.5° of normal, before noise.
  const energies = columnEnergies(frame);
  const angles = rowAngles(frame, optics);
  const spectrum = new Float64Array(frame.width);
  for (let i = 0; i < frame.height; i++) {
    if (Math.abs(angles[i]) > (0.5 * Math.PI) / 180) continue;
    for (let j = 0; j < frame.width; j++) spectrum[j] += frame.pixels[i * frame.width + j];
  }
  // Columns run along wavelength, so energy falls with column; sort for the width.
  const order = Array.from(energies.keys()).sort((a, b) => energies[a] - energies[b]);
  const { peak, fwhm } = peakAndWidth(
    order.map((j) => spectrum[j]),
    order.map((j) => energies[j]),
  );
  const t2 = performance.now();

  let leakage = 0;
  for (const v of run.emitted) leakage += v;
  return {
    fluence,
    absorbed,
    leakage,
    condensateLeakage: run.emitted[0],
    onCamera,
    capture,
    attenuation,
    saturated,
    peakShift: peak - ladder.energy[0],
    linewidth: fwhm,
    ladderMs: t1 - t0,
    opticsMs: t2 - t1,
  };
}

export { EV, buildLadder };
