"use client";

import { useState, type ChangeEvent } from "react";
import {
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  type ChartData,
  type ChartDataset,
  type ChartOptions,
} from "chart.js";

import { parseArrayCsv, type CsvDataset } from "@/components/plotters/csv-parsing";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type Point = {
  x: number;
  y: number;
};

type ParseResult = {
  error: string | null;
  points: Point[];
  xCount: number;
  yCount: number;
};

const defaultX = "[0, 1, 2, 3, 4, 5, 6]";
const defaultY = "[0, 1, 4, 9, 16, 25, 36]";

function parseNumberArray(value: string): number[] {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  const parsed = trimmed.startsWith("[")
    ? JSON.parse(trimmed)
    : trimmed.split(/[\s,]+/).filter(Boolean);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected an array of numbers.");
  }

  return parsed.map((entry) => {
    const numeric = typeof entry === "number" ? entry : Number(entry);

    if (!Number.isFinite(numeric)) {
      throw new Error("Arrays must contain only finite numbers.");
    }

    return numeric;
  });
}

function buildSeries(xInput: string, yInput: string): ParseResult {
  try {
    const x = parseNumberArray(xInput);
    const y = parseNumberArray(yInput);

    if (x.length === 0 || y.length === 0) {
      return {
        error: "Enter at least one value in both arrays.",
        points: [],
        xCount: x.length,
        yCount: y.length,
      };
    }

    if (x.length !== y.length) {
      return {
        error: "x and y need the same number of entries.",
        points: [],
        xCount: x.length,
        yCount: y.length,
      };
    }

    return {
      error: null,
      points: x.map((xValue, index) => ({ x: xValue, y: y[index] })),
      xCount: x.length,
      yCount: y.length,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to parse the arrays.",
      points: [],
      xCount: 0,
      yCount: 0,
    };
  }
}

const chartOptions: ChartOptions<"scatter"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: "top" },
    title: { display: false },
    tooltip: { enabled: true },
  },
  scales: {
    x: {
      type: "linear",
      title: { display: true, text: "x" },
      grid: { color: "rgba(91, 102, 117, 0.18)" },
    },
    y: {
      title: { display: true, text: "y" },
      grid: { color: "rgba(91, 102, 117, 0.18)" },
    },
  },
  elements: {
    point: { radius: 3, hoverRadius: 5 },
    line: { tension: 0 },
  },
};

export default function ArrayPlotter() {
  const [xInput, setXInput] = useState(defaultX);
  const [yInput, setYInput] = useState(defaultY);
  const [csvDatasets, setCsvDatasets] = useState<CsvDataset[]>([]);
  const [csvStatus, setCsvStatus] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  const series = buildSeries(xInput, yInput);
  const usingCsvMode = csvDatasets.length > 0;

  const chartData: ChartData<"scatter"> = {
    datasets: usingCsvMode
      ? csvDatasets.map<ChartDataset<"scatter", Point[]>>((dataset) => {
          return {
            label: dataset.label,
            data: dataset.points,
            showLine: true,
            borderWidth: 2,
          };
        })
      : [
          {
            label: "Input series",
            data: series.points,
            showLine: true,
            borderWidth: 2,
          },
        ],
  };

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    const results = await Promise.all(
      files.map(async (file) => parseArrayCsv(await file.text(), file.name)),
    );
    const firstError = results.find((result) => result.error);

    if (firstError) {
      setCsvDatasets([]);
      setCsvStatus(null);
      setCsvError(firstError.error);
      event.target.value = "";
      return;
    }

    const datasets = results.flatMap((result) => result.datasets);
    setCsvDatasets(datasets);
    const skippedRowCount = results.reduce(
      (total, result) => total + result.skippedRowCount,
      0,
    );
    setCsvStatus(
      `Loaded ${files.length} CSV file${files.length === 1 ? "" : "s"}.${
        skippedRowCount > 0
          ? ` (${skippedRowCount} row${skippedRowCount === 1 ? "" : "s"} skipped.)`
          : ""
      }`,
    );
    setCsvError(null);
    event.target.value = "";
  }

  function handleClearCsv() {
    setCsvDatasets([]);
    setCsvStatus(null);
    setCsvError(null);
  }

  const statusMessage = usingCsvMode
    ? csvStatus ?? `Plotting ${csvDatasets.length} CSV dataset${csvDatasets.length === 1 ? "" : "s"}.`
    : series.error
      ? series.error
      : `Plotting ${series.points.length} points from ${series.xCount} x-values and ${series.yCount} y-values.`;

  const activeError = usingCsvMode ? csvError : series.error;

  return (
    <div className="visualizerLayout">
      <div className="inputCard fieldStack">
        <div>
          <h2>Array Input</h2>
          <p className="lead">
            Paste JSON arrays like <code>[0, 1, 2]</code> or plain values like
            <code> 0, 1, 2</code>. You can also load one or more CSV files with
            numeric x/y columns. Leading <code>%</code> comment lines and header
            rows before the numeric data are ignored.
          </p>
        </div>

        <label className="field">
          <span>CSV files</span>
          <input
            className="fileInput"
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={(event) => {
              void handleCsvUpload(event);
            }}
          />
        </label>

        {usingCsvMode ? (
          <button
            type="button"
            className="buttonLink buttonLink--ghost"
            onClick={handleClearCsv}
          >
            Clear CSV datasets
          </button>
        ) : null}

        <label className="field">
          <span>x values</span>
          <div className="field__control field__control--textarea">
            <textarea
              value={xInput}
              onChange={(event) => setXInput(event.target.value)}
              spellCheck={false}
              aria-label="x array input"
            />
          </div>
        </label>

        <label className="field">
          <span>y values</span>
          <div className="field__control field__control--textarea">
            <textarea
              value={yInput}
              onChange={(event) => setYInput(event.target.value)}
              spellCheck={false}
              aria-label="y array input"
            />
          </div>
        </label>

        <p className="resultCard">{csvError ?? statusMessage}</p>
      </div>

      <div className="sectionCard visualizerChartCard">
        <div>
          <p className="sectionCard__kicker">Chart.js</p>
          <h2>Data Plot</h2>
        </div>
        <div className="visualizerChartSurface">
          <InteractiveScatterChart data={chartData} options={chartOptions} />
          {activeError ? (
            <div className="visualizerEmptyState visualizerOverlayState">
              Fix the input data to render the figure.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
