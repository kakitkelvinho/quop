"use client";

import { useState, type ReactNode } from "react";

import { DecimalNote } from "@/components/calculators/decimal-note";
import { formatSignificant } from "@/components/calculators/format-quantity";
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
  const [pair, setPair] = useState<LinkedPair>(() => editField(0, "100"));
  const [waistUnit, setWaistUnit] = useState<DistanceUnit>("um");
  const [rangeUnit, setRangeUnit] = useState<DistanceUnit>("mm");

  const nanometres = readNumber(wavelength);
  const lambda = nanometres !== null && nanometres > 0 ? nanometres * 1e-9 : null;
  const waist = waistQuantity(waistUnit);
  const range = rayleighRangeQuantity(rangeUnit, lambda);

  // The waist in metres, from whichever field was typed in last.
  const waistMetres = [waist, range][pair.source].read(pair.text);
  const divergence = waistMetres !== null && lambda !== null ? lambda / (Math.PI * waistMetres) : null;
  const rayleighMetres = waistMetres !== null && lambda !== null ? (Math.PI * waistMetres ** 2) / lambda : null;

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
                  setPair(changeUnit(pair, 1, range, rayleighRangeQuantity(next, lambda)));
                  setRangeUnit(next);
                },
              },
            },
          ]}
        />

        <p className="readoutAside">
          <span className="readoutAside__item">
            Divergence (half-angle) <span className="readout__formula">λ/(πw₀)</span>{" "}
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

      {children}
    </section>
  );
}
