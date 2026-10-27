"use client";

import { useMemo } from "react";
import { readCsvTable } from "@/components/plotters/csv-parsing";
import { timeSeries } from "@/components/plotters/csv-series";
import { createDemoTimeSeriesCsv, DEMO_TIME_SERIES_LABEL } from "@/components/plotters/demo-csv";
import { titleFromFileName } from "@/components/plotters/figure-spec";
import { FileDrop, TABLE_FILE_ACCEPT } from "@/components/plotters/file-drop";
import { FITS_FILE_ACCEPT, FitsMetaGrid, FitsView, fitsStatus } from "@/components/plotters/fits-view";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { useCsvSource, useFitsSource } from "@/components/plotters/use-plotter-source";

const demoCsv = { text: createDemoTimeSeriesCsv(), label: DEMO_TIME_SERIES_LABEL };

function CsvCompactPanel() {
  const source = useCsvSource({ initial: demoCsv, sample: "power15.csv" });
  const parsed = useMemo(() => timeSeries(readCsvTable(source.text, "columns")), [source.text]);

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
