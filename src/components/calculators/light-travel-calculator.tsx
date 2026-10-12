"use client";

import { useMemo, useState } from "react";

import { DecimalNote } from "@/components/calculators/decimal-note";
import { formatSignificant } from "@/components/calculators/format-quantity";
import { parseFlexibleDecimal, readFlexibleDecimal } from "@/components/calculators/parse-flexible-decimal";
import { Readout } from "@/components/calculators/readout";
import { ToolIntro } from "@/components/tool-intro";

type TimeUnit = "fs" | "ps" | "ns" | "us" | "ms" | "s";
type DistanceUnit = "nm" | "um" | "mm" | "cm" | "m";

const SPEED_OF_LIGHT = 299_792_458;

const timeUnitToSeconds: Record<TimeUnit, number> = {
  fs: 1e-15,
  ps: 1e-12,
  ns: 1e-9,
  us: 1e-6,
  ms: 1e-3,
  s: 1,
};

const distanceUnitToMeters: Record<DistanceUnit, number> = {
  nm: 1e-9,
  um: 1e-6,
  mm: 1e-3,
  cm: 1e-2,
  m: 1,
};

/** The units as written for reading: "um" and "us" are typed for ease, shown as µm and µs. */
const unitLabel = (unit: string) => unit.replace(/^u/, "µ");

export function LightTravelCalculator() {
  const [timeInput, setTimeInput] = useState("30");
  const [timeInputUnit, setTimeInputUnit] = useState<TimeUnit>("fs");
  const [timeOutputUnit, setTimeOutputUnit] = useState<TimeUnit>("fs");
  const [distanceInput, setDistanceInput] = useState("1");
  const [distanceInputUnit, setDistanceInputUnit] = useState<DistanceUnit>("cm");
  const [distanceOutputUnit, setDistanceOutputUnit] = useState<DistanceUnit>("um");

  const parsedTime = parseFlexibleDecimal(timeInput);
  const parsedDistance = parseFlexibleDecimal(distanceInput);

  const distanceFromTime = useMemo(() => {
    if (parsedTime === null || parsedTime < 0) {
      return Number.NaN;
    }

    const seconds = parsedTime * timeUnitToSeconds[timeInputUnit];
    const meters = seconds * SPEED_OF_LIGHT;

    return meters / distanceUnitToMeters[distanceOutputUnit];
  }, [distanceOutputUnit, parsedTime, timeInputUnit]);

  const timeFromDistance = useMemo(() => {
    if (parsedDistance === null || parsedDistance < 0) {
      return Number.NaN;
    }

    const meters = parsedDistance * distanceUnitToMeters[distanceInputUnit];
    const seconds = meters / SPEED_OF_LIGHT;

    return seconds / timeUnitToSeconds[timeOutputUnit];
  }, [distanceInputUnit, parsedDistance, timeOutputUnit]);

  return (
    <section className="pageSection">
      <ToolIntro href="/calculators/light-travel-calculator" />

      <div className="calculatorGrid">
        <div className="inputCard">
          <h2>Time to Distance</h2>
          <label className="field">
            <span>Time</span>
            <div className="field__control">
              <input
                type="text"
                inputMode="decimal"
                value={timeInput}
                onChange={(event) => setTimeInput(event.target.value)}
              />
              <select
                aria-label="Time unit"
                value={timeInputUnit}
                onChange={(event) => setTimeInputUnit(event.target.value as TimeUnit)}
              >
                <option value="fs">fs</option>
                <option value="ps">ps</option>
                <option value="ns">ns</option>
                <option value="us">µs</option>
                <option value="ms">ms</option>
                <option value="s">s</option>
              </select>
            </div>
            <DecimalNote reading={readFlexibleDecimal(timeInput)} />
          </label>

          <label className="field">
            <span>Distance unit</span>
            <div className="field__control">
              <select
                aria-label="Distance output unit"
                value={distanceOutputUnit}
                onChange={(event) => setDistanceOutputUnit(event.target.value as DistanceUnit)}
              >
                <option value="nm">nm</option>
                <option value="um">µm</option>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </div>
          </label>

          <Readout
            primary
            label="Distance"
            value={Number.isNaN(distanceFromTime) ? null : formatSignificant(distanceFromTime, 6)}
            unit={unitLabel(distanceOutputUnit)}
          />
        </div>

        <div className="inputCard">
          <h2>Distance to Time</h2>
          <label className="field">
            <span>Distance</span>
            <div className="field__control">
              <input
                type="text"
                inputMode="decimal"
                value={distanceInput}
                onChange={(event) => setDistanceInput(event.target.value)}
              />
              <select
                aria-label="Distance unit"
                value={distanceInputUnit}
                onChange={(event) => setDistanceInputUnit(event.target.value as DistanceUnit)}
              >
                <option value="nm">nm</option>
                <option value="um">µm</option>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </div>
            <DecimalNote reading={readFlexibleDecimal(distanceInput)} />
          </label>

          <label className="field">
            <span>Time unit</span>
            <div className="field__control">
              <select
                aria-label="Time output unit"
                value={timeOutputUnit}
                onChange={(event) => setTimeOutputUnit(event.target.value as TimeUnit)}
              >
                <option value="fs">fs</option>
                <option value="ps">ps</option>
                <option value="ns">ns</option>
                <option value="us">µs</option>
                <option value="ms">ms</option>
                <option value="s">s</option>
              </select>
            </div>
          </label>

          <Readout
            primary
            label="Time"
            value={Number.isNaN(timeFromDistance) ? null : formatSignificant(timeFromDistance, 6)}
            unit={unitLabel(timeOutputUnit)}
          />
        </div>
      </div>
    </section>
  );
}
