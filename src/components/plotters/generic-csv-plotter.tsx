"use client";

import { useMemo, useState } from "react";
import { hasSeconds } from "@/components/plotters/clock-axis";
import { readCsvTable, type CsvLayout } from "@/components/plotters/csv-parsing";
import { resolveX, xLabel as axisLabel, xySeries } from "@/components/plotters/csv-series";
import { createGenericDemoCsv, DEMO_GENERIC_LABEL } from "@/components/plotters/demo-csv";
import { titleFromFileName, type XFormat } from "@/components/plotters/figure-spec";
import { FileDrop, TABLE_FILE_ACCEPT } from "@/components/plotters/file-drop";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { PlotterShell } from "@/components/plotters/plotter-shell";
import { useCsvSource } from "@/components/plotters/use-plotter-source";
import { XYPicker } from "@/components/plotters/xy-picker";
import {
  resolveY,
  swapX,
  yCandidates,
  type YSelection,
} from "@/components/plotters/xy-selection";

// past this many points or series the chart is drawn without animating
// them in: setting up the animations alone takes seconds
const LARGE_PLOT_POINTS = 20000;
const LARGE_PLOT_SERIES = 50;

const demoCsv = { text: createGenericDemoCsv(), label: DEMO_GENERIC_LABEL };

export default function GenericCsvPlotter() {
  const source = useCsvSource({ initial: demoCsv });
  // undefined: the parser picks (columns, unless the file is a wide export)
  const [layout, setLayout] = useState<CsvLayout | undefined>(undefined);
  const parsed = useMemo(() => readCsvTable(source.text, layout), [source.text, layout]);
  // null: the file's clock column if it has one, else its first column
  const [xColumnIndex, setXColumnIndex] = useState<number | null>(null);
  const [ySelection, setYSelection] = useState<YSelection>(null);

  // A new file starts over: the parser picks Series in again, and X and Y
  // go back to their defaults. Typing in the CSV keeps them (fileId only
  // changes when a file is loaded).
  const [shownFileId, setShownFileId] = useState(source.fileId);
  if (shownFileId !== source.fileId) {
    setShownFileId(source.fileId);
    setLayout(undefined);
    setXColumnIndex(null);
    setYSelection(null);
  }

  const resolvedXColumnIndex = resolveX(parsed, xColumnIndex);
  const yCandidateIndexes = useMemo(
    () => yCandidates(parsed.headers.length, resolvedXColumnIndex, parsed.clockColumns),
    [parsed.headers.length, parsed.clockColumns, resolvedXColumnIndex],
  );
  const resolvedYColumnIndexes = useMemo(
    () => resolveY(ySelection, yCandidateIndexes),
    [ySelection, yCandidateIndexes],
  );

  const xLabel = axisLabel(parsed, resolvedXColumnIndex);
  const isClockX = parsed.clockColumns.includes(resolvedXColumnIndex);

  // rebuilt only when the table or the X / Y choice changes: folding the
  // sidebar or typing elsewhere must not redraw thousands of points
  const chartSeries = useMemo(
    () => xySeries(parsed, resolvedXColumnIndex, resolvedYColumnIndexes),
    [parsed, resolvedXColumnIndex, resolvedYColumnIndexes],
  );

  const pointCount = chartSeries.reduce((sum, { points }) => sum + points.length, 0);
  const isLargePlot = pointCount > LARGE_PLOT_POINTS || chartSeries.length > LARGE_PLOT_SERIES;

  // the tooltip shows seconds when the readings are finer than a minute
  const xFormat = useMemo<XFormat | undefined>(
    () =>
      isClockX
        ? { kind: "clock", seconds: hasSeconds(parsed.rows.map((row) => row[resolvedXColumnIndex])) }
        : undefined,
    [isClockX, parsed.rows, resolvedXColumnIndex],
  );

  // the columns mean something else once the table is turned
  function handleLayoutChange(nextLayout: CsvLayout) {
    setLayout(nextLayout);
    setXColumnIndex(null);
    setYSelection(null);
  }

  function handleXColumnChange(nextIndex: number) {
    setXColumnIndex(nextIndex);
    setYSelection((current) =>
      swapX(current, resolvedXColumnIndex, nextIndex, parsed.clockColumns),
    );
  }

  const canRenderChart = !parsed.error && resolvedYColumnIndexes.length > 0 && parsed.rows.length > 0;

  const statusMessage = source.error
    ? source.error
    : parsed.error
      ? parsed.error
      : resolvedYColumnIndexes.length === 0
        ? "Pick a y column."
        : `${parsed.rowCount} rows.${parsed.skippedRowCount > 0 ? ` ${parsed.skippedRowCount} skipped.` : ""}`;

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

          {parsed.extraInfo ? (
            <label className="field">
              <span>Metadata</span>
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

          <div className="csvRoleChooser">
            <div className="csvRoleChooser__header">
              <p className="sectionCard__kicker">Series in</p>
            </div>
            <div className="csvRoleRow" role="radiogroup" aria-label="Series in">
              <span className="csvRoleRow__name">
                {parsed.layout === "columns" ? "Each column is a series" : "Each row is a series"}
              </span>
              {(["columns", "rows"] as const).map((option) => (
                <label className="csvRoleToggle" key={option}>
                  <input
                    checked={parsed.layout === option}
                    name="generic-csv-layout"
                    onChange={() => handleLayoutChange(option)}
                    type="radio"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          {parsed.headers.length ? (
            <div className="csvRoleChooser">
              <div className="csvRoleChooser__header">
                <p className="sectionCard__kicker">
                  {parsed.layout === "columns" ? "Columns" : "Series"}
                </p>
              </div>
              <XYPicker
                // a new file or a turned table starts with an empty filter;
                // typing in the CSV keeps it
                key={`${source.fileId}-${parsed.layout}`}
                candidates={yCandidateIndexes}
                headers={parsed.headers}
                noun={parsed.layout === "columns" ? "columns" : "series"}
                onX={handleXColumnChange}
                onY={setYSelection}
                plotted={resolvedYColumnIndexes}
                x={resolvedXColumnIndex}
              />
            </div>
          ) : null}

          <p className="resultCard">{statusMessage}</p>
        </>
      }
    >
      <h2>Plot</h2>
      <div className="visualizerChartSurface">
        {canRenderChart ? (
          <InteractiveScatterChart
            series={chartSeries}
            xLabel={xLabel}
            yLabel="selected columns"
            legend="points"
            title={titleFromFileName(source.label)}
            xFormat={xFormat}
            pointSize={1.5}
            animate={!isLargePlot}
          />
        ) : null}
        {!canRenderChart ? (
          <div className="visualizerEmptyState visualizerOverlayState">
            {parsed.error
              ? "Invalid CSV."
              : "Pick x and y columns."}
          </div>
        ) : null}
      </div>
    </PlotterShell>
  );
}
