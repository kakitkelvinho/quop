// What each calculator works out and from what: its equations, and every
// symbol in them, with the value used for a constant. Written as TeX and
// typeset on the server, so the page ships no maths code.

import { ELECTRON_VOLT, PLANCK, SPEED_OF_LIGHT } from "./linked-pair.ts";

export type FormulaSymbol = {
  /** The symbol as TeX. */
  symbol: string;
  meaning: string;
  /** A constant's value, as TeX; absent for a quantity the reader sets. */
  value?: string;
  /** The unit the calculator uses, as TeX; absent for a pure number. */
  unit?: string;
};

export type FormulaSheet = {
  equations: readonly string[];
  symbols: readonly FormulaSymbol[];
};

/** 6.62607015e-34 as TeX: 6.62607015 \times 10^{-34}. */
export function texScientific(value: number): string {
  const [mantissa, exponent] = value.toExponential().split("e");
  return `${mantissa} \\times 10^{${Number(exponent)}}`;
}

/** 299792458 as TeX, with thin spaces between groups of three. */
export function texGrouped(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "\\,");
}

const PLANCK_ROW: FormulaSymbol = {
  symbol: "h",
  meaning: "Planck constant (exact, SI)",
  value: texScientific(PLANCK),
  unit: "\\mathrm{J\\,s}",
};

const LIGHT_SPEED_ROW: FormulaSymbol = {
  symbol: "c",
  meaning: "Speed of light in vacuum (exact, SI)",
  value: texGrouped(SPEED_OF_LIGHT),
  unit: "\\mathrm{m/s}",
};

export const FORMULA_SHEETS: Record<string, FormulaSheet> = {
  "/calculators/energy-wavelength-calculator": {
    equations: [
      "E = \\frac{hc}{\\lambda}",
      "\\tilde{\\nu} = \\frac{1}{\\lambda}",
      "\\Delta\\tilde{\\nu} = \\frac{1}{\\lambda_0} - \\frac{1}{\\lambda_\\mathrm{s}}",
    ],
    symbols: [
      { symbol: "E", meaning: "Photon energy", unit: "\\mathrm{eV}" },
      { symbol: "\\lambda", meaning: "Wavelength in vacuum", unit: "\\mathrm{nm}" },
      { symbol: "\\tilde{\\nu}", meaning: "Wavenumber", unit: "\\mathrm{cm^{-1}}" },
      { symbol: "\\lambda_0", meaning: "Excitation (laser) wavelength: the wavelength above", unit: "\\mathrm{nm}" },
      { symbol: "\\lambda_\\mathrm{s}", meaning: "Raman-scattered wavelength", unit: "\\mathrm{nm}" },
      {
        symbol: "\\Delta\\tilde{\\nu}",
        meaning: "Raman shift: positive for Stokes, negative for anti-Stokes",
        unit: "\\mathrm{cm^{-1}}",
      },
      PLANCK_ROW,
      LIGHT_SPEED_ROW,
      {
        symbol: "e",
        meaning: "Elementary charge (exact, SI); 1 eV is e joules",
        value: texScientific(ELECTRON_VOLT),
        unit: "\\mathrm{C}",
      },
    ],
  },
  "/calculators/lidt-calculator": {
    equations: [
      "E_\\mathrm{p} = \\frac{P}{f}",
      "F = \\frac{E_\\mathrm{p}}{\\pi w^2}",
      "F_\\mathrm{peak} = \\frac{2E_\\mathrm{p}}{\\pi w^2}",
    ],
    symbols: [
      { symbol: "P", meaning: "Average power", unit: "\\mathrm{W}" },
      { symbol: "f", meaning: "Repetition rate", unit: "\\mathrm{Hz}" },
      { symbol: "w", meaning: "Beam radius, where the intensity falls to 1/e²", unit: "\\mathrm{cm}" },
      { symbol: "E_\\mathrm{p}", meaning: "Pulse energy", unit: "\\mathrm{J}" },
      { symbol: "F", meaning: "Fluence, as LIDT specs quote it", unit: "\\mathrm{J/cm^2}" },
      { symbol: "F_\\mathrm{peak}", meaning: "Peak fluence on the axis of a Gaussian beam", unit: "\\mathrm{J/cm^2}" },
    ],
  },
  "/calculators/pace": {
    equations: ["v = \\frac{60}{p}"],
    symbols: [
      { symbol: "p", meaning: "Pace; m:ss is read as m + ss/60 minutes", unit: "\\mathrm{min/km}" },
      { symbol: "v", meaning: "Speed", unit: "\\mathrm{km/h}" },
    ],
  },
  "/calculators/light-travel-calculator": {
    equations: ["d = ct"],
    symbols: [
      { symbol: "d", meaning: "Distance travelled", unit: "\\text{chosen above}" },
      { symbol: "t", meaning: "Time taken", unit: "\\text{chosen above}" },
      LIGHT_SPEED_ROW,
    ],
  },
  "/calculators/gaussian-beam": {
    equations: [
      "z_\\mathrm{R} = \\frac{\\pi w_0^2 n}{M^2\\lambda}",
      "\\theta = \\frac{M^2\\lambda}{\\pi n w_0}",
    ],
    symbols: [
      { symbol: "\\lambda", meaning: "Wavelength in vacuum", unit: "\\mathrm{nm}" },
      { symbol: "w_0", meaning: "Waist radius, where the intensity falls to 1/e²", unit: "\\text{chosen above}" },
      {
        symbol: "z_\\mathrm{R}",
        meaning: "Rayleigh range",
        unit: "\\text{chosen above}",
      },
      { symbol: "\\theta", meaning: "Far-field divergence, half-angle, in the medium", unit: "\\mathrm{mrad} \\text{ or } {}^\\circ" },
      {
        symbol: "M^2",
        meaning: "Beam quality factor (1 = ideal Gaussian)",
      },
      { symbol: "n", meaning: "Refractive index of the medium at the focus (1 = air)" },
    ],
  },
};
