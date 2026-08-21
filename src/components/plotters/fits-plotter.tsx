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
  type ChartOptions,
} from "chart.js";
import { BlobReader, openFits, readImage, type Hdu, type FitsImage } from "@fits-js/core";

import FitsImageViewer from "@/components/plotters/fits-image-viewer";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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

const imageOptions: ChartOptions<"scatter"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
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
      title: { display: true, text: "value" },
      grid: { color: "rgba(91, 102, 117, 0.18)" },
    },
  },
  elements: {
    point: { radius: 1.75, hoverRadius: 3.5 },
    line: { tension: 0 },
  },
};

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

export default function FitsPlotter() {
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
    ...imageOptions,
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
    <div className="visualizerLayout">
      <div className="inputCard fieldStack">
        <div>
          <h2>FITS Upload</h2>
          <p className="lead">
            Upload a <code>.fits</code> or <code>.fit</code> file. Image HDUs are
            previewed directly, and 1D FITS data are rendered as a trace.
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

        <p className="resultCard">
          {isLoading
            ? "Loading FITS file..."
            : error
              ? error
              : summary
                ? `Loaded ${summary.sourceLabel}. BITPIX ${summary.bitpix}, range ${summary.min.toExponential(3)} to ${summary.max.toExponential(3)}.`
                : "Upload a FITS file to preview its first image HDU."}
        </p>

        {summary ? (
          <div className="fitsMetaGrid">
            {summary.headerSummary.map((item) => (
              <div className="fitsMetaCard" key={item.label}>
                <span className="fitsMetaCard__label">{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="sectionCard visualizerChartCard">
        <div>
          <p className="sectionCard__kicker">FITS preview</p>
          <h2>{summary?.kind === "series" ? "FITS Trace" : "FITS Image"}</h2>
          <p>
            {summary?.kind === "series"
              ? "1D FITS data are plotted as a line trace from the decoded image array."
              : "2D FITS image data are shown as a linear grayscale preview."}
          </p>
        </div>
        <div className="visualizerChartSurface">
          {!summary && !error && !isLoading ? (
            <div className="visualizerEmptyState">
              Upload a FITS file to render a preview.
            </div>
          ) : null}
          {summary?.kind === "series" ? (
            <InteractiveScatterChart data={seriesData} options={seriesOptions} sourceLabel={summary.sourceLabel} />
          ) : null}
          {summary?.kind === "image" ? (
            <FitsImageViewer key={summary.sourceLabel} summary={summary} />
          ) : null}
          {error ? <div className="visualizerEmptyState">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
