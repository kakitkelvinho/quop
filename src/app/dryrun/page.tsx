import type { Metadata } from "next";

import DryRun from "@/components/dryrun/dry-run";
import { DRY_RUN_NAME } from "@/components/dryrun/names";

// Prototype for #341, reachable by its address only: it is not in the nav, so
// people who only draw setups in the Tabletop never meet simulation.
export const metadata: Metadata = {
  title: DRY_RUN_NAME,
  description: "Run a Tabletop setup as an experiment: a pulsed pump on a polariton microcavity, a power series of spectrometer captures.",
  robots: { index: false },
};

export default function DryRunPage() {
  return (
    <section className="dryRunPage">
      <DryRun />
    </section>
  );
}
