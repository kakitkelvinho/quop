import { ChalkboardHero, ChalkFilters } from "@/components/chalkboard-hero";
import { SectionCards } from "@/components/section-cards";

export default function Home() {
  return (
    <>
      <ChalkFilters />
      <ChalkboardHero>
        <h1>Welcome!</h1>
        <p className="lead">QUOP is short for quantum optics. Have fun!</p>
      </ChalkboardHero>
      <SectionCards />
    </>
  );
}
