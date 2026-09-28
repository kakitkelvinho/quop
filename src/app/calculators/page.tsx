import Link from "next/link";

import { navSections } from "@/components/navigation";
import { BetaBadge, isBeta } from "@/components/tool-title";

const calculators = navSections.find((section) => section.href === "/calculators");

export default function CalculatorsPage() {
  return (
    <section className="pageSection">
      <h1>Calculators</h1>
      <p className="lead">
        Practical optics tools for quick conversions and threshold estimates.
      </p>

      <div className="cardGrid">
        {calculators?.links.map((link) => (
          <article className="sectionCard" key={link.href}>
            <p className="sectionCard__kicker">Calculator</p>
            <h2>
              {link.label}
              {isBeta(link) ? (
                <>
                  {" "}
                  <BetaBadge />
                </>
              ) : null}
            </h2>
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
