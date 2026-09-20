"use client";

import dynamic from "next/dynamic";

// next/dynamic's `ssr: false` option is only allowed inside a Client
// Component, so this tiny wrapper exists purely to hold that boundary —
// the actual scene (Canvas/WebGL) lives in builder-scene.tsx.
const BuilderScene = dynamic(() => import("@/components/builder/builder-scene"), {
  ssr: false,
  loading: () => <div className="builderCanvasHost" />,
});

export default function BuilderSceneLoader() {
  return <BuilderScene />;
}
