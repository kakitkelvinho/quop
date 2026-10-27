"use client";

import { useMemo, useState } from "react";
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
import { firstTwoColumns } from "@/components/plotters/csv-series";
import { FileDrop, TABLE_FILE_ACCEPT } from "@/components/plotters/file-drop";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { PlotterShell } from "@/components/plotters/plotter-shell";
import { useCsvFiles } from "@/components/plotters/use-plotter-source";

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
  const [xInput, setXInput] = useState(defaultX);
  const [yInput, setYInput] = useState(defaultY);
  const csv = useCsvFiles();

  const series = useMemo(() => arraySeries(xInput, yInput), [xInput, yInput]);

  // the uploaded files, read; the first that can't be plotted stops them all
  const csvResult = useMemo(() => {
    const results = csv.files.map((file) =>
      firstTwoColumns(readCsvTable(file.text, "columns"), file.label),
    );
    const firstError = results.find((result) => result.error);

    if (firstError) {
      return { datasets: [], skippedRowCount: 0, error: firstError.error };
    }

    return {
      datasets: results.flatMap((result) => result.datasets),
      skippedRowCount: results.reduce((total, result) => total + result.skippedRowCount, 0),
      error: csv.error,
    };
  }, [csv.files, csv.error]);

  const csvDatasets = csvResult.datasets;
  const csvError = csvResult.error;
  const usingCsvMode = csvDatasets.length > 0;

  // rebuilt only when the data changes: folding the sidebar must not make
  // the chart look through every point again
  const chartData = useMemo<ChartData<"scatter">>(
    () => ({
      datasets: usingCsvMode
        ? csvDatasets.map<ChartDataset<"scatter", DataPoint[]>>((dataset) => ({
            label: dataset.label,
            data: dataset.points,
            showLine: true,
            borderWidth: 2,
          }))
        : [
            {
              label: "Input series",
              data: series.points,
              showLine: true,
              borderWidth: 2,
            },
          ],
    }),
    [usingCsvMode, csvDatasets, series.points],
  );

  const fileCount = csv.files.length;
  const statusMessage = usingCsvMode
    ? `${fileCount} file${fileCount === 1 ? "" : "s"}.${
        csvResult.skippedRowCount > 0 ? ` ${csvResult.skippedRowCount} skipped.` : ""
      }`
    : series.error
      ? series.error
      : `${series.points.length} points.`;

  const activeError = usingCsvMode ? csvError : series.error;

  return (
    <PlotterShell
      sidebar={
        <>
          <label className="field">
            <span>CSV, TSV or TXT files</span>
            <FileDrop
              kind="CSV, TSV or TXT file"
              accept={TABLE_FILE_ACCEPT}
              multiple
              onChange={csv.upload}
            />
          </label>

          {usingCsvMode ? (
            <button
              type="button"
              className="buttonLink"
              onClick={csv.clear}
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
        </>
      }
    >
      <h2>Plot</h2>
      <div className="visualizerChartSurface">
        <InteractiveScatterChart data={chartData} options={chartOptions} />
        {activeError ? (
          <div className="visualizerEmptyState visualizerOverlayState">
            Invalid data.
          </div>
        ) : null}
      </div>
    </PlotterShell>
  );
}
