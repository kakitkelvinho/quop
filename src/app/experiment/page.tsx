import type { Metadata } from "next";
import Link from "next/link";

import { navSections } from "@/components/navigation";

const experiment = navSections.find((section) => section.href === "/experiment");

export const metadata: Metadata = {
  title: "Experiment · quop",
  description:
    "Lab-facing setup notes and tools for building optical experiments, including the interactive table builder.",
};

export default function ExperimentPage() {
  return (
    <section className="pageSection">
      <h1>Experiment</h1>
      <p className="lead">
        The bench side of the site: tools for laying out a setup before you
        touch a post, and notes on how the measurements actually run.
      </p>

      <div className="cardGrid">
        {experiment?.links.map((link) => (
          <article className="sectionCard" key={link.href}>
            <p className="sectionCard__kicker">Tool</p>
            <h2>{link.label}</h2>
            <p>{link.description}</p>
            <Link className="buttonLink" href={link.href}>
              Open {link.label.toLowerCase()}
            </Link>
          </article>
        ))}

        <article className="sectionCard">
          <p className="sectionCard__kicker">Coming next</p>
          <h2>Measurement workflows</h2>
          <p>
            Step-by-step notes for the routines we run most — alignment,
            power calibration, and taking a temperature series — written so
            someone new to the bench can follow them.
          </p>
        </article>
      </div>
    </section>
  );
}
