"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import { parseFlexibleDecimal } from "@/components/calculators/parse-flexible-decimal";

type LaserState = {
  power: string;
  repetition: string;
  w0: string;
  wavelength: string;
};

type LaserFieldProps = {
  field: string;
  property: keyof LaserState;
  unit: string;
  value: string;
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
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            setLaser((previous) => ({
              ...previous,
              [property]: event.target.value,
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
    power: "1",
    repetition: "1000",
    w0: "1.1",
    wavelength: "980",
  });
  const power = parseFlexibleDecimal(laser.power);
  const repetition = parseFlexibleDecimal(laser.repetition);
  const w0 = parseFlexibleDecimal(laser.w0);
  const wavelength = parseFlexibleDecimal(laser.wavelength);

  const pulseEnergy =
    power !== null && power > 0 && repetition !== null && repetition > 0
      ? power / repetition
      : Number.NaN;
  const energyDensity =
    Number.isFinite(pulseEnergy) && w0 !== null && w0 > 0
      ? pulseEnergy / (Math.PI * w0 ** 2)
      : Number.NaN;

  return (
    <section className="pageSection">
      <h1>Laser Induced Damage Threshold (LIDT)</h1>
      <p className="lead">
        Estimate per-pulse energy and fluence (energy density) from a pulsed
        laser&apos;s average-power setup, so you can compare against an
        optic&apos;s LIDT rating.
      </p>

      <div className="calculatorGrid calculatorGrid--single">
        <div className="inputCard">
          <h2>Pulsed Lasers</h2>
          <p>
            Enter your beam parameters below. Both decimal commas and decimal
            periods are accepted.
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
                ? "Enter a positive average power and repetition rate to compute pulse energy."
                : `Pulse energy: ${pulseEnergy.toExponential(6)} J`}
            </p>
            <p className="resultCard">
              {Number.isNaN(energyDensity)
                ? "Enter a positive beam waist to compute fluence."
                : `Fluence (energy density): ${energyDensity.toExponential(6)} J/cm^2`}
            </p>
            {Number.isFinite(energyDensity) ? (
              <p className="infoPanel">
                This calculator estimates fluence from your beam parameters
                only &mdash; it does not know your optic&apos;s actual damage
                threshold. Compare the fluence above against the
                manufacturer&apos;s LIDT rating
                {wavelength !== null && wavelength > 0
                  ? ` at ${wavelength} nm`
                  : ""}
                : damage thresholds are wavelength- and pulse-duration-dependent,
                so a rating quoted at a different wavelength or pulse length
                is not directly comparable.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
