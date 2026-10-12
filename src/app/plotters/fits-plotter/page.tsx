import FitsPlotter from "@/components/plotters/fits-plotter";
import { ToolIntro, toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/plotters/fits-plotter");

export default function FitsPlotterPage() {
  return (
    <section className="pageSection">
      <ToolIntro href="/plotters/fits-plotter" />
      <FitsPlotter />
    </section>
  );
}
