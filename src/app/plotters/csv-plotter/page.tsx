import CsvPlotter from "@/components/plotters/csv-plotter";
import { ToolIntro } from "@/components/tool-intro";

export default function CsvPlotterPage() {
  return (
    <section className="pageSection">
      <ToolIntro href="/plotters/csv-plotter">Time CSV Plotter</ToolIntro>
      <CsvPlotter />
    </section>
  );
}
