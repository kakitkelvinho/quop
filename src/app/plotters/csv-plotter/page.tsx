import CsvPlotter from "@/components/plotters/csv-plotter";

export default function CsvPlotterPage() {
  return (
    <section className="pageSection">
      <h1>CSV Plotter</h1>
      <p className="lead">
        Upload a CSV with a <code>time</code> column and any number of channel
        columns. Time stays on the x-axis and the remaining headers become the
        legend entries.
      </p>
      <CsvPlotter />
    </section>
  );
}
