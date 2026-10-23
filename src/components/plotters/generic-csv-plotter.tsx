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
import { FileDrop } from "@/components/plotters/file-drop";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import {
  PrototypeSamples,
  XYPicker,
  XY_PICKER_VARIANTS,
} from "@/components/plotters/xy-picker.prototype";
import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";
import { SidebarFold } from "@/components/sidebar-fold";

// PROTOTYPE (#282): ?variant=A|B|C swaps the picker, dev builds only
const XY_PICKER_KEYS = XY_PICKER_VARIANTS.map((variant) => variant.key);

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

// the x choice that is no column: a value's place in its column (1, 2, ...)
const ROW_NUMBER = -1;

export default function GenericCsvPlotter() {
  const [csvInput, setCsvInput] = useState(createGenericDemoCsv);
  const [sourceLabel, setSourceLabel] = useState("demo-generic-columns.csv");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // undefined: the parser picks (columns, unless the file is a wide export)
  const [layout, setLayout] = useState<CsvLayout | undefined>(undefined);
  const parsed = useMemo(() => parseGenericCsv(csvInput, layout), [csvInput, layout]);
  const [xColumnIndex, setXColumnIndex] = useState(0);
  // null: not chosen yet, so every column but x is plotted
  const [yColumnIndexes, setYColumnIndexes] = useState<number[] | null>(null);
  const pickerVariant = usePrototypeVariant(XY_PICKER_KEYS);

  const resolvedXColumnIndex =
    parsed.headers.length < 2 || xColumnIndex === ROW_NUMBER
      ? ROW_NUMBER
      : Math.min(xColumnIndex, parsed.headers.length - 1);
  const resolvedYColumnIndexes = useMemo(() => {
    if (!parsed.headers.length) {
      return [];
    }

    if (yColumnIndexes === null) {
      return parsed.headers
        .map((_, index) => index)
        .filter((index) => index !== resolvedXColumnIndex);
    }

    return yColumnIndexes.filter(
      (index) => index < parsed.headers.length && index !== resolvedXColumnIndex,
    );
  }, [parsed.headers, resolvedXColumnIndex, yColumnIndexes]);

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
    event.target.value = "";
  }

  // the columns mean something else once the table is turned
  function handleLayoutChange(nextLayout: CsvLayout) {
    setLayout(nextLayout);
    setXColumnIndex(0);
    setYColumnIndexes(null);
  }

  // the old x becomes a y, as it was before it was x
  function handleXColumnChange(nextIndex: number) {
    setXColumnIndex(nextIndex);
    setYColumnIndexes((current) => {
      if (current === null) return null;
      const next = current.filter((index) => index !== nextIndex);
      if (resolvedXColumnIndex !== ROW_NUMBER && !next.includes(resolvedXColumnIndex)) {
        next.push(resolvedXColumnIndex);
      }
      return next.sort((a, b) => a - b);
    });
  }

  function handleYColumnToggle(columnIndex: number, checked: boolean) {
    setYColumnIndexes((stored) => {
      const current = stored ?? resolvedYColumnIndexes;
      if (checked) {
        return current.includes(columnIndex) ? current : [...current, columnIndex].sort((a, b) => a - b);
      }

      return current.filter((index) => index !== columnIndex);
    });
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
            <span>CSV file</span>
            <FileDrop
              kind="CSV file"
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

          {pickerVariant ? (
            <PrototypeSamples
              onPick={(csv, file) => {
                setCsvInput(csv);
                setSourceLabel(file);
                setLayout(undefined);
                setXColumnIndex(0);
                setYColumnIndexes(null);
              }}
            />
          ) : null}

          {pickerVariant && parsed.headers.length ? (
            <div className="csvRoleChooser">
              <div className="csvRoleChooser__header">
                <p className="sectionCard__kicker">
                  {parsed.layout === "columns" ? "Columns" : "Series"}
                </p>
              </div>
              <XYPicker
                headers={parsed.headers}
                layout={parsed.layout}
                onX={handleXColumnChange}
                onYSet={setYColumnIndexes}
                onYToggle={handleYColumnToggle}
                variant={pickerVariant}
                xIndex={resolvedXColumnIndex}
                yIndexes={resolvedYColumnIndexes}
              />
            </div>
          ) : parsed.headers.length ? (
            <div className="csvRoleChooser">
              <div className="csvRoleChooser__header">
                <p className="sectionCard__kicker">
                  {parsed.layout === "columns" ? "Columns" : "Series"}
                </p>
              </div>
              {/* plots each value against its place in the column, as a
                  spreadsheet does when it is given only y */}
              <div className="csvRoleRow">
                <span className="csvRoleRow__name">Row number</span>
                <label className="csvRoleToggle">
                  <input
                    checked={resolvedXColumnIndex === ROW_NUMBER}
                    name="generic-csv-x-column"
                    onChange={() => handleXColumnChange(ROW_NUMBER)}
                    type="radio"
                  />
                  <span>X</span>
                </label>
                <span aria-hidden="true" />
              </div>
              {parsed.headers.map((header, index) => {
                const isX = index === resolvedXColumnIndex;
                const isY = resolvedYColumnIndexes.includes(index);

                return (
                  <div className="csvRoleRow" key={`${header}-${index}`}>
                    <span className="csvRoleRow__name">{header}</span>
                    <label className="csvRoleToggle">
                      <input
                        checked={index === resolvedXColumnIndex}
                        name="generic-csv-x-column"
                        onChange={() => handleXColumnChange(index)}
                        type="radio"
                      />
                      <span>X</span>
                    </label>
                    <label className="csvRoleToggle">
                      <input
                        checked={isY}
                        disabled={isX}
                        onChange={(event) =>
                          handleYColumnToggle(index, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>Y</span>
                    </label>
                  </div>
                );
              })}
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
      {pickerVariant ? (
        <PrototypeSwitcher current={pickerVariant} variants={XY_PICKER_VARIANTS} />
      ) : null}
    </div>
  );
}
