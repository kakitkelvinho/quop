import FitsPlotter from "@/components/plotters/fits-plotter";

export default function FitsPlotterPage() {
  return (
    <section className="pageSection">
      <h1>FITS Plotter</h1>
      <p className="lead">
        Upload a FITS image file and preview its first frame directly in the
        browser. One-dimensional FITS data are shown as a trace; two-dimensional
        data are rendered as a grayscale image.
      </p>
      <FitsPlotter />
    </section>
  );
}
