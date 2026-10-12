import CsvPlotter from "@/components/plotters/csv-plotter";
import { ToolIntro, toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/plotters/csv-plotter");

export default function CsvPlotterPage() {
  return (
    <section className="pageSection">
      <ToolIntro href="/plotters/csv-plotter">Time CSV Plotter</ToolIntro>
      <CsvPlotter />
    </section>
  );
}
