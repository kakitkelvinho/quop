import ArrayPlotter from "@/components/plotters/array-plotter";
import { ToolIntro, toolMetadata } from "@/components/tool-intro";

export const metadata = toolMetadata("/plotters/array-plotter");

export default function VisualizerPage() {
  return (
    <section className="pageSection">
      <ToolIntro href="/plotters/array-plotter">Array Plotter</ToolIntro>
      <ArrayPlotter />
    </section>
  );
}
