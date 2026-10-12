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
import { FileDrop } from "@/components/plotters/file-drop";
import { describeFitsError } from "@/components/plotters/fits-errors";
import { parseFitsFile, type FitsSummary } from "@/components/plotters/fits-file";
import FitsHeaderDisplay from "@/components/plotters/fits-header-display";
import FitsImageViewer from "@/components/plotters/fits-image-viewer";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import SidebarCollapseToggle from "@/components/sidebar-collapse-toggle";

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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

export default function FitsPlotter() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<FitsSummary | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
          <h2>Data</h2>

          <label className="field">
            <span>FITS file</span>
            <FileDrop
              kind="FITS file"
              accept=".fits,.fit,application/fits"
              onChange={(event) => {
                void handleFileUpload(event);
              }}
            />
          </label>

          <p className="resultCard">
            {isLoading
              ? "Loading…"
              : error
                ? error
                : summary
                  ? `Range ${summary.min.toExponential(3)} to ${summary.max.toExponential(3)}`
                  : "No file."}
          </p>

          {summary ? (
            <div className="fitsMetaGrid">
              {summary.shapeSummary.map((item) => (
                <div className="fitsMetaCard" key={item.label}>
                  <span className="fitsMetaCard__label">{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="sectionCard visualizerChartCard">
        <div>
          <h2>{summary?.kind === "series" ? "Trace" : "Image"}</h2>
        </div>
        <FitsHeaderDisplay header={summary?.header ?? null}>
          <div className="visualizerChartSurface">
            {!summary && !error && !isLoading ? (
              <div className="visualizerEmptyState">
                No file.
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
        </FitsHeaderDisplay>
      </div>
    </div>
  );
}
