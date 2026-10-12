import { navSections } from "@/components/navigation";
import { ToolIndex } from "@/components/tool-index";

const plotters = navSections.find((section) => section.href === "/plotters");

export default function PlottersPage() {
  return (
    <section className="pageSection">
      <h1>Plotters</h1>
      <p className="lead">
        Interactive plotting tools for quick inspection of arrays, traces, and
        exported lab data.
      </p>

      <ToolIndex links={plotters?.links ?? []} />
    </section>
  );
}
