"use client";

import { useState } from "react";

import { parseFlexibleDecimal } from "@/components/calculators/parse-flexible-decimal";
import {
  formatSpeed,
  paceToSpeed,
  speedToPace,
} from "@/components/calculators/pace";
import { ToolIntro } from "@/components/tool-intro";

type ConversionMode = "pace-to-speed" | "speed-to-pace";

const DEFAULT_MINUTES = 4;
const DEFAULT_SECONDS = 30;

function readPace(minutes: string, seconds: string) {
  const parsedMinutes = parseFlexibleDecimal(minutes);
  const parsedSeconds = parseFlexibleDecimal(seconds);

  return parsedMinutes === null || parsedSeconds === null
    ? null
    : paceToSpeed(parsedMinutes, parsedSeconds);
}

function readSpeed(speed: string) {
  const parsed = parseFlexibleDecimal(speed);
  return parsed === null ? null : speedToPace(parsed);
}

export function PaceCalculator() {
  const [mode, setMode] = useState<ConversionMode>("pace-to-speed");
  const [paceMinutes, setPaceMinutes] = useState(String(DEFAULT_MINUTES));
  const [paceSeconds, setPaceSeconds] = useState(String(DEFAULT_SECONDS));
  // the same pace as the defaults above, so the two sides agree on first load
  const [speed, setSpeed] = useState(() =>
    formatSpeed(paceToSpeed(DEFAULT_MINUTES, DEFAULT_SECONDS) ?? 0),
  );

  const isPaceToSpeed = mode === "pace-to-speed";

  // The output always comes from the input on show, so it can't go stale.
  const speedResult = isPaceToSpeed ? readPace(paceMinutes, paceSeconds) : null;
  const paceResult = isPaceToSpeed ? null : readSpeed(speed);

  // Swap carries the result over as the new input. With no result there is
  // nothing to carry, so the new input starts empty rather than stale.
  function handleSwap() {
    if (isPaceToSpeed) {
      setSpeed(speedResult === null ? "" : formatSpeed(speedResult));
      setMode("speed-to-pace");
      return;
    }

    setPaceMinutes(paceResult === null ? "" : String(paceResult.minutes));
    setPaceSeconds(paceResult === null ? "" : String(paceResult.seconds));
    setMode("pace-to-speed");
  }

  return (
    <section className="pageSection">
      <ToolIntro href="/calculators/pace">Pace</ToolIntro>

      <div className="paceCalculator">
        <section className="inputCard paceCalculator__panel">
          <div className="paceCalculator__panelHeader">
            <p className="sectionCard__kicker">Input</p>
            <h2>{isPaceToSpeed ? "Running pace" : "Speed"}</h2>
            <p>
              {isPaceToSpeed
                ? "Enter your pace in minutes and seconds per kilometer."
                : "Enter your speed in kilometers per hour."}
            </p>
          </div>

          {isPaceToSpeed ? (
            <div className="paceCalculator__dualField">
              <label className="field">
                <span>Minutes</span>
                <div className="field__control">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={paceMinutes}
                    onChange={(event) => setPaceMinutes(event.target.value)}
                  />
                  <span>min</span>
                </div>
              </label>

              <label className="field">
                <span>Seconds</span>
                <div className="field__control">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={paceSeconds}
                    onChange={(event) => setPaceSeconds(event.target.value)}
                  />
                  <span>sec</span>
                </div>
              </label>
            </div>
          ) : (
            <label className="field">
              <span>Speed</span>
              <div className="field__control">
                <input
                  type="text"
                  inputMode="decimal"
                  value={speed}
                  onChange={(event) => setSpeed(event.target.value)}
                />
                <span>km/h</span>
              </div>
            </label>
          )}
        </section>

        <div className="paceCalculator__swapWrap">
          <button
            type="button"
            className="buttonControl paceCalculator__swap"
            onClick={handleSwap}
          >
            <span className="paceCalculator__swapIcon" aria-hidden="true">
              ⇄
            </span>
            <span className="buttonControl__title">Swap</span>
            <span className="buttonControl__meta">
              {isPaceToSpeed ? "Pace to speed" : "Speed to pace"}
            </span>
          </button>
        </div>

        <section className="inputCard paceCalculator__panel">
          <div className="paceCalculator__panelHeader">
            <p className="sectionCard__kicker">Output</p>
            <h2>{isPaceToSpeed ? "Speed" : "Running pace"}</h2>
            <p>
              {isPaceToSpeed
                ? "Show the converted speed here in kilometers per hour."
                : "Show the converted pace here in minutes and seconds per kilometer."}
            </p>
          </div>

          {isPaceToSpeed ? (
            speedResult === null ? (
              <p className="resultCard" aria-live="polite">
                Enter a pace above zero to see the speed.
              </p>
            ) : (
              <div className="paceCalculator__resultCard" aria-live="polite">
                <span className="paceCalculator__resultValue">
                  {formatSpeed(speedResult)}
                </span>
                <span className="paceCalculator__resultUnit"> km/h</span>
              </div>
            )
          ) : paceResult === null ? (
            <p className="resultCard" aria-live="polite">
              Enter a speed above zero to see the pace.
            </p>
          ) : (
            <div className="paceCalculator__paceResult" aria-live="polite">
              <div className="paceCalculator__resultCard">
                <span className="paceCalculator__resultValue">
                  {paceResult.minutes}
                </span>
                <span className="paceCalculator__resultUnit"> min</span>
              </div>
              <div className="paceCalculator__resultCard">
                <span className="paceCalculator__resultValue">
                  {paceResult.seconds}
                </span>
                <span className="paceCalculator__resultUnit"> sec</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
