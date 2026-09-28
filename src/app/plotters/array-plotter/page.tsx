import ArrayPlotter from "@/components/plotters/array-plotter";
import { ToolIntro } from "@/components/tool-intro";

export default function VisualizerPage() {
  return (
    <section className="pageSection">
      <ToolIntro href="/plotters/array-plotter">Array Plotter</ToolIntro>
      <ArrayPlotter />
    </section>
  );
}
