import GenericCsvPlotter from "@/components/plotters/generic-csv-plotter";
import { ToolIntro, toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/plotters/generic-csv-plotter");

export default function GenericCsvPlotterPage() {
  return (
    <section className="pageSection">
      <ToolIntro href="/plotters/generic-csv-plotter" />
      <GenericCsvPlotter />
    </section>
  );
}
