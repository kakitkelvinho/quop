import "katex/dist/katex.min.css";

import { renderEquations } from "@/components/chalkboard-equations";
import { ChalkboardHero, ChalkFilters } from "@/components/chalkboard-hero";
import { SectionCards } from "@/components/section-cards";

export default function Home() {
  return (
    <>
      <ChalkFilters />
      <ChalkboardHero equations={renderEquations()}>
        <h1>Quantum optics, in the browser.</h1>
        <p className="lead">
          Plot lab data, run quick optics calculations and lay out an optical table. Nothing to
          install, free for anyone to try.
        </p>
        <p className="chalkboard__credit">Built at Macroscopic Quantum Optics, Aalto University</p>
      </ChalkboardHero>
      <SectionCards />
    </>
  );
}
