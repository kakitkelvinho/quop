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

export default function GenericCsvPlotter() {
  const [csvInput, setCsvInput] = useState(createGenericDemoCsv);
  const [sourceLabel, setSourceLabel] = useState("demo-generic-columns.csv");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // undefined: the parser picks (columns, unless the file is a wide export)
  const [layout, setLayout] = useState<CsvLayout | undefined>(undefined);
  const parsed = useMemo(() => parseGenericCsv(csvInput, layout), [csvInput, layout]);
  const [xColumnIndex, setXColumnIndex] = useState(0);
  const [ySelection, setYSelection] = useState<YSelection>(null);

  const resolvedXColumnIndex =
    parsed.headers.length < 2 || xColumnIndex === ROW_NUMBER
      ? ROW_NUMBER
      : Math.min(xColumnIndex, parsed.headers.length - 1);
  const yCandidateIndexes = useMemo(
    () => yCandidates(parsed.headers.length, resolvedXColumnIndex),
    [parsed.headers.length, resolvedXColumnIndex],
  );
  const resolvedYColumnIndexes = useMemo(
    () => resolveY(ySelection, yCandidateIndexes),
    [ySelection, yCandidateIndexes],
  );

  const xLabel =
    resolvedXColumnIndex === ROW_NUMBER
      ? "row number"
      : (parsed.headers[resolvedXColumnIndex] ?? "x");

  const chartData: ChartData<"scatter"> = {
    datasets: resolvedYColumnIndexes.map<ChartDataset<"scatter", DataPoint[]>>((columnIndex) => {
      return {
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
        title: { display: true, text: xLabel },
        grid: { color: "rgba(91, 102, 117, 0.18)" },
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

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const nextCsv = await file.text();
    setCsvInput(nextCsv);
    setSourceLabel(file.name);
    setLayout(undefined);
    setXColumnIndex(0);
    setYSelection(null);
    event.target.value = "";
  }

  // the columns mean something else once the table is turned
  function handleLayoutChange(nextLayout: CsvLayout) {
    setLayout(nextLayout);
    setXColumnIndex(0);
    setYSelection(null);
  }

  function handleXColumnChange(nextIndex: number) {
    setXColumnIndex(nextIndex);
    setYSelection((current) => swapX(current, resolvedXColumnIndex, nextIndex));
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
