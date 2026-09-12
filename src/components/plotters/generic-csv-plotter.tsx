"use client";

import { useMemo, useState, type ChangeEvent } from "react";
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

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

type DataPoint = {
  x: number;
  y: number;
};

type ParsedGenericCsv = {
  error: string | null;
  headers: string[];
  rowCount: number;
  rows: number[][];
};

const palette = [
  { border: "#8b1e3f", background: "#8b1e3f" },
  { border: "#1f6f78", background: "#1f6f78" },
  { border: "#d17a22", background: "#d17a22" },
  { border: "#4a6d3b", background: "#4a6d3b" },
  { border: "#5c4b8a", background: "#5c4b8a" },
];

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

function createGenericDemoCsv() {
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

function parseGenericCsv(csv: string): ParsedGenericCsv {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      error: "Provide a header row and at least one data row.",
      headers: [],
      rowCount: 0,
      rows: [],
    };
  }

  const headers = parseCsvRow(lines[0]).map(
    (header, index) => header || `column_${index + 1}`,
  );

  if (headers.length < 2) {
    return {
      error: "CSV input must contain at least two numeric columns.",
      headers,
      rowCount: 0,
      rows: [],
    };
  }

  const rows: number[][] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const columns = parseCsvRow(lines[index]);

    if (columns.length !== headers.length) {
      return {
        error: `Row ${index + 1} does not contain ${headers.length} columns.`,
        headers,
        rowCount: index - 1,
        rows: [],
      };
    }

    const numericRow = columns.map(Number);

    if (numericRow.some((value) => !Number.isFinite(value))) {
      return {
        error: `Row ${index + 1} contains a non-numeric value.`,
        headers,
        rowCount: index - 1,
        rows: [],
      };
    }

    rows.push(numericRow);
  }

  return {
    error: null,
    headers,
    rowCount: rows.length,
    rows,
  };
}

