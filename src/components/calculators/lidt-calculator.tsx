"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

type LaserState = {
  power: number;
  repetition: number;
  w0: number;
  wavelength: number;
};

type LaserFieldProps = {
  field: string;
  property: keyof LaserState;
  unit: string;
  value: number;
  setLaser: Dispatch<SetStateAction<LaserState>>;
};

function LaserField({
  field,
  property,
  unit,
  value,
  setLaser,
}: LaserFieldProps) {
  return (
    <label className="field">
      <span>{field}</span>
      <div className="field__control">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={value}
          onChange={(event) => {
            const nextValue = Number.parseFloat(event.target.value);

            setLaser((previous) => ({
              ...previous,
              [property]: nextValue,
            }));
          }}
        />
        <span>{unit}</span>
      </div>
    </label>
  );
}

export function LidtCalculator() {
  const [laser, setLaser] = useState<LaserState>({
    power: 1,
    repetition: 1000,
    w0: 1.1,
    wavelength: 980,
  });

  const pulseEnergy = laser.power / laser.repetition;
  const energyDensity = pulseEnergy / (Math.PI * laser.w0 ** 2);

  return (
    <section className="pageSection">
      <h1>Laser Induced Damage Threshold (LIDT)</h1>
      <p className="lead">
        Estimate per-pulse energy and energy density from a pulsed laser&apos;s
        average-power setup.
      </p>

      <div className="calculatorGrid calculatorGrid--single">
        <div className="inputCard">
          <h2>Pulsed Lasers</h2>
          <p>
            Enter your beam parameters below. Decimal commas are not supported
            in the browser input fields, so use periods for decimals.
          </p>

          <div className="fieldStack">
            <LaserField
              field="Average power"
              property="power"
              unit="W"
              value={laser.power}
              setLaser={setLaser}
            />
            <LaserField
              field="Repetition rate"
              property="repetition"
              unit="Hz"
              value={laser.repetition}
              setLaser={setLaser}
            />
            <LaserField
              field="Beam waist"
              property="w0"
              unit="cm"
              value={laser.w0}
              setLaser={setLaser}
            />
            <LaserField
              field="Wavelength"
              property="wavelength"
              unit="nm"
              value={laser.wavelength}
              setLaser={setLaser}
            />
          </div>

          <div className="resultStack">
            <p className="resultCard">
              {Number.isNaN(pulseEnergy)
                ? "Invalid pulse energy."
                : `Pulse energy: ${pulseEnergy.toExponential(6)} J`}
            </p>
            <p className="resultCard">
              {Number.isNaN(energyDensity)
                ? "Invalid energy density."
                : `Energy density: ${energyDensity.toExponential(6)} J/cm^2`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
