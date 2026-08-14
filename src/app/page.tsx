import Link from "next/link";

import { navSections } from "@/components/navigation";

export default function Home() {
  return (
    <section className="pageSection">
      <span className="eyebrow">Overview</span>
      <h1>Quantum optics, organized by section.</h1>
      <p className="lead">
        Browse calculators, theory notes, visualizers, and experiment pages
        from a single section-based layout.
      </p>

      <div className="cardGrid">
        {navSections.map((section) => (
          <article className="sectionCard" key={section.href}>
            <p className="sectionCard__kicker">{section.label}</p>
            <h2>{section.label}</h2>
            <p>{section.description}</p>
            <Link className="buttonLink" href={section.href}>
              Open {section.label}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
