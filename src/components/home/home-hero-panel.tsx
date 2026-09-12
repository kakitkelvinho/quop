"use client";

import dynamic from "next/dynamic";

const AtomHero = dynamic(() => import("@/components/home/atom-hero"), {
  loading: () => <div className="atomMinimal atomMinimal--loading" />,
  ssr: false,
});

export function HomeHeroPanel() {
  return <AtomHero />;
}
