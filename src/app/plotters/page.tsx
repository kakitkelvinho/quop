import type { Metadata } from "next";

import { navSections } from "@/components/navigation";
import { ToolIndex } from "@/components/tool-index";

const plotters = navSections.find((section) => section.href === "/plotters");

export const metadata: Metadata = { title: "Plotters" };

export default function PlottersPage() {
  return (
    <section className="pageSection">
      <h1>Plotters</h1>
      <ToolIndex links={plotters?.links ?? []} />
    </section>
  );
}
