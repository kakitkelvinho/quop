import ArrayPlotter from "@/components/visualizers/array-plotter";

export default function VisualizerPage() {
  return (
    <section className="pageSection">
      <span className="eyebrow">Visualizer</span>
      <h1>Array Plotter</h1>
      <p className="lead">
        A lightweight chart viewer modeled on the data-viewer flow in the
        referenced <code>noptomec</code> repo: enter x and y arrays, then plot
        them immediately in a Chart.js figure.
      </p>
      <ArrayPlotter />
    </section>
  );
}
