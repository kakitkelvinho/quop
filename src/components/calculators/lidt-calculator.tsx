"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import { DecimalNote } from "@/components/calculators/decimal-note";
import { formatPrefixed, formatSignificant } from "@/components/calculators/format-quantity";
import { parseFlexibleDecimal, readFlexibleDecimal } from "@/components/calculators/parse-flexible-decimal";
import { Readout } from "@/components/calculators/readout";
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
  const energy = formatPrefixed(pulseEnergy, "J");

  return (
    <section className="pageSection">
      <ToolIntro href="/calculators/lidt-calculator" aside="Laser-induced damage threshold" />

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

          <div className="readoutGroup">
            <Readout
              primary
              label={
                <>
                  Fluence <span className="readout__formula">E/(πw²)</span>
                </>
              }
              value={Number.isFinite(fluence) ? formatSignificant(fluence, 3) : null}
              unit="J/cm²"
              empty="Enter a positive power, repetition rate and beam radius."
            />
            <Readout
              label="Pulse energy"
              value={Number.isFinite(pulseEnergy) ? energy.value : null}
              unit={energy.unit}
              empty="Needs a positive power and repetition rate."
            />
            <Readout
              label={
                <>
                  Peak fluence <span className="readout__formula">2E/(πw²)</span>
                </>
              }
              value={Number.isFinite(peakFluence) ? formatSignificant(peakFluence, 3) : null}
              unit="J/cm²"
              empty="Needs a positive beam radius."
            />
          </div>
          {Number.isFinite(fluence) ? (
            <p className="readoutNote">
              Fluence here is E/(πw²), with w the 1/e² radius. Vendors such as
              Thorlabs quote LIDT this way, so compare the first number against
              the rating. The centre of a Gaussian beam sees twice that, the
              peak fluence. This calculator doesn&apos;t know your optic&apos;s
              damage threshold, and the fluence doesn&apos;t depend on
              wavelength or pulse length. Damage thresholds do, so only compare
              against a rating quoted at your wavelength and a similar pulse
              length.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
