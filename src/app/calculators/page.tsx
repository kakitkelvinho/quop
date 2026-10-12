import type { Metadata } from "next";

import { navSections } from "@/components/navigation";
import { ToolIndex } from "@/components/tool-index";

const calculators = navSections.find((section) => section.href === "/calculators");

export const metadata: Metadata = { title: "Calculators" };

export default function CalculatorsPage() {
  return (
    <section className="pageSection">
      <h1>Calculators</h1>
      <p className="lead">
        Practical optics tools for quick conversions and threshold estimates.
      </p>

      <ToolIndex links={calculators?.links ?? []} />
    </section>
  );
}
