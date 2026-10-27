"use client";

import { useMemo } from "react";
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

import { readCsvTable, type DataPoint } from "@/components/plotters/csv-parsing";
import { timeSeries } from "@/components/plotters/csv-series";
import { createDemoTimeSeriesCsv, DEMO_TIME_SERIES_LABEL } from "@/components/plotters/demo-csv";
import { FileDrop, TABLE_FILE_ACCEPT } from "@/components/plotters/file-drop";
import { FITS_FILE_ACCEPT, FitsMetaGrid, FitsView, fitsStatus } from "@/components/plotters/fits-view";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { useCsvSource, useFitsSource } from "@/components/plotters/use-plotter-source";

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

const demoCsv = { text: createDemoTimeSeriesCsv(), label: DEMO_TIME_SERIES_LABEL };

function CsvCompactPanel() {
  const source = useCsvSource({ initial: demoCsv, sample: "power15.csv" });
  const parsed = useMemo(() => timeSeries(readCsvTable(source.text, "columns")), [source.text]);

  const chartData = useMemo<ChartData<"scatter">>(
    () => ({
      datasets: parsed.series.map<ChartDataset<"scatter", DataPoint[]>>((channel) => ({
        label: channel.label,
        data: channel.points,
        showLine: true,
        borderWidth: 2,
        pointRadius: 1.5,
        pointHoverRadius: 3,
      })),
    }),
    [parsed],
  );

  const chartOptions = useMemo<ChartOptions<"scatter">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: false },
        tooltip: { enabled: true },
        legend: {
          display: true,
          position: "top",
          labels: {
            usePointStyle: true,
            boxWidth: 10,
          },
        },
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
        point: { radius: 1.75, hoverRadius: 3.5 },
        line: { tension: 0 },
      },
    }),
    [parsed.xLabel],
  );

  const error = source.error ?? parsed.error;

  return (
    <article className="comparisonPanel sectionCard">
      <div className="comparisonPanel__top fieldStack">
        <h2>CSV</h2>

        <label className="field">
          <span>CSV, TSV or TXT file</span>
          <FileDrop kind="CSV, TSV or TXT file" accept={TABLE_FILE_ACCEPT} onChange={source.upload} />
        </label>

        <p className="resultCard comparisonResultCard">
          {error
            ? error
            : `${parsed.rowCount} rows.${parsed.skippedRowCount > 0 ? ` ${parsed.skippedRowCount} skipped.` : ""}`}
        </p>
      </div>

      <div className="comparisonPanel__viewer visualizerChartSurface">
        <InteractiveScatterChart data={chartData} options={chartOptions} sourceLabel={source.label} />
        {parsed.error ? (
          <div className="visualizerEmptyState visualizerOverlayState">
            Fix the CSV input to render the figure.
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FitsCompactPanel() {
  const source = useFitsSource({ sample: "bec15.fits" });

  return (
    <article className="comparisonPanel sectionCard">
      <div className="comparisonPanel__top fieldStack">
        <h2>FITS</h2>

        <label className="field">
          <span>FITS file</span>
          <FileDrop kind="FITS file" accept={FITS_FILE_ACCEPT} onChange={source.upload} />
        </label>

        <p className="resultCard comparisonResultCard">{fitsStatus(source)}</p>

        <FitsMetaGrid summary={source.summary} className="fitsMetaGrid comparisonMetaGrid" />
      </div>

      <FitsView
        source={source}
        surfaceClassName="comparisonPanel__viewer visualizerChartSurface"
        emptyText="Upload a FITS file to render a preview."
      />
    </article>
  );
}

export default function CsvFitsViewer() {
  return (
    <div className="comparisonLayout">
      <CsvCompactPanel />
      <FitsCompactPanel />
    </div>
  );
}
