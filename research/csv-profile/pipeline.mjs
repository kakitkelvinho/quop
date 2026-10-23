// Replays the generic CSV plotter's work for one file outside the browser:
// parse, the plotter's chartData, the chart wrapper's signature/bounds scans,
// Chart.js build + update on a no-op canvas, and React rendering the picker.
// Rasterising is not measured (no real canvas). Usage: node pipeline.mjs <csv>
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const { parseGenericCsv } = await import(`${process.cwd()}/src/components/plotters/csv-parsing.ts`);

const repo = `${process.cwd()}/`;
const require = createRequire(repo);
const { Chart, LinearScale, PointElement, LineElement, ScatterController, Legend, Tooltip, Title } =
  require("chart.js");
Chart.register(LinearScale, PointElement, LineElement, ScatterController, Legend, Tooltip, Title);
const React = require("react");
const { renderToString } = require("react-dom/server");

const csv = readFileSync(process.argv[2], "utf8");
const ROW_NUMBER = -1;

function time(label, fn, n = 3) {
  let result;
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    result = fn();
    ts.push(performance.now() - t);
  }
  ts.sort((a, b) => a - b);
  console.log(`  ${label.padEnd(44)} ${ts[n >> 1].toFixed(1).padStart(8)} ms`);
  return result;
}

// generic-csv-plotter.tsx: the chartData it rebuilds on every render
function plotterChartData(parsed, xIndex, yIndexes) {
  return {
    datasets: yIndexes.map((columnIndex) => ({
      label: parsed.headers[columnIndex],
      data: parsed.rows
        .map((row, rowIndex) => ({
          x: xIndex === ROW_NUMBER ? rowIndex + 1 : row[xIndex],
          y: row[columnIndex],
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
      showLine: true,
      borderWidth: 2,
      pointRadius: 1.5,
      pointHoverRadius: 3,
    })),
  };
}

// interactive-scatter-chart.tsx: extractFinitePoints + buildBaseBounds, which
// buildDataSignature runs (twice over) and the inner chart runs again
function extractFinitePoints(data) {
  const points = [];
  for (const dataset of data.datasets) {
    for (const entry of dataset.data ?? []) {
      const x = Number(entry.x);
      const y = Number(entry.y);
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    }
  }
  return points;
}
function buildBaseBounds(data) {
  const points = extractFinitePoints(data);
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const p of points) {
    xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x);
    yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y);
  }
  return { xMin, xMax, yMin, yMax };
}
function buildDataSignature(data) {
  const points = extractFinitePoints(data);
  const bounds = buildBaseBounds(data);
  const summary = data.datasets
    .map((d, i) => [i, d.label, d.data.length, `${d.data[0]?.x}:${d.data[0]?.y}`].join("|"))
    .join("||");
  return [points.length, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax, summary].join("::");
}

function stubCanvas() {
  const ctx = new Proxy(
    { measureText: (text) => ({ width: String(text).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key === "canvas") return canvas;
        return () => {};
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );
  const canvas = { width: 1100, height: 700, style: {}, getContext: () => ctx };
  return canvas;
}

const options = {
  responsive: false,
  animation: false,
  plugins: { legend: { display: true, position: "top", labels: { usePointStyle: true, boxWidth: 10 } }, tooltip: { enabled: true } },
  scales: { x: { type: "linear" }, y: {} },
  elements: { point: { radius: 1.5 }, line: { tension: 0 } },
};

// generic-csv-plotter.tsx's picker: one row per header, two inputs each
function Picker({ headers, xIndex, yIndexes }) {
  const h = React.createElement;
  return h(
    "div",
    { className: "csvRoleChooser" },
    headers.map((header, index) =>
      h(
        "div",
        { className: "csvRoleRow", key: `${header}-${index}` },
        h("span", { className: "csvRoleRow__name" }, header),
        h("label", { className: "csvRoleToggle" }, h("input", { type: "radio", name: "x", checked: index === xIndex, readOnly: true }), h("span", null, "X")),
        h("label", { className: "csvRoleToggle" }, h("input", { type: "checkbox", checked: yIndexes.includes(index), disabled: index === xIndex, readOnly: true }), h("span", null, "Y")),
      ),
    ),
  );
}

function run(label, layout) {
  console.log(`\n${label}`);
  const parsed = time("parseGenericCsv", () => parseGenericCsv(csv, layout));
  const yIndexes = parsed.headers.map((_, i) => i).filter((i) => i !== 0);
  console.log(`  -> ${yIndexes.length} series x ${parsed.rows.length} points, extraInfo ${parsed.extraInfo.length} chars`);
  const data = time("plotter chartData (every render)", () => plotterChartData(parsed, 0, yIndexes));
  time("wrapper buildDataSignature (every render)", () => buildDataSignature(data));
  time("inner buildBaseBounds (on new data)", () => buildBaseBounds(data));
  time("React picker render (renderToString)", () =>
    renderToString(React.createElement(Picker, { headers: parsed.headers, xIndex: 0, yIndexes })),
  );
  const chart = time("Chart.js new Chart + first layout/draw", () => new Chart(stubCanvas(), { type: "scatter", data: plotterChartData(parsed, 0, yIndexes), options }), 1);
  time("Chart.js update with fresh datasets", () => {
    chart.data.datasets = plotterChartData(parsed, 0, yIndexes).datasets;
    chart.update("none");
  });
  chart.options.plugins.legend.display = false;
  time("  same, legend hidden", () => {
    chart.data.datasets = plotterChartData(parsed, 0, yIndexes).datasets;
    chart.update("none");
  });
  chart.destroy();
}

run("AUTO layout (what a dropped file gets today)", undefined);
run("COLUMNS layout", "columns");
