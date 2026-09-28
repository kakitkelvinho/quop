import GenericCsvPlotter from "@/components/plotters/generic-csv-plotter";
import { ToolTitle } from "@/components/tool-title";

export default function GenericCsvPlotterPage() {
  return (
    <section className="pageSection">
      <ToolTitle href="/plotters/generic-csv-plotter">CSV Plotter</ToolTitle>
      <p className="lead">
        Upload a numeric CSV, let the first column default to x, then remap x
        and y columns from the role chooser whenever you need to.
      </p>
      <GenericCsvPlotter />
    </section>
  );
}
