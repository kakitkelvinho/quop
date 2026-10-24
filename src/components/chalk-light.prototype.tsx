"use client";

// PROTOTYPE (#279): the chalkboard hero with a cursor light, swapped per
// ?variant= in dev builds. Throwaway branch, not for main.

import type { ReactNode } from "react";

import { ChalkboardHero, type ChalkLight } from "@/components/chalkboard-hero";
import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";

const VARIANTS: { key: string; light: ChalkLight | null; name: string }[] = [
  { key: "A", light: "brighten", name: "Brighten the written chalk" },
  { key: "B", light: "reveal", name: "Reveal hidden working" },
  { key: "C", light: "rake", name: "Raking light on the slate" },
  { key: "Z", light: null, name: "No light (today)" },
];

export function ChalkLightPrototype({ children }: { children: ReactNode }) {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));
  const chosen = VARIANTS.find((v) => v.key === variant);
  return (
    <>
      <ChalkboardHero light={chosen?.light ?? null}>{children}</ChalkboardHero>
      {variant && <PrototypeSwitcher current={variant} variants={VARIANTS} />}
    </>
  );
}
