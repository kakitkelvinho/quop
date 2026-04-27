"use client";
import React, { useState } from "react";

type Laser = {
  power: number;
  repetition: number;
  w0: number;
  wvlen: number;
};

export default function LIDT() {
  //const [lidt, setLidt] = useState(5); // default: 5 J/cm^2
  const [laser, setLaser] = useState<Laser>({
    power: 1.0, // Watts, average power
    repetition: 1000, // Hz
    w0: 1.1, //cm, 1/e^2 waist
    wvlen: 980, //nm, wavelength
  });

  const energy = laser.power / laser.repetition;
  const density = energy / (Math.PI * (laser.w0 * 1e-2) ** 2);

  return (
    <>
      <h1>Laser Induced Damage Threshold (LIDT)</h1>

      <h2>Pulsed Lasers</h2>

      <p>
        Input the specs for your laser (if you are in Europe please use comma
        for decimals)
      </p>
      <p>
        <label>
          Average power:{" "}
          <input
            inputMode="decimal"
            value={laser.power}
            type="number"
            step="any"
            min="0"
            onChange={(e) => {
              setLaser((prev) => ({
                ...prev,
                power: parseFloat(e.target.value),
              }));
            }}
          />
          W
        </label>
      </p>

      <p>
        <label>
          Repetition Rate:
          <input
            inputMode="decimal"
            value={laser.repetition}
            type="number"
            step="any"
            min="0"
            onChange={(e) => {
              setLaser((prev) => ({
                ...prev,
                repetition: parseFloat(e.target.value),
              }));
            }}
          />
          Hz
        </label>
      </p>

      <p>
        <label>
          Beam Waist:
          <input
            inputMode="decimal"
            value={laser.w0}
            type="number"
            step="any"
            min="1e-10"
            onChange={(e) => {
              setLaser((prev) => ({
                ...prev,
                w0: parseFloat(e.target.value),
              }));
            }}
          />
          cm
        </label>
      </p>

      <p>
        <label>
          Wavelength:
          <input
            inputMode="decimal"
            value={laser.w0}
            type="number"
            step="any"
            min="0"
            onChange={(e) => {
              setLaser((prev) => ({
                ...prev,
                wavelength: parseFloat(e.target.value),
              }));
            }}
          />
          nm
        </label>
      </p>

      <p>Energy: {energy} J/pulse</p>
      <p>Energy density: {density} J/cm^2</p>
    </>
  );
}
