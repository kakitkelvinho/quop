import Link from "next/link";

import { navSections } from "@/components/navigation";

const plotters = navSections.find((section) => section.href === "/plotters");

export default function PlottersPage() {
  return (
    <section className="pageSection">
      <h1>Plotters</h1>
      <p className="lead">
        Interactive plotting tools for quick inspection of arrays, traces, and
        exported lab data.
      </p>

      <div className="cardGrid">
        {plotters?.links.map((link) => (
          <article className="sectionCard" key={link.href}>
            <p className="sectionCard__kicker">Plotter</p>
            <h2>{link.label}</h2>
            <p>{link.description}</p>
            <Link className="buttonLink" href={link.href}>
              Open plotter
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
