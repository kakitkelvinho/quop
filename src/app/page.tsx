import { HomeHeroPanel } from "@/components/home/home-hero-panel";

export default function Home() {
  return (
    <section className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-8 text-center">
      <div className="grid max-w-xl gap-3 justify-items-center">
        <h1>QUOP</h1>
        <p className="lead">
          Working tools from the Macroscopic Quantum Optics lab at Aalto
          University &mdash; calculators and plotters built for our own
          measurements, open for anyone curious about the physics behind
          them.
        </p>
      </div>
      <HomeHeroPanel />
    </section>
  );
}
