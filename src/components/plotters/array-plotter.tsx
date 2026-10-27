"use client";

import { useMemo, useState } from "react";

import { arraySeries } from "@/components/plotters/array-input";
import { readCsvTable } from "@/components/plotters/csv-parsing";
import { firstTwoColumns } from "@/components/plotters/csv-series";
import { FileDrop, TABLE_FILE_ACCEPT } from "@/components/plotters/file-drop";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { PlotterShell } from "@/components/plotters/plotter-shell";
import { useCsvFiles } from "@/components/plotters/use-plotter-source";

const defaultX = "[0, 1, 2, 3, 4, 5, 6]";
const defaultY = "[0, 1, 4, 9, 16, 25, 36]";

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
  const chartSeries = useMemo(
    () => (usingCsvMode ? csvDatasets : [{ label: "Input series", points: series.points }]),
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
        <InteractiveScatterChart series={chartSeries} xLabel="x" yLabel="y" legend="boxes" />
        {activeError ? (
          <div className="visualizerEmptyState visualizerOverlayState">
            Invalid data.
          </div>
        ) : null}
      </div>
    </PlotterShell>
  );
}
