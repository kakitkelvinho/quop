import CsvPlotter from "@/components/plotters/csv-plotter";
import { ToolTitle } from "@/components/tool-title";

export default function CsvPlotterPage() {
  return (
    <section className="pageSection">
      <ToolTitle href="/plotters/csv-plotter">Time CSV Plotter</ToolTitle>
      <p className="lead">
        Upload a CSV with a <code>time</code> column and any number of channel
        columns. Time stays on the x-axis and the remaining headers become the
        legend entries.
      </p>
      <CsvPlotter />
    </section>
  );
}
