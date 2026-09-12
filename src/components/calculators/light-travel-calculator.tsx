"use client";

import { useMemo, useState } from "react";

import { parseFlexibleDecimal } from "@/components/calculators/parse-flexible-decimal";

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

function formatResult(value: number) {
  const absoluteValue = Math.abs(value);

  if (absoluteValue === 0) {
    return "0";
  }

  if (absoluteValue >= 1e4 || absoluteValue < 1e-3) {
    return value.toExponential(6);
  }

  if (absoluteValue >= 100) {
    return value.toFixed(3);
  }

  if (absoluteValue >= 1) {
    return value.toFixed(4);
  }

  return value.toFixed(6);
}

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
      <h1>Light Travel Calculator</h1>
      <p className="lead">
        Convert between elapsed time and the distance light travels in vacuum.
        For reference, <code>30 fs</code> is about <code>8.994 um</code>.
      </p>

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
                <option value="us">us</option>
                <option value="ms">ms</option>
                <option value="s">s</option>
              </select>
            </div>
          </label>

          <label className="field">
            <span>Output distance unit</span>
            <div className="field__control">
              <select
                aria-label="Distance output unit"
                value={distanceOutputUnit}
                onChange={(event) => setDistanceOutputUnit(event.target.value as DistanceUnit)}
              >
                <option value="nm">nm</option>
                <option value="um">um</option>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </div>
          </label>

          <p className="resultCard">
            {Number.isNaN(distanceFromTime)
              ? "Invalid input."
              : `${formatResult(distanceFromTime)} ${distanceOutputUnit}`}
          </p>
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
                <option value="um">um</option>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </div>
          </label>

          <label className="field">
            <span>Output time unit</span>
            <div className="field__control">
              <select
                aria-label="Time output unit"
                value={timeOutputUnit}
                onChange={(event) => setTimeOutputUnit(event.target.value as TimeUnit)}
              >
                <option value="fs">fs</option>
                <option value="ps">ps</option>
                <option value="ns">ns</option>
                <option value="us">us</option>
                <option value="ms">ms</option>
                <option value="s">s</option>
              </select>
            </div>
          </label>

          <p className="resultCard">
            {Number.isNaN(timeFromDistance)
              ? "Invalid input."
              : `${formatResult(timeFromDistance)} ${timeOutputUnit}`}
          </p>
        </div>
      </div>
    </section>
  );
}
