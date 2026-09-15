import { HomeHeroPanel } from "@/components/home/home-hero-panel";

export default function Home() {
  return (
    <section className="grid min-h-[calc(100vh-8rem)] place-items-center">
      <h1 className="sr-only">QUOP</h1>
      <HomeHeroPanel />
    </section>
  );
}
