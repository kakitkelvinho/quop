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

type CsvDataset = {
  label: string;
  points: Point[];
};

type CsvParseResult = {
  datasets: CsvDataset[];
  error: string | null;
  sourceLabel: string;
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

function parseCsvRow(row: string): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    const nextCharacter = row[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
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

function parseCsvFile(contents: string, label: string): CsvParseResult {
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("%"));

  if (!lines.length) {
    return {
      datasets: [],
      error: `${label}: no usable CSV rows found.`,
      sourceLabel: label,
    };
  }

  const dataStartIndex = lines.findIndex((line) => {
    const columns = parseCsvRow(line);

    if (columns.length < 2) {
      return false;
    }

    const xValue = Number(columns[0]);
    const yValue = Number(columns[1]);
    return Number.isFinite(xValue) && Number.isFinite(yValue);
  });

  if (dataStartIndex === -1) {
    return {
      datasets: [],
      error: `${label}: could not find a numeric x/y data block.`,
      sourceLabel: label,
    };
  }

  const points: Point[] = [];

  for (let index = dataStartIndex; index < lines.length; index += 1) {
    const columns = parseCsvRow(lines[index]);

    if (columns.length < 2) {
      return {
        datasets: [],
        error: `${label}: row ${index + 1} does not contain at least two columns.`,
        sourceLabel: label,
      };
    }

    const xValue = Number(columns[0]);
    const yValue = Number(columns[1]);

    if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
      return {
        datasets: [],
        error: `${label}: row ${index + 1} has a non-numeric x or y value.`,
        sourceLabel: label,
      };
    }

    points.push({ x: xValue, y: yValue });
  }

  if (!points.length) {
    return {
      datasets: [],
      error: `${label}: no numeric data rows found.`,
      sourceLabel: label,
    };
  }

  return {
    datasets: [{ label, points }],
    error: null,
    sourceLabel: label,
  };
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
      files.map(async (file) => parseCsvFile(await file.text(), file.name)),
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
    setCsvStatus(`Loaded ${files.length} CSV file${files.length === 1 ? "" : "s"}.`);
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
