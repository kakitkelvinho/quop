import GenericCsvPlotter from "@/components/plotters/generic-csv-plotter";
import { ToolIntro } from "@/components/tool-intro";

export default function GenericCsvPlotterPage() {
  return (
    <section className="pageSection">
      <ToolIntro href="/plotters/generic-csv-plotter">CSV Plotter</ToolIntro>
      <GenericCsvPlotter />
    </section>
  );
}
