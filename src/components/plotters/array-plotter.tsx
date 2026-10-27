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

import { arraySeries } from "@/components/plotters/array-input";
import { readCsvTable, type DataPoint } from "@/components/plotters/csv-parsing";
import { firstTwoColumns, type Series } from "@/components/plotters/csv-series";
import { FileDrop, TABLE_FILE_ACCEPT } from "@/components/plotters/file-drop";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { SidebarFold } from "@/components/sidebar-fold";

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const defaultX = "[0, 1, 2, 3, 4, 5, 6]";
const defaultY = "[0, 1, 4, 9, 16, 25, 36]";

const chartOptions: ChartOptions<"scatter"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: "top" },
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
      title: { display: true, text: "y" },
      grid: { color: "rgba(91, 102, 117, 0.18)" },
    },
  },
  elements: {
    point: { radius: 3, hoverRadius: 5 },
    line: { tension: 0 },
  },
};

export default function ArrayPlotter() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [xInput, setXInput] = useState(defaultX);
  const [yInput, setYInput] = useState(defaultY);
  const [csvDatasets, setCsvDatasets] = useState<Series[]>([]);
  const [csvStatus, setCsvStatus] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  const series = arraySeries(xInput, yInput);
  const usingCsvMode = csvDatasets.length > 0;

  const chartData: ChartData<"scatter"> = {
    datasets: usingCsvMode
      ? csvDatasets.map<ChartDataset<"scatter", DataPoint[]>>((dataset) => {
          return {
            label: dataset.label,
            data: dataset.points,
            showLine: true,
            borderWidth: 2,
          };
        })
      : [
          {
            label: "Input series",
            data: series.points,
            showLine: true,
            borderWidth: 2,
          },
        ],
  };

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    const results = await Promise.all(
      files.map(async (file) =>
        firstTwoColumns(readCsvTable(await file.text(), "columns"), file.name),
      ),
    );
    const firstError = results.find((result) => result.error);

    if (firstError) {
      setCsvDatasets([]);
      setCsvStatus(null);
      setCsvError(firstError.error);
      event.target.value = "";
      return;
    }

    const datasets = results.flatMap((result) => result.datasets);
    setCsvDatasets(datasets);
    const skippedRowCount = results.reduce(
      (total, result) => total + result.skippedRowCount,
      0,
    );
    setCsvStatus(
      `${files.length} file${files.length === 1 ? "" : "s"}.${
        skippedRowCount > 0
          ? ` ${skippedRowCount} skipped.`
          : ""
      }`,
    );
    setCsvError(null);
    event.target.value = "";
  }

  function handleClearCsv() {
    setCsvDatasets([]);
    setCsvStatus(null);
    setCsvError(null);
  }

  const statusMessage = usingCsvMode
    ? csvStatus ?? `${csvDatasets.length} dataset${csvDatasets.length === 1 ? "" : "s"}.`
    : series.error
      ? series.error
      : `${series.points.length} points.`;

  const activeError = usingCsvMode ? csvError : series.error;

  return (
    <div
      className={`visualizerLayout${sidebarCollapsed ? " visualizerLayout--sidebarCollapsed" : ""}`}
    >
      <div className="visualizerSidebar">
        <SidebarFold
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
        />
        <div className="inputCard fieldStack">
          <h2>Data</h2>

          <label className="field">
            <span>CSV, TSV or TXT files</span>
            <FileDrop
              kind="CSV, TSV or TXT file"
              accept={TABLE_FILE_ACCEPT}
              multiple
              onChange={(event) => {
                void handleCsvUpload(event);
              }}
            />
          </label>

          {usingCsvMode ? (
            <button
              type="button"
              className="buttonLink"
              onClick={handleClearCsv}
            >
              Clear CSVs
            </button>
          ) : null}

          <label className="field">
            <span>x values</span>
            <div className="field__control field__control--textarea">
              <textarea
                value={xInput}
                onChange={(event) => setXInput(event.target.value)}
                spellCheck={false}
                aria-label="x array input"
              />
            </div>
          </label>

          <label className="field">
            <span>y values</span>
            <div className="field__control field__control--textarea">
              <textarea
                value={yInput}
                onChange={(event) => setYInput(event.target.value)}
                spellCheck={false}
                aria-label="y array input"
              />
            </div>
          </label>

          <p className="resultCard">{csvError ?? statusMessage}</p>
        </div>
      </div>

      <div className="sectionCard visualizerChartCard">
        <h2>Plot</h2>
        <div className="visualizerChartSurface">
          <InteractiveScatterChart data={chartData} options={chartOptions} />
          {activeError ? (
            <div className="visualizerEmptyState visualizerOverlayState">
              Invalid data.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
