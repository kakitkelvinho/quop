import ArrayPlotter from "@/components/plotters/array-plotter";
import { ToolTitle } from "@/components/tool-title";

export default function VisualizerPage() {
  return (
    <section className="pageSection">
      <ToolTitle href="/plotters/array-plotter">Array Plotter</ToolTitle>
      <p className="lead">
        A lightweight chart viewer. Enter x and y arrays, then plot them
        immediately in a Chart.js figure.
      </p>
      <ArrayPlotter />
    </section>
  );
}
