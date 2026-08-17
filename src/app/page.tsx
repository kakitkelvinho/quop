import Link from "next/link";

import { navSections } from "@/components/navigation";

export default function Home() {
  return (
    <section className="pageSection">
      <h1>Quantum Optics</h1>
      <p className="lead">
        Welcome! Here is a scattered collection of information, knowledge and
        tools acquired from first-hand experience. Hope you will find something
        useful here!
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
