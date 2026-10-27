"use client";

import { useMemo } from "react";
import { readCsvTable } from "@/components/plotters/csv-parsing";
import { timeSeries } from "@/components/plotters/csv-series";
import { createDemoTimeSeriesCsv, DEMO_TIME_SERIES_LABEL } from "@/components/plotters/demo-csv";
import { titleFromFileName } from "@/components/plotters/figure-spec";
import { FileDrop, TABLE_FILE_ACCEPT } from "@/components/plotters/file-drop";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { PlotterShell } from "@/components/plotters/plotter-shell";
import { useCsvSource } from "@/components/plotters/use-plotter-source";

const demoCsv = { text: createDemoTimeSeriesCsv(), label: DEMO_TIME_SERIES_LABEL };

export default function CsvPlotter() {
  const source = useCsvSource({ initial: demoCsv, sample: "power15.csv" });
  const table = useMemo(() => readCsvTable(source.text, "columns"), [source.text]);
  const parsed = useMemo(() => timeSeries(table), [table]);

  const statusMessage = source.error
    ? source.error
    : parsed.error
      ? parsed.error
      : `Plotting ${parsed.rowCount} rows from ${source.label}. X-axis: ${parsed.xLabel}. Channels: ${parsed.channelLabels.join(", ")}.${
          parsed.skippedRowCount > 0
            ? ` (${parsed.skippedRowCount} row${parsed.skippedRowCount === 1 ? "" : "s"} skipped.)`
            : ""
        }`;

  return (
    <PlotterShell
      sidebar={
        <>
          <label className="field">
            <span>CSV, TSV or TXT file</span>
            <FileDrop kind="CSV, TSV or TXT file" accept={TABLE_FILE_ACCEPT} onChange={source.upload} />
          </label>

          <label className="field">
            <span>CSV contents</span>
            <div className="field__control field__control--textarea">
              <textarea
                value={source.text}
                onChange={(event) => source.edit(event.target.value)}
                spellCheck={false}
                aria-label="CSV input"
              />
            </div>
          </label>

          {table.extraInfo ? (
            <label className="field">
              <span>Metadata</span>
              <div className="field__control field__control--textarea">
                <textarea
                  value={table.extraInfo}
                  readOnly
                  spellCheck={false}
                  aria-label="Non-plotted file metadata"
                />
              </div>
            </label>
          ) : null}

          <p className="resultCard">{statusMessage}</p>
        </>
      }
    >
      <h2>Plot</h2>
      <div className="visualizerChartSurface">
        <InteractiveScatterChart
          series={parsed.series}
          xLabel={parsed.xLabel}
          yLabel="channels"
          legend="points"
          title={titleFromFileName(source.label)}
          pointSize={1.5}
        />
        {parsed.error ? (
          <div className="visualizerEmptyState visualizerOverlayState">
            Invalid CSV.
          </div>
        ) : null}
      </div>
    </PlotterShell>
  );
}
