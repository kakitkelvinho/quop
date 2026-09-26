"use client";

import { useEffect, useState, type ChangeEvent } from "react";
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

type ChannelSeries = {
  label: string;
  points: DataPoint[];
};

type ParsedCsv = {
  channelLabels: string[];
  error: string | null;
  rowCount: number;
  skippedRowCount: number;
  series: ChannelSeries[];
  xLabel: string;
  extraInfo: string;
};

// Instrument exports (Moku, oscilloscopes, spectrometers, ...) often prefix
// metadata lines with a comment marker before the real header/data rows.
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

function createDemoCsv() {
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

const demoCsv = createDemoCsv();

function getBundledAssetPath(filename: string) {
  if (typeof window === "undefined") {
    return `/data/${filename}`;
  }

  const basePath = window.location.pathname.split("/plotters/")[0] ?? "";
  return `${basePath}/data/${filename}`;
}

function findTimeColumn(headers: string[]) {
  return headers.findIndex((header) =>
    /(^|[^a-z])time([^a-z]|$)/i.test(header),
  );
}

function parseTimeSeriesCsv(csv: string): ParsedCsv {
  const rawLines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (rawLines.length < 2) {
    return {
      channelLabels: [],
      error: "Provide a header row and at least one data row.",
      rowCount: 0,
      skippedRowCount: 0,
      series: [],
      xLabel: "time",
      extraInfo: "",
    };
  }

  // Strip any comment marker up front so a commented header row (e.g. a
  // Moku export's "% Time (s), Channel A ...") is treated the same as a
  // plain one, and pre-compute each line's fields once.
  const lines = rawLines.map((line) => {
    const text = stripCommentPrefix(line);
    const fields = text ? parseCsvRow(text) : [];
    return { text, fields, isNumericRow: isFullyNumericRow(fields) };
  });

  const dataStartIndex = lines.findIndex((line) => line.isNumericRow);

  if (dataStartIndex === -1) {
    return {
      channelLabels: [],
      error: "Couldn't find any numeric data rows in this file.",
      rowCount: 0,
      skippedRowCount: 0,
      series: [],
      xLabel: "time",
      extraInfo: rawLines.map((line) => stripCommentPrefix(line)).join("\n"),
    };
  }

  // The header is the nearest line above the first data row whose column
  // count matches the data - everything above that is treated as file
  // metadata/notes rather than something to plot.
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

  if (headerIndex === -1) {
    return {
      channelLabels: [],
      error:
        "Couldn't find a header row above the data with a matching number of columns.",
      rowCount: 0,
      skippedRowCount: 0,
      series: [],
      xLabel: "time",
      extraInfo: leadingInfo.join("\n"),
    };
  }

  const headers = lines[headerIndex].fields.map(
    (header, index) => header || `column_${index + 1}`,
  );

  const timeIndex = findTimeColumn(headers);

  if (timeIndex === -1) {
    return {
      channelLabels: [],
      error: "CSV input must include a column named time.",
      rowCount: 0,
      skippedRowCount: 0,
      series: [],
      xLabel: "time",
      extraInfo: leadingInfo.join("\n"),
    };
  }

  const channelIndexes = headers
    .map((label, index) => ({ index, label }))
    .filter(({ index }) => index !== timeIndex);

  if (channelIndexes.length === 0) {
    return {
      channelLabels: [],
      error: "CSV input must include at least one channel column besides time.",
      rowCount: 0,
      skippedRowCount: 0,
      series: [],
      xLabel: headers[timeIndex],
      extraInfo: leadingInfo.join("\n"),
    };
  }

  const series = channelIndexes.map(({ label }) => ({
    label,
    points: [] as DataPoint[],
  }));

  let skippedRowCount = 0;
  const trailingInfo: string[] = [];

  for (let index = dataStartIndex; index < lines.length; index += 1) {
    const row = lines[index];

    if (row.fields.length !== headers.length) {
      skippedRowCount += 1;
      if (row.text) trailingInfo.push(row.text);
      continue;
    }

    const timeValue = Number(row.fields[timeIndex]);

    if (!Number.isFinite(timeValue)) {
      skippedRowCount += 1;
      continue;
    }

    const rowValues: number[] = [];
    let rowIsValid = true;

    for (const { index: channelIndex } of channelIndexes) {
      const value = Number(row.fields[channelIndex]);

      if (!Number.isFinite(value)) {
        rowIsValid = false;
        break;
      }

      rowValues.push(value);
    }

    if (!rowIsValid) {
      skippedRowCount += 1;
      continue;
    }

    channelIndexes.forEach((_channel, offset) => {
      series[offset].points.push({ x: timeValue, y: rowValues[offset] });
    });
  }

  const rowCount = series[0]?.points.length ?? 0;

  if (rowCount === 0) {
    return {
      channelLabels: channelIndexes.map(({ label }) => label),
      error: "No valid numeric data rows were found under the header row.",
      rowCount: 0,
      skippedRowCount,
      series: [],
      xLabel: headers[timeIndex],
      extraInfo: [...leadingInfo, ...trailingInfo].join("\n"),
    };
  }

  return {
    channelLabels: channelIndexes.map(({ label }) => label),
    error: null,
    rowCount,
    skippedRowCount,
    series,
    xLabel: headers[timeIndex],
    extraInfo: [...leadingInfo, ...trailingInfo].join("\n"),
  };
}

export default function CsvPlotter() {
  const [csvInput, setCsvInput] = useState(demoCsv);
  const [sourceLabel, setSourceLabel] = useState("demo-time-series.csv");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultCsv() {
      try {
        const response = await fetch(getBundledAssetPath("power15.csv"));

        if (!response.ok) {
          throw new Error("Unable to load default CSV.");
        }

        const nextCsv = await response.text();

        if (cancelled) {
          return;
        }

        setCsvInput(nextCsv);
        setSourceLabel("power15.csv");
      } catch {
        if (cancelled) {
          return;
        }

        setCsvInput(demoCsv);
        setSourceLabel("demo-time-series.csv");
      }
    }

    void loadDefaultCsv();

    return () => {
      cancelled = true;
    };
  }, []);

  const parsed = parseTimeSeriesCsv(csvInput);

  const chartData: ChartData<"scatter"> = {
    datasets: parsed.series.map<ChartDataset<"scatter", DataPoint[]>>((channel) => {
      return {
        label: channel.label,
        data: channel.points,
        showLine: true,
        borderWidth: 2,
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
        title: { display: true, text: parsed.xLabel },
        grid: { color: "rgba(91, 102, 117, 0.18)" },
      },
      y: {
        title: { display: true, text: "channels" },
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

  const statusMessage = parsed.error
    ? parsed.error
    : `Plotting ${parsed.rowCount} rows from ${sourceLabel}. X-axis: ${parsed.xLabel}. Channels: ${parsed.channelLabels.join(", ")}.${
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
            <h2>Time-Series CSV</h2>
            <p className="lead">
              Upload a CSV that includes a <code>time</code> column and one or
              more channel columns. Time always stays on the x-axis, and each
              other header becomes its own y-series in the legend. Any
              instrument metadata or comment lines (like a Moku export&apos;s
              leading <code>%</code> block) are detected automatically and
              shown separately instead of breaking the plot.
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

          <p className="resultCard">{statusMessage}</p>
        </div>
      </div>

      <div className="sectionCard visualizerChartCard">
        <div>
          <p className="sectionCard__kicker">Time-series trace</p>
          <h2>Time CSV Plot</h2>
          <p>
            Any non-time header is plotted as its own series against time, even
            if the time column appears last in the file.
          </p>
        </div>
        <div className="visualizerChartSurface">
          <InteractiveScatterChart data={chartData} options={chartOptions} sourceLabel={sourceLabel} />
          {parsed.error ? (
            <div className="visualizerEmptyState visualizerOverlayState">
              Fix the CSV input to render the figure.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
