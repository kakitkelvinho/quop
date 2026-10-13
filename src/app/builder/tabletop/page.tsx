import type { Metadata } from "next";

import BuilderSceneLoader from "@/components/builder/builder-scene-loader";

export const metadata: Metadata = {
  title: "Tabletop",
  description:
    "Lay out an optical table in the browser: place sources, mirrors and detectors on a millimetre grid, draw beam paths, and read off path length and time of flight.",
};

export default function BuilderPage() {
  return (
    <section className="builderPage">
      <h1 className="sr-only">Tabletop</h1>
      <BuilderSceneLoader />
    </section>
  );
}
