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

import {
  clockTicks,
  formatClock,
  formatClockPoint,
  hasSeconds,
} from "@/components/plotters/clock-axis";
import {
  readCsvTable,
  type CsvLayout,
  type DataPoint,
} from "@/components/plotters/csv-parsing";
import { resolveX, xLabel as axisLabel, xySeries } from "@/components/plotters/csv-series";
import { createGenericDemoCsv, DEMO_GENERIC_LABEL } from "@/components/plotters/demo-csv";
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

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

// past this many points or series the chart is drawn without animating
// them in: setting up the animations alone takes seconds
const LARGE_PLOT_POINTS = 20000;
const LARGE_PLOT_SERIES = 50;

// a clock axis's tick, with seconds when the ticks are less than a minute apart
function formatClockTick(value: number, ticks: { value: number }[]) {
  return formatClock(value, ticks.length > 1 && ticks[1].value - ticks[0].value < 60);
}

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
  const chartData = useMemo<ChartData<"scatter">>(
    () => ({
      datasets: xySeries(parsed, resolvedXColumnIndex, resolvedYColumnIndexes).map<
        ChartDataset<"scatter", DataPoint[]>
      >(({ label, points }) => ({
        label,
        data: points,
        showLine: true,
        borderWidth: 2,
        pointRadius: 1.5,
        pointHoverRadius: 3,
      })),
    }),
    [parsed, resolvedXColumnIndex, resolvedYColumnIndexes],
  );

  const pointCount = chartData.datasets.reduce((sum, dataset) => sum + dataset.data.length, 0);
  const isLargePlot =
    pointCount > LARGE_PLOT_POINTS || chartData.datasets.length > LARGE_PLOT_SERIES;

  const chartOptions = useMemo<ChartOptions<"scatter">>(() => {
    // the tooltip shows seconds when the readings are finer than a minute
    const clockSeconds =
      isClockX && hasSeconds(parsed.rows.map((row) => row[resolvedXColumnIndex]));

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: isLargePlot ? false : undefined,
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
        tooltip: isClockX
          ? {
              enabled: true,
              callbacks: {
                label: (context) =>
                  formatClockPoint(
                    context.dataset.label,
                    context.parsed.x,
                    context.parsed.y,
                    clockSeconds,
                  ),
              },
            }
          : { enabled: true },
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: xLabel },
          grid: { color: "rgba(91, 102, 117, 0.18)" },
          // a clock axis ticks on whole minutes, hours, ...
          ...(isClockX
            ? {
                afterBuildTicks: (axis) => {
                  axis.ticks = clockTicks(axis.min, axis.max).map((value) => ({ value }));
                },
              }
            : {}),
        },
        y: {
          title: { display: true, text: "selected columns" },
          grid: { color: "rgba(91, 102, 117, 0.18)" },
        },
      },
      elements: {
        point: { radius: 1.5, hoverRadius: 3 },
        line: { tension: 0 },
      },
    };
  }, [isClockX, isLargePlot, parsed.rows, resolvedXColumnIndex, xLabel]);

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
            formatXTick={isClockX ? formatClockTick : undefined}
            data={chartData}
            options={chartOptions}
            sourceLabel={source.label}
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
