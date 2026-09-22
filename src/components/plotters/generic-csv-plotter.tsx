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

import { CHART_SERIES_PALETTE as palette } from "@/components/plotters/chart-series-palette";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import SidebarCollapseToggle from "@/components/sidebar-collapse-toggle";

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
  skippedRowCount: number;
  rows: number[][];
  extraInfo: string;
};

// Instrument/acquisition exports often prefix metadata lines with a comment
// marker (or just tack them on above the real header) before the actual
// header/data rows show up.
const COMMENT_PREFIXES = ["%", "#", ";", "//"];

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

function stripCommentPrefix(line: string): string {
  for (const prefix of COMMENT_PREFIXES) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
  }

  return line;
}

function isFullyNumericRow(fields: string[]): boolean {
  return (
    fields.length >= 2 &&
    fields.every((field) => field !== "" && Number.isFinite(Number(field)))
  );
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
  const rawLines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (rawLines.length < 2) {
    return {
      error: "Provide a header row and at least one data row.",
      headers: [],
      rowCount: 0,
      skippedRowCount: 0,
      rows: [],
      extraInfo: "",
    };
  }

  // Strip any comment marker up front and pre-compute each line's fields
  // once, so a commented header row is treated the same as a plain one.
  const lines = rawLines.map((line) => {
    const text = stripCommentPrefix(line);
    const fields = text ? parseCsvRow(text) : [];
    return { text, fields, isNumericRow: isFullyNumericRow(fields) };
  });

  const dataStartIndex = lines.findIndex((line) => line.isNumericRow);

  if (dataStartIndex === -1) {
    return {
      error: "Couldn't find any numeric data rows in this file.",
      headers: [],
      rowCount: 0,
      skippedRowCount: 0,
      rows: [],
      extraInfo: rawLines.map((line) => stripCommentPrefix(line)).join("\n"),
    };
  }

  // The header is the nearest line above the first data row whose column
  // count matches the data - everything above that (instrument settings,
  // acquisition notes, ...) is treated as metadata rather than plotted.
  const dataColumnCount = lines[dataStartIndex].fields.length;
  let headerIndex = -1;

  for (let index = dataStartIndex - 1; index >= 0; index -= 1) {
    const candidate = lines[index];

    if (!candidate.isNumericRow && candidate.fields.length === dataColumnCount) {
      headerIndex = index;
      break;
    }
  }

  const leadingInfo = lines
    .slice(0, headerIndex === -1 ? dataStartIndex : headerIndex)
    .map((line) => line.text)
    .filter(Boolean);

  const headers =
    headerIndex === -1
      ? Array.from({ length: dataColumnCount }, (_, index) => `column_${index + 1}`)
      : lines[headerIndex].fields.map(
          (header, index) => header || `column_${index + 1}`,
        );

  if (headers.length < 2) {
    return {
      error: "CSV input must contain at least two numeric columns.",
      headers,
      rowCount: 0,
      skippedRowCount: 0,
      rows: [],
      extraInfo: leadingInfo.join("\n"),
    };
  }

  const rows: number[][] = [];
  let skippedRowCount = 0;
  const trailingInfo: string[] = [];

  for (let index = dataStartIndex; index < lines.length; index += 1) {
    const row = lines[index];

    if (row.fields.length !== headers.length) {
      skippedRowCount += 1;
      if (row.text) trailingInfo.push(row.text);
      continue;
    }

    const numericRow = row.fields.map(Number);

    if (numericRow.some((value) => !Number.isFinite(value))) {
      skippedRowCount += 1;
      continue;
    }

    rows.push(numericRow);
  }

  if (rows.length === 0) {
    return {
      error: "No valid numeric data rows were found under the header row.",
      headers,
      rowCount: 0,
      skippedRowCount,
      rows: [],
      extraInfo: [...leadingInfo, ...trailingInfo].join("\n"),
    };
  }

  return {
    error: null,
    headers,
    rowCount: rows.length,
    skippedRowCount,
    rows,
    extraInfo: [...leadingInfo, ...trailingInfo].join("\n"),
  };
}

export default function GenericCsvPlotter() {
  const [csvInput, setCsvInput] = useState(createGenericDemoCsv);
  const [sourceLabel, setSourceLabel] = useState("demo-generic-columns.csv");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const statusMessage = parsed.error
    ? parsed.error
    : resolvedYColumnIndexes.length === 0
      ? "Select at least one Y column to render the plot."
      : `Plotting ${parsed.rowCount} rows from ${sourceLabel}. X-axis: ${xLabel}. Y-series: ${selectedYLabels.join(", ")}.${
          parsed.skippedRowCount > 0
            ? ` (${parsed.skippedRowCount} row${parsed.skippedRowCount === 1 ? "" : "s"} skipped.)`
            : ""
        }`;

  return (
    <div
      className={`visualizerLayout${sidebarCollapsed ? " visualizerLayout--sidebarCollapsed" : ""}`}
    >
      <div className="visualizerSidebar">
        <SidebarCollapseToggle
          collapsed={sidebarCollapsed}
          label="input panel"
          onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
        />
        <div className="inputCard fieldStack">
          <div>
            <h2>Generic CSV</h2>
            <p className="lead">
              Upload a numeric CSV with headers, then choose which column is
              the x-axis and which columns should be plotted as y-series.
              Leading metadata or comment lines (camera settings, fit
              parameters, a <code>#</code>/<code>%</code> block, ...) are
              detected automatically and shown separately instead of breaking
              the plot.
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

          {parsed.extraInfo ? (
            <label className="field">
              <span>File metadata / notes</span>
              <div className="field__control field__control--textarea">
                <textarea
                  value={parsed.extraInfo}
                  readOnly
                  spellCheck={false}
                  aria-label="Non-plotted file metadata"
                />
              </div>
            </label>
          ) : null}

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

          <p className="resultCard">{statusMessage}</p>
        </div>
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
