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
import { BlobReader, openFits, readImage, type FitsImage, type Hdu } from "@fits-js/core";

import FitsImageViewer from "@/components/plotters/fits-image-viewer";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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

type HeaderAccessor = {
  get: (key: string) => unknown;
};

type ImageSummary = {
  kind: "image";
  bitpix: number;
  frameCount: number;
  headerSummary: Array<{ label: string; value: string }>;
  height: number;
  max: number;
  min: number;
  pixels: Float32Array;
  sourceLabel: string;
  width: number;
  xLabel: string;
  yLabel: string;
};

type SeriesSummary = {
  kind: "series";
  bitpix: number;
  frameCount: number;
  headerSummary: Array<{ label: string; value: string }>;
  max: number;
  min: number;
  points: Array<{ x: number; y: number }>;
  sourceLabel: string;
  xLabel: string;
  yLabel: string;
};

type FitsSummary = ImageSummary | SeriesSummary;

const palette = [
  { border: "#8b1e3f", background: "#8b1e3f" },
  { border: "#1f6f78", background: "#1f6f78" },
  { border: "#d17a22", background: "#d17a22" },
  { border: "#4a6d3b", background: "#4a6d3b" },
  { border: "#5c4b8a", background: "#5c4b8a" },
];

const baseChartOptions: ChartOptions<"scatter"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: { display: false },
    tooltip: { enabled: true },
  },
  elements: {
    point: { radius: 1.75, hoverRadius: 3.5 },
    line: { tension: 0 },
  },
};

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
    const ch3 = -0.005 + 0.0035 * Math.exp(-(index / 90)) * Math.cos(index * 0.16);

    rows.push(`${ch2.toFixed(12)},${ch3.toFixed(12)},${time.toExponential(12)}`);
  }

  return rows.join("\n");
}

const demoCsv = createDemoCsv();

function findTimeColumn(headers: string[]) {
  return headers.findIndex((header) => /(^|[^a-z])time([^a-z]|$)/i.test(header));
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

  const headers = parseCsvRow(lines[0]).map((header, index) => header || `column_${index + 1}`);

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

  const series = channelIndexes.map(({ label }) => ({ label, points: [] as DataPoint[] }));

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

    for (let channelOffset = 0; channelOffset < channelIndexes.length; channelOffset += 1) {
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

function readHeaderNumber(header: HeaderAccessor, key: string) {
  const value = header.get(key);

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "bigint"
      ? Number(value)
      : typeof value === "string" && Number.isFinite(Number(value))
        ? Number(value)
        : null;
}

function readHeaderString(header: HeaderAccessor, key: string) {
  const value = header.get(key);

  return typeof value === "string" && value.trim() ? value : null;
}

function computeRange(values: ArrayLike<number>) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!Number.isFinite(value)) {
      continue;
    }

    if (value < min) {
      min = value;
    }

    if (value > max) {
      max = value;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 };
  }

  return { min, max };
}

function buildAxisLabel(header: HeaderAccessor, fallback: string, axis: number) {
  return readHeaderString(header, `CTYPE${axis}`) ?? fallback;
}

function buildAxisValues(length: number, header: HeaderAccessor) {
  const crval = readHeaderNumber(header, "CRVAL1");
  const cdelt = readHeaderNumber(header, "CDELT1");
  const crpix = readHeaderNumber(header, "CRPIX1") ?? 1;

  return Array.from({ length }, (_, index) => {
    if (crval === null || cdelt === null) {
      return index;
    }

    return crval + (index + 1 - crpix) * cdelt;
  });
}

function buildHeaderSummary(header: HeaderAccessor, shape: readonly number[], bitpix: number) {
  const width = shape[0] ?? 0;
  const height = shape[1] ?? 1;
  const frameCount = shape[2] ?? 1;
  const values = [
    { label: "BITPIX", value: String(bitpix) },
    { label: "Width", value: String(width) },
    { label: "Height", value: String(height) },
    { label: "Frames", value: String(frameCount) },
  ];

  for (const key of ["BUNIT", "OBJECT", "DATE-OBS", "TELESCOP"]) {
    const value = header.get(key);

    if (value === undefined || value === null || value === "") {
      continue;
    }

    values.push({ label: key, value: String(value) });
  }

  return values;
}

function normalizeImageArray(image: FitsImage) {
  return image.data instanceof Float32Array
    ? image.data
    : Float32Array.from(image.data as ArrayLike<number>);
}

function selectImageHdu(hdus: readonly Hdu[]) {
  return hdus.find((hdu) => (hdu.type === "primary" || hdu.type === "image") && hdu.header.get("NAXIS") !== 0);
}

async function parseFitsFile(file: File): Promise<FitsSummary> {
  const reader = new BlobReader(file);
  const { hdus } = await openFits(reader);
  const hdu = selectImageHdu(hdus);

  if (!hdu) {
    throw new Error("This FITS file does not contain an image HDU I can preview.");
  }

  const image = await readImage(hdu, reader);
  const pixels = normalizeImageArray(image);
  const range = computeRange(pixels);
  const bitpix = image.bitpix;
  const shape = image.shape;
  const headerSummary = buildHeaderSummary(hdu.header, shape, bitpix);
  const width = shape[0] ?? pixels.length;
  const height = shape[1] ?? 1;
  const frameCount = shape[2] ?? 1;

  if (height <= 1 || width <= 1) {
    const length = Math.max(width, height);
    const xValues = buildAxisValues(length, hdu.header);
    const xLabel = buildAxisLabel(hdu.header, "pixel", 1);
    const yLabel = readHeaderString(hdu.header, "BUNIT") ?? "intensity";

    return {
      kind: "series",
      bitpix,
      frameCount,
      headerSummary,
      max: range.max,
      min: range.min,
      points: xValues.map((x, index) => ({ x, y: pixels[index] })),
      sourceLabel: file.name,
      xLabel,
      yLabel,
    };
  }

  return {
    kind: "image",
    bitpix,
    frameCount,
    headerSummary,
    height,
    max: range.max,
    min: range.min,
    pixels,
    sourceLabel: file.name,
    width,
    xLabel: buildAxisLabel(hdu.header, "x", 1),
    yLabel: buildAxisLabel(hdu.header, "y", 2),
  };
}

