"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import { DecimalNote } from "@/components/calculators/decimal-note";
import { parseFlexibleDecimal, readFlexibleDecimal } from "@/components/calculators/parse-flexible-decimal";
import { ToolIntro } from "@/components/tool-intro";

type LaserState = {
  power: string;
  repetition: string;
  radius: string;
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
      <DecimalNote reading={readFlexibleDecimal(value)} />
    </label>
  );
}

export function LidtCalculator() {
  const [laser, setLaser] = useState<LaserState>({
    power: "1",
    repetition: "1000",
    radius: "0.1",
  });
  const power = parseFlexibleDecimal(laser.power);
  const repetition = parseFlexibleDecimal(laser.repetition);
  const radius = parseFlexibleDecimal(laser.radius);

  const pulseEnergy =
    power !== null && power > 0 && repetition !== null && repetition > 0
      ? power / repetition
      : Number.NaN;
  // E/(πw²) with w the 1/e² radius: the convention LIDT specs use.
  const fluence =
    Number.isFinite(pulseEnergy) && radius !== null && radius > 0
      ? pulseEnergy / (Math.PI * radius ** 2)
      : Number.NaN;
  const peakFluence = 2 * fluence;

  return (
    <section className="pageSection">
      <ToolIntro href="/calculators/lidt-calculator">
        Laser Induced Damage Threshold (LIDT)
      </ToolIntro>

      <div className="calculatorGrid calculatorGrid--single">
        <div className="inputCard">
          <h2>Pulsed Lasers</h2>
          <p>
            Enter your beam parameters below. Decimal commas and decimal
            points both work, and so do 1e6 and 1,000,000. Give the beam
            radius at 1/e² intensity, not the diameter.
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
              field="Beam radius (1/e²)"
              property="radius"
              unit="cm"
              value={laser.radius}
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
              {Number.isNaN(fluence)
                ? "Enter a positive beam radius to compute fluence."
                : `Fluence E/(πw²): ${fluence.toExponential(6)} J/cm²`}
            </p>
            {Number.isFinite(fluence) ? (
              <>
                <p className="resultCard">
                  {`Gaussian peak fluence 2E/(πw²): ${peakFluence.toExponential(6)} J/cm²`}
                </p>
                <p className="infoPanel">
                  Fluence here is E/(πw²), with w the 1/e² radius. Vendors
                  such as Thorlabs quote LIDT this way, so compare the first
                  number against the rating. The centre of a Gaussian beam
                  sees twice that, the peak fluence. This calculator
                  doesn&apos;t know your optic&apos;s damage threshold, and
                  the fluence doesn&apos;t depend on wavelength or pulse
                  length. Damage thresholds do, so only compare against a
                  rating quoted at your wavelength and a similar pulse
                  length.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
