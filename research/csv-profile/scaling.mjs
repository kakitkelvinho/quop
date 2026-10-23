// How Chart.js update time grows with series count (4 points each), no-op canvas.
import { createRequire } from "node:module";
const require = createRequire(`${process.cwd()}/`);
const { Chart, LinearScale, PointElement, LineElement, ScatterController, Legend, Tooltip } = require("chart.js");
Chart.register(LinearScale, PointElement, LineElement, ScatterController, Legend, Tooltip);

function stubCanvas() {
  const ctx = new Proxy({ measureText: (t) => ({ width: String(t).length * 6 }) }, {
    get: (t, k) => (k in t ? t[k] : k === "canvas" ? canvas : () => {}),
    set: (t, k, v) => ((t[k] = v), true),
  });
  const canvas = { width: 1100, height: 700, style: {}, getContext: () => ctx };
  return canvas;
}
const datasets = (n) =>
  Array.from({ length: n }, (_, i) => ({ label: `row ${i + 1}`, showLine: true, data: [46, 70.3, 48.6, 58].map((x, j) => ({ x, y: i + j })) }));

for (const n of [500, 1000, 2000, 4000, 8000]) {
  const chart = new Chart(stubCanvas(), { type: "scatter", data: { datasets: datasets(n) }, options: { responsive: false, animation: false } });
  const t = performance.now();
  chart.data.datasets = datasets(n);
  chart.update("none");
  console.log(`${String(n).padStart(5)} series: update ${(performance.now() - t).toFixed(0)} ms`);
  chart.destroy();
}
