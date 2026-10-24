import Link from "next/link";

import { ChalkboardHero, ChalkFilters } from "@/components/chalkboard-hero";
import { HomeChapters } from "@/components/home-chapters";
import { loadPowerTrace } from "@/components/home-trace";
import { SectionCards } from "@/components/section-cards";
import { ArrowRightIcon, SignIcon } from "@/components/sign-icon";

/** PROTOTYPE (#278): the hero's three destinations, each with its station
 *  pictogram (drawn for the hero-links prototype). */
const HERO_TOOLS = [
  {
    href: "/builder/tabletop",
    label: "Tabletop",
    // a beam through a lens
    pictogram: <path d="M2 12h20M12 4c2.6 3.5 2.6 12.5 0 16M12 4c-2.6 3.5-2.6 12.5 0 16" />,
  },
  {
    href: "/plotters",
    label: "Plotters",
    // a trace on axes
    pictogram: <path d="M3 3v18h18M6 16l4-7 3 4 5-8" />,
  },
  {
    href: "/calculators",
    label: "Calculators",
    // a keypad
    pictogram: <path d="M5 3h14v18H5zM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />,
  },
];

export default function Home() {
  return (
    <>
      <ChalkFilters />
      <ChalkboardHero>
        <h1>Quantum optics, in the browser.</h1>
        <p className="lead">
          Plot lab data, run quick optics calculations and lay out an optical table.
        </p>
        <p className="chalkboard__credit">Built at Macroscopic Quantum Optics, Aalto University</p>
        {/* PROTOTYPE (#278): the way straight to the tools, for whoever came to
            use one rather than read the story: three station signs in a row,
            each with its pictogram and the arrow in its lower right corner */}
        <nav aria-label="Tools" className="heroTools">
          {HERO_TOOLS.map(({ href, label, pictogram }) => (
            <Link className="buttonLink" href={href} key={href}>
              {label}
              <span className="heroTools__marks">
                <SignIcon>
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    {pictogram}
                  </svg>
                </SignIcon>
                <span className="heroTools__arrow">
                  <ArrowRightIcon />
                </span>
              </span>
            </Link>
          ))}
        </nav>
      </ChalkboardHero>
      <HomeChapters trace={loadPowerTrace()} />
      <nav aria-labelledby="home-index" className="homeIndex">
        <h2 className="homeIndex__label" id="home-index">
          Jump to
        </h2>
        <SectionCards />
      </nav>
    </>
  );
}
