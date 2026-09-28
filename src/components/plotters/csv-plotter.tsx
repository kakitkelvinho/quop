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
