"use client";
import { useState, type Dispatch, type SetStateAction } from "react";

export default function EnergyWavelengthCalculator() {
  const electronVolt = 1.602176634e-19; // J/eV
  const c = 299792458;
  const h = 6.62607015e-34;
  const [energy, setEnergy] = useState(1.2);
  const [wvlen, setWvlen] = useState(550);

  const ineV = (h * c) / (wvlen * 1e-9 * electronVolt);
  const inNm = (h * c) / (energy * electronVolt * 1e-9);

  const handleChange = (
    value: string,
    setFunc: Dispatch<SetStateAction<number>>,
  ) => {
    // const val = isNaN(parseFloat(value)) ? 0 : parseFloat(value);
    setFunc(parseFloat(value));
  };

  return (
    <>
      <h1>Energy Wavelength Calculator</h1>
      <p>Convert between photon energy in electron volts and wavelength.</p>
      <p>
        Input energy in electron volts:
        <label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={energy}
            onChange={(e) => handleChange(e.target.value, setEnergy)}
          />
        </label>
        eV
      </p>
      <p>From eV to nm: {isNaN(inNm) ? "Invalid!" : inNm} nm</p>
      <p>
        Input wavelength in nm:
        <label>
          <input
            type="number"
            inputMode="decimal"
            value={wvlen}
            step="1"
            min="0"
            onChange={(e) => handleChange(e.target.value, setWvlen)}
          />
        </label>
      </p>
      <p>From nm to eV: {isNaN(ineV) ? "Invalid!" : ineV} eV</p>
    </>
  );
}
