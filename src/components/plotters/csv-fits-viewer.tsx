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
import {
  BlobReader,
  openFits,
  readImage,
  type FitsImage,
  type Hdu,
} from "@fits-js/core";

import { parseTimeSeriesCsv, type DataPoint } from "@/components/plotters/csv-parsing";
import FitsImageViewer from "@/components/plotters/fits-image-viewer";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

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

function getBundledAssetPath(filename: string) {
  if (typeof window === "undefined") {
    return `/data/${filename}`;
  }

  const basePath = window.location.pathname.split("/plotters/")[0] ?? "";
  return `${basePath}/data/${filename}`;
}

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

function buildAxisLabel(
  header: HeaderAccessor,
  fallback: string,
  axis: number,
) {
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

function buildHeaderSummary(
  header: HeaderAccessor,
  shape: readonly number[],
  bitpix: number,
) {
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
  return hdus.find(
    (hdu) =>
      (hdu.type === "primary" || hdu.type === "image") &&
      hdu.header.get("NAXIS") !== 0,
  );
}

async function parseFitsFile(file: File): Promise<FitsSummary> {
  const reader = new BlobReader(file);
  const { hdus } = await openFits(reader);
  const hdu = selectImageHdu(hdus);

  if (!hdu) {
    throw new Error(
      "This FITS file does not contain an image HDU I can preview.",
    );
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
    datasets: parsed.series.map<ChartDataset<"scatter", DataPoint[]>>(
      (channel) => {
        return {
          label: channel.label,
          data: channel.points,
          showLine: true,
          borderWidth: 2,
          pointRadius: 1.5,
          pointHoverRadius: 3,
        };
      },
    ),
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

  return (
    <article className="comparisonPanel sectionCard">
      <div className="comparisonPanel__top fieldStack">
        <div>
          <p className="sectionCard__kicker">CSV</p>
          <h2>CSV Viewer</h2>
          <p>
            Upload a time-series CSV and plot all non-time columns against time.
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

        <p className="resultCard comparisonResultCard">
          {parsed.error
            ? parsed.error
            : `Plotting ${parsed.rowCount} rows from ${sourceLabel}. Channels: ${parsed.channelLabels.join(", ")}.${
                parsed.skippedRowCount > 0
                  ? ` (${parsed.skippedRowCount} row${parsed.skippedRowCount === 1 ? "" : "s"} skipped.)`
                  : ""
              }`}
        </p>
      </div>

      <div className="comparisonPanel__viewer visualizerChartSurface">
        <InteractiveScatterChart data={chartData} options={chartOptions} sourceLabel={sourceLabel} />
        {parsed.error ? (
          <div className="visualizerEmptyState visualizerOverlayState">
            Fix the CSV input to render the figure.
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FitsCompactPanel() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<FitsSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultFits() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(getBundledAssetPath("bec15.fits"));

        if (!response.ok) {
          throw new Error("Unable to load default FITS file.");
        }

        const buffer = await response.arrayBuffer();
        const file = new File([buffer], "bec15.fits", {
          type: "application/fits",
        });
        const nextSummary = await parseFitsFile(file);

        if (cancelled) {
          return;
        }

        setSummary(nextSummary);
      } catch {
        if (cancelled) {
          return;
        }

        setSummary(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDefaultFits();

    return () => {
      cancelled = true;
    };
  }, []);

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
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to parse this FITS file.",
      );
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
        title: {
          display: true,
          text: summary?.kind === "series" ? summary.xLabel : "x",
        },
        grid: { color: "rgba(91, 102, 117, 0.18)" },
      },
      y: {
        title: {
          display: true,
          text: summary?.kind === "series" ? summary.yLabel : "value",
        },
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
          <p>
            Upload a FITS image and preview the first image HDU as a trace, a
            colormapped frame or a 3D Surface view.
          </p>
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
          <div className="visualizerEmptyState">
            Upload a FITS file to render a preview.
          </div>
        ) : null}
        {summary?.kind === "series" ? (
          <InteractiveScatterChart data={seriesData} options={seriesOptions} sourceLabel={summary.sourceLabel} />
        ) : null}
        {summary?.kind === "image" ? (
          <FitsImageViewer summary={summary} />
        ) : null}
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
