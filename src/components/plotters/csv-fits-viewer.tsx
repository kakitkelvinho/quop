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

import { parseTimeSeriesCsv, type DataPoint } from "@/components/plotters/csv-parsing";
import { describeFitsError } from "@/components/plotters/fits-errors";
import { parseFitsFile, type FitsSummary } from "@/components/plotters/fits-file";
import FitsHeaderDisplay from "@/components/plotters/fits-header-display";
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
      setError(describeFitsError(nextError));
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
            {summary.shapeSummary.map((item) => (
              <div className="fitsMetaCard" key={item.label}>
                <span className="fitsMetaCard__label">{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <FitsHeaderDisplay header={summary?.header ?? null}>
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
      </FitsHeaderDisplay>
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
