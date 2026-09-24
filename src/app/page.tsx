import { ChalkboardHero, ChalkFilters } from "@/components/chalkboard-hero";
import { HomeChapters } from "@/components/home-chapters";
import { loadPowerTrace } from "@/components/home-trace";
import { SectionCards } from "@/components/section-cards";

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