function CsvCompactPanel() {
  const [csvInput, setCsvInput] = useState(demoCsv);
  const [sourceLabel, setSourceLabel] = useState("demo-time-series.csv");
  const parsed = parseTimeSeriesCsv(csvInput);

  const chartData: ChartData<"scatter"> = {
    datasets: parsed.series.map<ChartDataset<"scatter", DataPoint[]>>((channel, index) => {
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
    }),
  };

  const chartOptions: ChartOptions<"scatter"> = {
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      legend: {
        display: true,
        position: "top",
        labels: {
          usePointStyle: true,
          boxWidth: 10,
        },
      },
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

  function loadDemoData() {
    setCsvInput(demoCsv);
    setSourceLabel("demo-time-series.csv");
  }

  return (
    <article className="comparisonPanel sectionCard">
      <div className="comparisonPanel__top fieldStack">
        <div>
          <p className="sectionCard__kicker">CSV</p>
          <h2>CSV Viewer</h2>
          <p>Upload a time-series CSV and plot all non-time columns against time.</p>
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

        <div className="buttonRow comparisonButtonRow">
          <button type="button" className="buttonControl" onClick={loadDemoData}>
            <span className="buttonControl__title">Load demo CSV</span>
            <span className="buttonControl__meta">Multi-channel time trace</span>
          </button>
        </div>

        <p className="resultCard comparisonResultCard">
          {parsed.error
            ? parsed.error
            : `Plotting ${parsed.rowCount} rows from ${sourceLabel}. Channels: ${parsed.channelLabels.join(", ")}.`}
        </p>
      </div>

      <div className="comparisonPanel__viewer visualizerChartSurface">
        <InteractiveScatterChart data={chartData} options={chartOptions} />
        {parsed.error ? (
          <div className="visualizerEmptyState visualizerOverlayState">Fix the CSV input to render the figure.</div>
        ) : null}
      </div>
    </article>
  );
}

function FitsCompactPanel() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<FitsSummary | null>(null);

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextSummary = await parseFitsFile(file);
      setSummary(nextSummary);
    } catch (nextError) {
      setSummary(null);
      setError(nextError instanceof Error ? nextError.message : "Unable to parse this FITS file.");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }

  const seriesData: ChartData<"scatter"> =
    summary?.kind === "series"
      ? {
          datasets: [
            {
              label: summary.sourceLabel,
              data: summary.points,
              showLine: true,
              borderWidth: 2,
              borderColor: "#8b1e3f",
              backgroundColor: "#8b1e3f",
            },
          ],
        }
      : { datasets: [] };

  const seriesOptions: ChartOptions<"scatter"> = {
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      legend: { display: false },
    },
    scales: {
      x: {
        type: "linear",
        title: { display: true, text: summary?.kind === "series" ? summary.xLabel : "x" },
        grid: { color: "rgba(91, 102, 117, 0.18)" },
      },
      y: {
        title: { display: true, text: summary?.kind === "series" ? summary.yLabel : "value" },
        grid: { color: "rgba(91, 102, 117, 0.18)" },
      },
    },
  };

  return (
    <article className="comparisonPanel sectionCard">
      <div className="comparisonPanel__top fieldStack">
        <div>
          <p className="sectionCard__kicker">FITS</p>
          <h2>FITS Viewer</h2>
          <p>Upload a FITS image and preview the first image HDU as a trace or grayscale frame.</p>
        </div>

        <label className="field">
          <span>FITS file</span>
          <input
            className="fileInput"
            type="file"
            accept=".fits,.fit,application/fits"
            onChange={(event) => {
              void handleFileUpload(event);
            }}
          />
        </label>

        <p className="resultCard comparisonResultCard">
          {isLoading
            ? "Loading FITS file..."
            : error
              ? error
              : summary
                ? `Loaded ${summary.sourceLabel}. BITPIX ${summary.bitpix}, range ${summary.min.toExponential(3)} to ${summary.max.toExponential(3)}.`
                : "Upload a FITS file to preview its first image HDU."}
        </p>

        {summary ? (
          <div className="fitsMetaGrid comparisonMetaGrid">
            {summary.headerSummary.map((item) => (
              <div className="fitsMetaCard" key={item.label}>
                <span className="fitsMetaCard__label">{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="comparisonPanel__viewer visualizerChartSurface">
        {!summary && !error && !isLoading ? (
          <div className="visualizerEmptyState">Upload a FITS file to render a preview.</div>
        ) : null}
        {summary?.kind === "series" ? <InteractiveScatterChart data={seriesData} options={seriesOptions} /> : null}
        {summary?.kind === "image" ? <FitsImageViewer summary={summary} /> : null}
        {error ? <div className="visualizerEmptyState">{error}</div> : null}
      </div>
    </article>
  );
}

export default function CsvFitsViewer() {
  return (
    <div className="comparisonLayout">
      <CsvCompactPanel />
      <FitsCompactPanel />
    </div>
  );
}
