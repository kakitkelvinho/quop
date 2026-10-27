import type { Metadata } from "next";
import Link from "next/link";

import { MissingAddress } from "@/components/missing-address";
import { navSections } from "@/components/navigation";
import { SignMarks } from "@/components/tool-pictograms";

export const metadata: Metadata = { title: "Not found" };

// the tools first, in the hero's order, then the notes; hrefs and labels come
// from the navigation registry so the signs can't point somewhere stale
const SECTION_ORDER = ["Builder", "Plotters", "Calculators", "Notes"];
const signs = [
  ...SECTION_ORDER.flatMap((label) => navSections.filter((section) => section.label === label)),
  { href: "/", label: "Home" },
];

export default function NotFound() {
  return (
    <section className="pageSection notFound">
      <h1>No page at this address.</h1>
      <p className="lead">
        <MissingAddress />
        It may have moved, or the link may be mistyped. Take one of the signs below.
      </p>
      <nav aria-label="Sections" className="notFound__signs">
        {signs.map(({ href, label }) => (
          <Link className="buttonLink" href={href} key={href}>
            {label}
            <SignMarks href={href} />
          </Link>
        ))}
      </nav>
    </section>
  );
}
