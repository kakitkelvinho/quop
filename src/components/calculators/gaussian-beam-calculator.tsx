"use client";

import { useId, useState, type ReactNode } from "react";

import { DecimalNote } from "@/components/calculators/decimal-note";
import { formatSignificant } from "@/components/calculators/format-quantity";
import { GaussianBeamProfile } from "@/components/calculators/gaussian-beam-profile";
import { LinkedFields } from "@/components/calculators/linked-fields";
import {
  changeUnit,
  DISTANCE_UNITS,
  editField,
  rayleighRangeQuantity,
  readNumber,
  unitLabel,
  waistQuantity,
  type DistanceUnit,
  type LinkedPair,
} from "@/components/calculators/linked-pair";
import { readFlexibleDecimal } from "@/components/calculators/parse-flexible-decimal";
import { ToolIntro } from "@/components/tool-intro";

/**
 * A setting under Advanced: a number with a note on what it means, and a
 * warning in its place when the number is out of range.
 */
function AdvancedField({
  label,
  value,
  onChange,
  valid,
  invalidNote,
  note,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  valid: boolean;
  invalidNote: string;
  note: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <input
          id={id}
          aria-describedby={`${id}-note`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {valid || value.trim() === "" ? (
        <DecimalNote reading={readFlexibleDecimal(value)} />
      ) : (
        <p className="advancedSettings__note">{invalidNote}</p>
      )}
      <p className="advancedSettings__note" id={`${id}-note`}>
        {note}
      </p>
    </div>
  );
}

const LENGTH_OPTIONS = Object.keys(DISTANCE_UNITS).map((unit) => ({ value: unit, label: unitLabel(unit) }));

/** `children`: the working under the fields, typeset on the server. */
export function GaussianBeamCalculator({ children }: { children?: ReactNode }) {
  const [wavelength, setWavelength] = useState("1064");
  const [mSquaredText, setMSquaredText] = useState("1");
  const [indexText, setIndexText] = useState("1");
  const [pair, setPair] = useState<LinkedPair>(() => editField(0, "100"));
  const [waistUnit, setWaistUnit] = useState<DistanceUnit>("um");
  const [rangeUnit, setRangeUnit] = useState<DistanceUnit>("mm");

  const nanometres = readNumber(wavelength);
  const typedLambda = nanometres !== null && nanometres > 0 ? nanometres * 1e-9 : null;
  // M² is at least 1: no beam spreads slower than an ideal Gaussian
  const mSquared = readNumber(mSquaredText);
  const mSquaredValid = mSquared !== null && mSquared >= 1;
  const index = readNumber(indexText);
  const indexValid = index !== null && index > 0;
  const lambda = mSquaredValid && indexValid ? typedLambda : null;
  const waist = waistQuantity(waistUnit);
  const rangeIn = (unit: DistanceUnit) => rayleighRangeQuantity(unit, lambda, mSquared ?? 1, index ?? 1);
  const range = rangeIn(rangeUnit);

  // The waist in metres, from whichever field was typed in last.
  const waistMetres = [waist, range][pair.source].read(pair.text);
  // M²λ/n: how fast the beam spreads, as the wavelength an ideal Gaussian in vacuum would need
  const spread = lambda !== null && mSquared !== null && index !== null ? (mSquared * lambda) / index : null;
  const divergence = waistMetres !== null && spread !== null ? spread / (Math.PI * waistMetres) : null;
  const rayleighMetres = waistMetres !== null && spread !== null ? (Math.PI * waistMetres ** 2) / spread : null;

  return (
    <section className="pageSection">
      <ToolIntro href="/calculators/gaussian-beam" />

      <div className="calculatorSheet">
        <label className="field">
          <span>Wavelength</span>
          <div className="field__control">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={wavelength}
              onChange={(event) => setWavelength(event.target.value)}
            />
            <span>nm</span>
          </div>
          <DecimalNote reading={readFlexibleDecimal(wavelength)} />
        </label>

        <details className="advancedSettings">
          <summary>
            Advanced
            {mSquaredValid && mSquared !== 1 ? <span className="advancedSettings__state"> · M² = {mSquaredText.trim()}</span> : null}
            {indexValid && index !== 1 ? <span className="advancedSettings__state"> · n = {indexText.trim()}</span> : null}
          </summary>
          <AdvancedField
            label="Beam quality M²"
            value={mSquaredText}
            onChange={setMSquaredText}
            valid={mSquaredValid}
            invalidNote="M² is at least 1."
            note="1 for an ideal Gaussian (TEM₀₀); real beams are above 1."
          />
          <AdvancedField
            label="Refractive index n"
            value={indexText}
            onChange={setIndexText}
            valid={indexValid}
            invalidNote="n must be above 0."
            note="Of the medium the focus is in: 1 for air, about 1.5 for glass, 1.66 for BBO."
          />
        </details>

        <LinkedFields
          pair={pair}
          onEdit={(side, text) => setPair(editField(side, text))}
          fields={[
            {
              label: "Waist radius w₀ (1/e²)",
              quantity: waist,
              unit: unitLabel(waistUnit),
              units: {
                value: waistUnit,
                options: LENGTH_OPTIONS,
                onChange: (value) => {
                  const next = value as DistanceUnit;
                  setPair(changeUnit(pair, 0, waist, waistQuantity(next)));
                  setWaistUnit(next);
                },
              },
            },
            {
              label: "Rayleigh range",
              quantity: range,
              unit: unitLabel(rangeUnit),
              units: {
                value: rangeUnit,
                options: LENGTH_OPTIONS,
                onChange: (value) => {
                  const next = value as DistanceUnit;
                  setPair(changeUnit(pair, 1, range, rangeIn(next)));
                  setRangeUnit(next);
                },
              },
            },
          ]}
        />

        <p className="readoutAside">
          <span className="readoutAside__item">
            Divergence (half-angle) <span className="readout__formula">M²λ/(πnw₀)</span>{" "}
            <span className="readoutAside__value">
              {divergence === null ? "—" : `${formatSignificant(divergence * 1e3, 4)} mrad`}
            </span>
          </span>
        </p>
      </div>

      <GaussianBeamProfile
        beam={waistMetres !== null && rayleighMetres !== null ? { waist: waistMetres, rayleigh: rayleighMetres } : null}
        waistUnit={waistUnit}
        rangeUnit={rangeUnit}
      />

      {children}
    </section>
  );
}
