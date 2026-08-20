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
  series: ChannelSeries[];
  xLabel: string;
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

function findTimeColumn(headers: string[]) {
  return headers.findIndex((header) =>
    /(^|[^a-z])time([^a-z]|$)/i.test(header),
  );
}

function parseTimeSeriesCsv(csv: string): ParsedCsv {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      channelLabels: [],
      error: "Provide a header row and at least one data row.",
      rowCount: 0,
      series: [],
      xLabel: "time",
    };
  }

  const headers = parseCsvRow(lines[0]).map(
    (header, index) => header || `column_${index + 1}`,
  );

  if (headers.length < 2) {
    return {
      channelLabels: [],
      error: "CSV input must contain at least two columns including time.",
      rowCount: 0,
      series: [],
      xLabel: "time",
    };
  }

  const timeIndex = findTimeColumn(headers);

  if (timeIndex === -1) {
    return {
      channelLabels: [],
      error: "CSV input must include a column named time.",
      rowCount: 0,
      series: [],
      xLabel: "time",
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
      series: [],
      xLabel: headers[timeIndex],
    };
  }

  const series = channelIndexes.map(({ label }) => ({
    label,
    points: [] as DataPoint[],
  }));

  for (let index = 1; index < lines.length; index += 1) {
    const columns = parseCsvRow(lines[index]);

    if (columns.length !== headers.length) {
      return {
        channelLabels: channelIndexes.map(({ label }) => label),
        error: `Row ${index + 1} does not contain ${headers.length} columns.`,
        rowCount: index - 1,
        series: [],
        xLabel: headers[timeIndex],
      };
    }

    const timeValue = Number(columns[timeIndex]);

    if (!Number.isFinite(timeValue)) {
      return {
        channelLabels: channelIndexes.map(({ label }) => label),
        error: `Row ${index + 1} has an invalid time value.`,
        rowCount: index - 1,
        series: [],
        xLabel: headers[timeIndex],
      };
    }

    for (
      let channelOffset = 0;
      channelOffset < channelIndexes.length;
      channelOffset += 1
    ) {
      const channelIndex = channelIndexes[channelOffset].index;
      const yValue = Number(columns[channelIndex]);

      if (!Number.isFinite(yValue)) {
        return {
          channelLabels: channelIndexes.map(({ label }) => label),
          error: `Row ${index + 1} has an invalid value in ${headers[channelIndex]}.`,
          rowCount: index - 1,
          series: [],
          xLabel: headers[timeIndex],
        };
      }

      series[channelOffset].points.push({ x: timeValue, y: yValue });
    }
  }

  return {
    channelLabels: channelIndexes.map(({ label }) => label),
    error: null,
    rowCount: lines.length - 1,
    series,
    xLabel: headers[timeIndex],
  };
}

export default function CsvPlotter() {
  const [csvInput, setCsvInput] = useState(demoCsv);
  const [sourceLabel, setSourceLabel] = useState("demo-time-series.csv");

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultCsv() {
      try {
        const response = await fetch("/data/power15.csv");

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
    datasets: parsed.series.map<ChartDataset<"scatter", DataPoint[]>>(
      (channel, index) => {
        const color = palette[index % palette.length];

        return {
          label: channel.label,
          data: channel.points,
          showLine: true,
          borderWidth: 2,
          borderColor: color.border,
          backgroundColor: color.background,
          pointRadius: 1.5,
          pointHoverRadius: 3,
        };
      },
    ),
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

  return (
    <div className="visualizerLayout">
      <div className="inputCard fieldStack">
        <div>
          <h2>Time-Series CSV</h2>
          <p className="lead">
            Upload a CSV that includes a <code>time</code> column and one or
            more channel columns. Time always stays on the x-axis, and each
            other header becomes its own y-series in the legend.
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

        <p className="resultCard">
          {parsed.error
            ? parsed.error
            : `Plotting ${parsed.rowCount} rows from ${sourceLabel}. X-axis: ${parsed.xLabel}. Channels: ${parsed.channelLabels.join(", ")}.`}
        </p>
      </div>

      <div className="sectionCard visualizerChartCard">
        <div>
          <p className="sectionCard__kicker">Time-series trace</p>
          <h2>CSV Plot</h2>
          <p>
            Any non-time header is plotted as its own series against time, even
            if the time column appears last in the file.
          </p>
        </div>
        <div className="visualizerChartSurface">
          <InteractiveScatterChart data={chartData} options={chartOptions} />
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
