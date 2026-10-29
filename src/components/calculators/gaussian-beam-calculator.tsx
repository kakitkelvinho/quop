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

const LENGTH_OPTIONS = Object.keys(DISTANCE_UNITS).map((unit) => ({ value: unit, label: unitLabel(unit) }));

/** `children`: the working under the fields, typeset on the server. */
export function GaussianBeamCalculator({ children }: { children?: ReactNode }) {
  const [wavelength, setWavelength] = useState("1064");
  const [mSquaredText, setMSquaredText] = useState("1");
  const mSquaredId = useId();
  const [pair, setPair] = useState<LinkedPair>(() => editField(0, "100"));
  const [waistUnit, setWaistUnit] = useState<DistanceUnit>("um");
  const [rangeUnit, setRangeUnit] = useState<DistanceUnit>("mm");

  const nanometres = readNumber(wavelength);
  const typedLambda = nanometres !== null && nanometres > 0 ? nanometres * 1e-9 : null;
  // M² is at least 1: no beam spreads slower than an ideal Gaussian
  const mSquared = readNumber(mSquaredText);
  const mSquaredValid = mSquared !== null && mSquared >= 1;
  const lambda = mSquaredValid ? typedLambda : null;
  const waist = waistQuantity(waistUnit);
  const range = rayleighRangeQuantity(rangeUnit, lambda, mSquared ?? 1);

  // The waist in metres, from whichever field was typed in last.
  const waistMetres = [waist, range][pair.source].read(pair.text);
  const spread = lambda !== null && mSquared !== null ? mSquared * lambda : null;
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
          </summary>
          <div className="field">
            <label htmlFor={mSquaredId}>Beam quality M²</label>
            <div className="field__control">
              <input
                id={mSquaredId}
                aria-describedby={`${mSquaredId}-note`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={mSquaredText}
                onChange={(event) => setMSquaredText(event.target.value)}
              />
            </div>
            {mSquaredValid || mSquaredText.trim() === "" ? (
              <DecimalNote reading={readFlexibleDecimal(mSquaredText)} />
            ) : (
              <p className="advancedSettings__note">M² is at least 1; 1 is an ideal Gaussian.</p>
            )}
            <p className="advancedSettings__note" id={`${mSquaredId}-note`}>
              1 for an ideal Gaussian (TEM₀₀). A real beam with M² above 1 spreads M² times faster and has an M²
              times shorter Rayleigh range for the same waist.
            </p>
          </div>
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
                  setPair(changeUnit(pair, 1, range, rayleighRangeQuantity(next, lambda, mSquared ?? 1)));
                  setRangeUnit(next);
                },
              },
            },
          ]}
        />

        <p className="readoutAside">
          <span className="readoutAside__item">
            Divergence (half-angle) <span className="readout__formula">M²λ/(πw₀)</span>{" "}
            <span className="readoutAside__value">
              {divergence === null ? "—" : `${formatSignificant(divergence * 1e3, 4)} mrad`}
            </span>
          </span>
          <span aria-hidden="true"> · </span>
          <span className="readoutAside__item">
            Depth of focus{" "}
            <span className="readoutAside__value">
              {rayleighMetres === null
                ? "—"
                : `${formatSignificant((2 * rayleighMetres) / DISTANCE_UNITS[rangeUnit], 4)} ${unitLabel(rangeUnit)}`}
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
