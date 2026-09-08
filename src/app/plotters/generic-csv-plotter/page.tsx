import GenericCsvPlotter from "@/components/plotters/generic-csv-plotter";

export default function GenericCsvPlotterPage() {
  return (
    <section className="pageSection">
      <h1>CSV Plotter</h1>
      <p className="lead">
        Upload a numeric CSV, let the first column default to x, then remap x
        and y columns from the role chooser whenever you need to.
      </p>
      <GenericCsvPlotter />
    </section>
  );
}
