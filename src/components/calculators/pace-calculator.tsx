"use client";

import { useState } from "react";

type ConversionMode = "pace-to-speed" | "speed-to-pace";

export function PaceCalculator() {
  const [mode, setMode] = useState<ConversionMode>("pace-to-speed");
  const [paceMinutes, setPaceMinutes] = useState("4");
  const [paceSeconds, setPaceSeconds] = useState("30");
  const [speed, setSpeed] = useState("13.3");

  const isPaceToSpeed = mode === "pace-to-speed";

  function handlePaceMinutesChange(value: string) {
    setPaceMinutes(value);

    const minutesPerKm = Number(value) + Number(paceSeconds) / 60;

    if (minutesPerKm > 0) {
      const result = 60 / minutesPerKm;
      setSpeed(String(result.toFixed(2)));
    }
  }

  function handlePaceSecondsChange(value: string) {
    setPaceSeconds(value);

    const minutesPerKm = Number(paceMinutes) + Number(value) / 60;

    if (minutesPerKm > 0) {
      const result = 60 / minutesPerKm;
      setSpeed(String(result.toFixed(2)));
    }
  }

  function handleSpeedChange(value: string) {
    setSpeed(value);

    const nextSpeed = Number(value);

    if (nextSpeed > 0) {
      const totalMinutesPerKm = 60 / nextSpeed;
      const wholeMinutes = Math.floor(totalMinutesPerKm);
      const seconds = Math.round((totalMinutesPerKm - wholeMinutes) * 60);

      if (seconds === 60) {
        setPaceMinutes(String(wholeMinutes + 1));
        setPaceSeconds("0");
        return;
      }

      setPaceMinutes(String(wholeMinutes));
      setPaceSeconds(String(seconds.toFixed(2)));
    }
  }

  // Wire your conversion result into these display values.

  return (
    <section className="pageSection">
      <h1>Pace</h1>
      <p className="lead">
        Find out how fast you have to run/cycle to keep up!
      </p>

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
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={paceMinutes}
                    onChange={(event) =>
                      handlePaceMinutesChange(event.target.value)
                    }
                  />
                  <span>min</span>
                </div>
              </label>

              <label className="field">
                <span>Seconds</span>
                <div className="field__control">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="59"
                    step="1"
                    value={paceSeconds}
                    onChange={(event) =>
                      handlePaceSecondsChange(event.target.value)
                    }
                  />
                  <span> sec(s)</span>
                </div>
              </label>
            </div>
          ) : (
            <label className="field">
              <span>Speed</span>
              <div className="field__control">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={speed}
                  onChange={(event) => handleSpeedChange(event.target.value)}
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
            onClick={() =>
              setMode((current) =>
                current === "pace-to-speed" ? "speed-to-pace" : "pace-to-speed",
              )
            }
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
            <div className="paceCalculator__resultCard" aria-live="polite">
              <span className="paceCalculator__resultValue">{speed}</span>
              <span className="paceCalculator__resultUnit"> km/h</span>
            </div>
          ) : (
            <div className="paceCalculator__paceResult" aria-live="polite">
              <div className="paceCalculator__resultCard">
                <span className="paceCalculator__resultValue">
                  {paceMinutes}
                </span>
                <span className="paceCalculator__resultUnit"> min</span>
              </div>
              <div className="paceCalculator__resultCard">
                <span className="paceCalculator__resultValue">
                  {paceSeconds}
                </span>
                <span className="paceCalculator__resultUnit"> sec(s)</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
