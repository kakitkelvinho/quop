import Link from "next/link";

import { ChalkboardHero, ChalkFilters } from "@/components/chalkboard-hero";
import { HomeChapters } from "@/components/home-chapters";
import { loadPowerTrace } from "@/components/home-trace";
import { SectionCards } from "@/components/section-cards";
import { ArrowRightIcon, SignIcon } from "@/components/sign-icon";

export default function Home() {
  return (
    <>
      <ChalkFilters />
      <ChalkboardHero>
        <h1>Quantum optics, in the browser.</h1>
        <p className="lead">
          Plot lab data, run quick optics calculations and lay out an optical table. Nothing to
          install, free for anyone to try.
        </p>
        <p className="chalkboard__credit">Built at Macroscopic Quantum Optics, Aalto University</p>
        {/* the way straight to the tools, for whoever came to use one rather than read the story */}
        <nav aria-label="Tools" className="heroTools">
          <Link className="buttonLink" href="/builder/tabletop">
            <SignIcon>
              <ArrowRightIcon />
            </SignIcon>
            Tabletop
          </Link>
          <Link className="buttonLink" href="/plotters">
            <SignIcon>
              <ArrowRightIcon />
            </SignIcon>
            Plotters
          </Link>
          <Link className="buttonLink" href="/calculators">
            <SignIcon>
              <ArrowRightIcon />
            </SignIcon>
            Calculators
          </Link>
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
