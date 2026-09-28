import FitsPlotter from "@/components/plotters/fits-plotter";
import { ToolIntro } from "@/components/tool-intro";

export default function FitsPlotterPage() {
  return (
    <section className="pageSection">
      <ToolIntro href="/plotters/fits-plotter">FITS Plotter</ToolIntro>
      <FitsPlotter />
    </section>
  );
}
