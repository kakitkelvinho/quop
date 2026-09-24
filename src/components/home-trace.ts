import { readFileSync } from "node:fs";
import path from "node:path";

export type TraceSketch = {
  /** SVG path data in a 0–1000 × 0–1000 box, y pointing down. */
  d: string;
  /** Where the tallest point landed in that box, for the annotation. */
  peak: [number, number];
  spanNs: number;
};

/** The real detector trace in public/data, read at build time and reduced to a
 *  path for the plotter chapter to draw. Each bucket keeps its min and max, so
 *  downsampling never shaves the pulse off. */
export function loadPowerTrace(buckets = 220): TraceSketch {
  const csv = readFileSync(path.join(process.cwd(), "public/data/power15.csv"), "utf8");
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const columns = header.split(",");
  const signal = columns.indexOf("ch3");
  const time = columns.indexOf("time");
  const samples = rows.map((row) => {
    const cells = row.split(",");
    return { t: Number(cells[time]), v: Number(cells[signal]) };
  });

  const vMin = Math.min(...samples.map((s) => s.v));
  const vMax = Math.max(...samples.map((s) => s.v));
  const t0 = samples[0].t;
  const span = samples[samples.length - 1].t - t0;
  const x = (t: number) => ((t - t0) / span) * 1000;
  const y = (v: number) => 1000 - ((v - vMin) / (vMax - vMin)) * 1000;

  const points: [number, number][] = [];
  const size = Math.ceil(samples.length / buckets);
  for (let i = 0; i < samples.length; i += size) {
    const bucket = samples.slice(i, i + size);
    const low = bucket.reduce((a, b) => (b.v < a.v ? b : a));
    const high = bucket.reduce((a, b) => (b.v > a.v ? b : a));
    for (const s of low.t <= high.t ? [low, high] : [high, low]) points.push([x(s.t), y(s.v)]);
  }

  const peak = points.reduce((a, b) => (b[1] < a[1] ? b : a));
  return {
    d: points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" "),
    peak,
    spanNs: span * 1e9,
  };
}
