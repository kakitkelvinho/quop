"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

function handleNumericChange(
  value: string,
  setter: Dispatch<SetStateAction<number>>,
) {
  setter(Number.parseFloat(value));
}

export function EnergyWavelengthCalculator() {
  const electronVolt = 1.602176634e-19;
  const c = 299792458;
  const h = 6.62607015e-34;

  const [energy, setEnergy] = useState(1.2);
  const [wavelength, setWavelength] = useState(550);

  const energyFromWavelength = (h * c) / (wavelength * 1e-9 * electronVolt);
  const wavelengthFromEnergy = (h * c) / (energy * electronVolt * 1e-9);

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
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={energy}
                onChange={(event) =>
                  handleNumericChange(event.target.value, setEnergy)
                }
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
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                value={wavelength}
                onChange={(event) =>
                  handleNumericChange(event.target.value, setWavelength)
                }
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
