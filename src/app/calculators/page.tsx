import Link from "next/link";

import { navSections } from "@/components/navigation";

const calculators = navSections.find((section) => section.href === "/calculators");

export default function CalculatorsPage() {
  return (
    <section className="pageSection">
      <span className="eyebrow">Section</span>
      <h1>Calculators</h1>
      <p className="lead">
        Practical optics tools for quick conversions and threshold estimates.
      </p>

      <div className="cardGrid">
        {calculators?.links.map((link) => (
          <article className="sectionCard" key={link.href}>
            <p className="sectionCard__kicker">Calculator</p>
            <h2>{link.label}</h2>
            <p>{link.description}</p>
            <Link className="buttonLink" href={link.href}>
              Open calculator
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
