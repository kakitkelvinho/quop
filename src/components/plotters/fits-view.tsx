"use client";

import { useMemo } from "react";

import { titleFromFileName } from "@/components/plotters/figure-spec";
import type { FitsSummary } from "@/components/plotters/fits-file";
import FitsHeaderDisplay from "@/components/plotters/fits-header-display";
import FitsImageViewer from "@/components/plotters/fits-image-viewer";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";

export const FITS_FILE_ACCEPT = ".fits,.fit,application/fits";

type FitsSource = {
  summary: FitsSummary | null;
  isLoading: boolean;
  error: string | null;
};

/** the status line under a FITS file picker */
export function fitsStatus({ summary, isLoading, error }: FitsSource) {
  return isLoading
    ? "Loading…"
    : error
      ? error
      : summary
        ? `Range ${summary.min.toExponential(3)} to ${summary.max.toExponential(3)}`
        : "No file.";
}

/** the FITS file's shape: frames, size, type */
export function FitsMetaGrid({ summary, className = "fitsMetaGrid" }: { summary: FitsSummary | null; className?: string }) {
  if (!summary) return null;

  return (
    <div className={className}>
      {summary.shapeSummary.map((item) => (
        <div className="fitsMetaCard" key={item.label}>
          <span className="fitsMetaCard__label">{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

/**
 * A FITS file drawn: a 1D file as a trace, a 2D one in the Image view, with
 * its header beside it. `surfaceClassName` styles the drawing's box, and
 * `emptyText` fills it before there is a file.
 */
export function FitsView({
  source: { summary, isLoading, error },
  surfaceClassName,
  emptyText,
}: {
  source: FitsSource;
  surfaceClassName: string;
  emptyText: string;
}) {
  const series = useMemo(
    () => (summary?.kind === "series" ? [{ label: summary.sourceLabel, points: summary.points }] : []),
    [summary],
  );

  return (
    <FitsHeaderDisplay header={summary?.header ?? null}>
      <div className={surfaceClassName}>
        {!summary && !error && !isLoading ? (
          <div className="visualizerEmptyState">{emptyText}</div>
        ) : null}
        {summary?.kind === "series" ? (
          <InteractiveScatterChart
            series={series}
            xLabel={summary.xLabel}
            yLabel={summary.yLabel}
            title={titleFromFileName(summary.sourceLabel)}
            pointSize={1.75}
          />
        ) : null}
        {summary?.kind === "image" ? (
          <FitsImageViewer key={summary.sourceLabel} summary={summary} />
        ) : null}
        {error ? <div className="visualizerEmptyState">{error}</div> : null}
      </div>
    </FitsHeaderDisplay>
  );
}
