import ArrayPlotter from "@/components/plotters/array-plotter";

export default function VisualizerPage() {
  return (
    <section className="pageSection">
      <h1>Array Plotter</h1>
      <p className="lead">
        A lightweight chart viewer. Enter x and y arrays, then plot them
        immediately in a Chart.js figure.
      </p>
      <ArrayPlotter />
    </section>
  );
}