export default function GenericCsvPlotter() {
  const [csvInput, setCsvInput] = useState(createGenericDemoCsv);
  const [sourceLabel, setSourceLabel] = useState("demo-generic-columns.csv");
  const parsed = useMemo(() => parseGenericCsv(csvInput), [csvInput]);
  const [xColumnIndex, setXColumnIndex] = useState(0);
  const [yColumnIndexes, setYColumnIndexes] = useState<number[]>([]);

  const resolvedXColumnIndex = parsed.headers.length
    ? Math.min(xColumnIndex, parsed.headers.length - 1)
    : 0;
  const resolvedYColumnIndexes = useMemo(() => {
    if (!parsed.headers.length) {
      return [];
    }

    const filtered = yColumnIndexes.filter(
      (index) => index < parsed.headers.length && index !== resolvedXColumnIndex,
    );

    return filtered.length
      ? filtered
      : parsed.headers
          .map((_, index) => index)
          .filter((index) => index !== resolvedXColumnIndex);
  }, [parsed.headers, resolvedXColumnIndex, yColumnIndexes]);

  const xLabel = parsed.headers[resolvedXColumnIndex] ?? "x";
  const selectedYLabels = resolvedYColumnIndexes
    .map((index) => parsed.headers[index])
    .filter(Boolean);

  const chartData: ChartData<"scatter"> = {
    datasets: resolvedYColumnIndexes.map<ChartDataset<"scatter", DataPoint[]>>((columnIndex, index) => {
      const color = palette[index % palette.length];

      return {
        label: parsed.headers[columnIndex],
        data: parsed.rows.map((row) => ({
          x: row[resolvedXColumnIndex],
          y: row[columnIndex],
        })),
        showLine: true,
        borderWidth: 2,
        borderColor: color.border,
        backgroundColor: color.background,
        pointRadius: 1.5,
        pointHoverRadius: 3,
      };
    }),
  };

  const chartOptions: ChartOptions<"scatter"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          usePointStyle: true,
          boxWidth: 10,
        },
      },
      title: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        type: "linear",
        title: { display: true, text: xLabel },
        grid: { color: "rgba(91, 102, 117, 0.18)" },
      },
      y: {
        title: { display: true, text: "selected columns" },
        grid: { color: "rgba(91, 102, 117, 0.18)" },
      },
    },
    elements: {
      point: { radius: 1.5, hoverRadius: 3 },
      line: { tension: 0 },
    },
  };

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const nextCsv = await file.text();
    setCsvInput(nextCsv);
    setSourceLabel(file.name);
    event.target.value = "";
  }

  function handleXColumnChange(nextIndex: number) {
    setXColumnIndex(nextIndex);
    setYColumnIndexes((current) => {
      const filtered = current.filter((index) => index !== nextIndex);

      return filtered.length
        ? filtered
        : parsed.headers.map((_, index) => index).filter((index) => index !== nextIndex);
    });
  }

  function handleYColumnToggle(columnIndex: number, checked: boolean) {
    setYColumnIndexes((current) => {
      if (checked) {
        return current.includes(columnIndex) ? current : [...current, columnIndex].sort((a, b) => a - b);
      }

      return current.filter((index) => index !== columnIndex);
    });
  }

  const canRenderChart = !parsed.error && resolvedYColumnIndexes.length > 0 && parsed.rows.length > 0;

  return (
    <div className="visualizerLayout">
      <div className="inputCard fieldStack">
        <div>
          <h2>Generic CSV</h2>
          <p className="lead">
            Upload a numeric CSV with headers, then choose which column is the
            x-axis and which columns should be plotted as y-series.
          </p>
        </div>

        <label className="field">
          <span>CSV file</span>
          <input
            className="fileInput"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              void handleFileUpload(event);
            }}
          />
        </label>

        <label className="field">
          <span>CSV contents</span>
          <div className="field__control field__control--textarea">
            <textarea
              value={csvInput}
              onChange={(event) => {
                setCsvInput(event.target.value);
                setSourceLabel("inline CSV");
              }}
              spellCheck={false}
              aria-label="CSV input"
            />
          </div>
        </label>

        {parsed.headers.length ? (
          <div className="csvRoleChooser">
            <div className="csvRoleChooser__header">
              <p className="sectionCard__kicker">Column Roles</p>
              <p>Pick one x column and any number of y columns.</p>
            </div>
            {parsed.headers.map((header, index) => {
              const isX = index === resolvedXColumnIndex;
              const isY = resolvedYColumnIndexes.includes(index);

              return (
                <div className="csvRoleRow" key={`${header}-${index}`}>
                  <span className="csvRoleRow__name">{header}</span>
                  <label className="csvRoleToggle">
                    <input
                      checked={index === resolvedXColumnIndex}
                      name="generic-csv-x-column"
                      onChange={() => handleXColumnChange(index)}
                      type="radio"
                    />
                    <span>X</span>
                  </label>
                  <label className="csvRoleToggle">
                    <input
                      checked={isY}
                      disabled={isX}
                      onChange={(event) =>
                        handleYColumnToggle(index, event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>Y</span>
                  </label>
                </div>
              );
            })}
          </div>
        ) : null}

        <p className="resultCard">
          {parsed.error
            ? parsed.error
            : resolvedYColumnIndexes.length === 0
              ? "Select at least one Y column to render the plot."
              : `Plotting ${parsed.rowCount} rows from ${sourceLabel}. X-axis: ${xLabel}. Y-series: ${selectedYLabels.join(", ")}.`}
        </p>
      </div>

      <div className="sectionCard visualizerChartCard">
        <div>
          <p className="sectionCard__kicker">Column plot</p>
          <h2>CSV Plot</h2>
          <p>
            The selected x column labels the horizontal axis automatically, and
            every selected y column becomes a legend entry.
          </p>
        </div>
        <div className="visualizerChartSurface">
          {canRenderChart ? (
            <InteractiveScatterChart
              data={chartData}
              options={chartOptions}
              sourceLabel={sourceLabel}
            />
          ) : null}
          {!canRenderChart ? (
            <div className="visualizerEmptyState visualizerOverlayState">
              {parsed.error
                ? "Fix the CSV input to render the figure."
                : "Choose one x column and at least one y column to render the figure."}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
