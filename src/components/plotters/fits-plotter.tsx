"use client";

import {
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { FileDrop } from "@/components/plotters/file-drop";
import { FITS_FILE_ACCEPT, FitsMetaGrid, FitsView, fitsStatus } from "@/components/plotters/fits-view";
import { PlotterShell } from "@/components/plotters/plotter-shell";
import { useFitsSource } from "@/components/plotters/use-plotter-source";

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function FitsPlotter() {
  const source = useFitsSource({ sample: "bec15.fits" });
  const { summary } = source;

  return (
    <PlotterShell
      sidebar={
        <>
          <label className="field">
            <span>FITS file</span>
            <FileDrop kind="FITS file" accept={FITS_FILE_ACCEPT} onChange={source.upload} />
          </label>

          <p className="resultCard">{fitsStatus(source)}</p>

          <FitsMetaGrid summary={summary} />
        </>
      }
    >
      <div>
        <h2>{summary?.kind === "series" ? "Trace" : "Image"}</h2>
      </div>
      <FitsView source={source} surfaceClassName="visualizerChartSurface" emptyText="No file." />
    </PlotterShell>
  );
}
