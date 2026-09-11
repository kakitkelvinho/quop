"use client";

import { useState } from "react";

import { parseFlexibleDecimal } from "@/components/calculators/parse-flexible-decimal";

export function EnergyWavelengthCalculator() {
  const electronVolt = 1.602176634e-19;
  const c = 299792458;
  const h = 6.62607015e-34;

  const [energyInput, setEnergyInput] = useState("1.2");
  const [wavelengthInput, setWavelengthInput] = useState("550");
  const energy = parseFlexibleDecimal(energyInput);
  const wavelength = parseFlexibleDecimal(wavelengthInput);

  const energyFromWavelength =
    wavelength !== null && wavelength > 0
      ? (h * c) / (wavelength * 1e-9 * electronVolt)
      : Number.NaN;
  const wavelengthFromEnergy =
    energy !== null && energy > 0
      ? (h * c) / (energy * electronVolt * 1e-9)
      : Number.NaN;

  return (
    <section className="pageSection">
      <h1>Energy-Wavelength Calculator</h1>
      <p className="lead">
        Convert between photon energy in electron volts and wavelength in
        nanometers.
      </p>

      <div className="calculatorGrid">
        <div className="inputCard">
          <h2>From eV to nm</h2>
          <label className="field">
            <span>Energy</span>
            <div className="field__control">
              <input
                type="text"
                inputMode="decimal"
                value={energyInput}
                onChange={(event) => setEnergyInput(event.target.value)}
              />
              <span>eV</span>
            </div>
          </label>
          <p className="resultCard">
            {Number.isNaN(wavelengthFromEnergy)
              ? "Invalid input."
              : `${wavelengthFromEnergy.toFixed(4)} nm`}
          </p>
        </div>

        <div className="inputCard">
          <h2>From nm to eV</h2>
          <label className="field">
            <span>Wavelength</span>
            <div className="field__control">
              <input
                type="text"
                inputMode="decimal"
                value={wavelengthInput}
                onChange={(event) => setWavelengthInput(event.target.value)}
              />
              <span>nm</span>
            </div>
          </label>
          <p className="resultCard">
            {Number.isNaN(energyFromWavelength)
              ? "Invalid input."
              : `${energyFromWavelength.toFixed(6)} eV`}
          </p>
        </div>
      </div>
    </section>
  );
}
