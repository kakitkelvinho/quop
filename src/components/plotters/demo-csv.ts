// Made-up CSVs a plotter shows before its sample loads, or when there is none.

/** two damped channels against time, like a scope trace */
export const DEMO_TIME_SERIES_LABEL = "demo-time-series.csv";

export function createDemoTimeSeriesCsv() {
  const rows = ["ch2,ch3,time"];

  for (let index = 0; index < 320; index += 1) {
    const time = -6.7e-8 + index * 1.41e-10;
    const ch2 = 0.2 + 0.06 * Math.exp(-(index / 120)) * Math.sin(index * 0.18);
    const ch3 =
      -0.005 + 0.0035 * Math.exp(-(index / 90)) * Math.cos(index * 0.16);

    rows.push(
      `${ch2.toFixed(12)},${ch3.toFixed(12)},${time.toExponential(12)}`,
    );
  }

  return rows.join("\n");
}

/** three signals against a position column */
export const DEMO_GENERIC_LABEL = "demo-generic-columns.csv";

export function createGenericDemoCsv() {
  const rows = ["position,signal_a,signal_b,signal_c"];

  for (let index = 0; index < 240; index += 1) {
    const x = index * 0.5;
    const signalA = 2 + Math.sin(index * 0.09) * 0.8;
    const signalB = 1.2 + Math.cos(index * 0.06 + 0.8) * 0.5;
    const signalC = 0.4 + Math.sin(index * 0.03) * Math.cos(index * 0.11) * 0.6;

    rows.push(
      `${x.toFixed(4)},${signalA.toFixed(6)},${signalB.toFixed(6)},${signalC.toFixed(6)}`,
    );
  }

  return rows.join("\n");
}
