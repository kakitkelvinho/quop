"use client";

import { useMemo, useState, type ChangeEvent } from "react";
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

import { clockTicks, formatClock, hasSeconds } from "@/components/plotters/clock-axis";
import {
  parseGenericCsv,
  type CsvLayout,
  type DataPoint,
} from "@/components/plotters/csv-parsing";
import { FileDrop, TABLE_FILE_ACCEPT } from "@/components/plotters/file-drop";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { XYPicker } from "@/components/plotters/xy-picker";
import {
  ROW_NUMBER,
  resolveY,
  swapX,
  yCandidates,
  type YSelection,
} from "@/components/plotters/xy-selection";
import { SidebarFold } from "@/components/sidebar-fold";

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

function createGenericDemoCsv() {
  const rows = ["position,signal_a,signal_b,signal_c"];

  for (let index = 0; index < 240; index += 1) {
    const x = index * 0.5;
    const signalA = 2 + Math.sin(index * 0.09) * 0.8;
    const signalB = 1.2 + Math.cos(index * 0.06 + 0.8) * 0.5;
    const signalC = 0.4 + Math.sin(index * 0.03) * Math.cos(index * 0.11) * 0.6;

    rows.push(
      `${x.toFixed(4)},${signalA.toFixed(6)},${signalB.toFixed(6)},${signalC.toFixed(6)}`,
    );
  }

  return rows.join("\n");
}

// past this many points or series the chart is drawn without animating
// them in: setting up the animations alone takes seconds
const LARGE_PLOT_POINTS = 20000;
const LARGE_PLOT_SERIES = 50;

// a clock axis's tick, with seconds when the ticks are less than a minute apart
function formatClockTick(value: number, ticks: { value: number }[]) {
  return formatClock(value, ticks.length > 1 && ticks[1].value - ticks[0].value < 60);
}

export default function GenericCsvPlotter() {
  const [csvInput, setCsvInput] = useState(createGenericDemoCsv);
  const [sourceLabel, setSourceLabel] = useState("demo-generic-columns.csv");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // undefined: the parser picks (columns, unless the file is a wide export)
  const [layout, setLayout] = useState<CsvLayout | undefined>(undefined);
  const parsed = useMemo(() => parseGenericCsv(csvInput, layout), [csvInput, layout]);
  // null: the file's clock column if it has one, else its first column
  const [xColumnIndex, setXColumnIndex] = useState<number | null>(null);
  const [ySelection, setYSelection] = useState<YSelection>(null);

  const chosenXColumnIndex = xColumnIndex ?? parsed.clockColumns[0] ?? 0;
  const resolvedXColumnIndex =
    parsed.headers.length < 2 || chosenXColumnIndex === ROW_NUMBER
      ? ROW_NUMBER
      : Math.min(chosenXColumnIndex, parsed.headers.length - 1);
  const yCandidateIndexes = useMemo(
    () => yCandidates(parsed.headers.length, resolvedXColumnIndex, parsed.clockColumns),
    [parsed.headers.length, parsed.clockColumns, resolvedXColumnIndex],
  );
  const resolvedYColumnIndexes = useMemo(
    () => resolveY(ySelection, yCandidateIndexes),
    [ySelection, yCandidateIndexes],
  );

  const xLabel =
    resolvedXColumnIndex === ROW_NUMBER
      ? "row number"
      : (parsed.headers[resolvedXColumnIndex] ?? "x");
  const isClockX = parsed.clockColumns.includes(resolvedXColumnIndex);

  // rebuilt only when the table or the X / Y choice changes: folding the
  // sidebar or typing elsewhere must not redraw thousands of points
  const chartData = useMemo<ChartData<"scatter">>(
    () => ({
      datasets: resolvedYColumnIndexes.map<ChartDataset<"scatter", DataPoint[]>>(
        (columnIndex) => ({
          label: parsed.headers[columnIndex],
          // a blank cell is a gap in its own series only
          data: parsed.rows
            .map((row, rowIndex) => ({
              x: resolvedXColumnIndex === ROW_NUMBER ? rowIndex + 1 : row[resolvedXColumnIndex],
              y: row[columnIndex],
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
          showLine: true,
          borderWidth: 2,
          pointRadius: 1.5,
          pointHoverRadius: 3,
        }),
      ),
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
                  `${context.dataset.label}: (${formatClock(context.parsed.x ?? Number.NaN, clockSeconds)}, ${context.parsed.y?.toLocaleString()})`,
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

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const nextCsv = await file.text();
    setCsvInput(nextCsv);
    setSourceLabel(file.name);
    setLayout(undefined);
    setXColumnIndex(null);
    setYSelection(null);
    event.target.value = "";
  }

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

  const statusMessage = parsed.error
    ? parsed.error
    : resolvedYColumnIndexes.length === 0
      ? "Pick a y column."
      : `${parsed.rowCount} rows.${parsed.skippedRowCount > 0 ? ` ${parsed.skippedRowCount} skipped.` : ""}`;

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
            <span>CSV, TSV or TXT file</span>
            <FileDrop
              kind="CSV, TSV or TXT file"
              accept={TABLE_FILE_ACCEPT}
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
                // a new table starts with an empty filter
                key={`${sourceLabel}-${parsed.layout}`}
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
        </div>
      </div>

      <div className="sectionCard visualizerChartCard">
        <h2>Plot</h2>
        <div className="visualizerChartSurface">
          {canRenderChart ? (
            <InteractiveScatterChart
              formatXTick={isClockX ? formatClockTick : undefined}
              data={chartData}
              options={chartOptions}
              sourceLabel={sourceLabel}
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
      </div>
    </div>
  );
}
