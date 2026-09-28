import FitsPlotter from "@/components/plotters/fits-plotter";
import { ToolTitle } from "@/components/tool-title";

export default function FitsPlotterPage() {
  return (
    <section className="pageSection">
      <ToolTitle href="/plotters/fits-plotter">FITS Plotter</ToolTitle>
      <p className="lead">
        Upload a FITS image file and preview its first frame directly in the
        browser. One-dimensional FITS data are shown as a trace; two-dimensional
        data are drawn as a colormapped image, or as a 3D Surface view.
      </p>
      <FitsPlotter />
    </section>
  );
}
