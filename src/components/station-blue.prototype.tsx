"use client";

// PROTOTYPE: throwaway station-blue identity (?variant=current|A|B|AS|BS). Not for main.
// Oxblood becomes the blue of European station signs: whatever is pressed or
// active becomes a blue plate with white lettering. Cosmetic only.

import { useEffect } from "react";
import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";
import "./station-blue.prototype.css";

/** Each variant's blue for the Tabletop's 3D selection, which can't read CSS: day, then night. */
export const STATION_INKS = {
  A: { day: { accent: "#0b3d74", hover: "#3f6ea6" }, night: { accent: "#4f86d4", hover: "#9cc2f5" } },
  B: { day: { accent: "#1a5fb4", hover: "#4f86d4" }, night: { accent: "#4d8fe0", hover: "#a5c8f7" } },
} as const;

const VARIANTS = [
  { key: "current", name: "Current: oxblood / amber" },
  { key: "A", name: "Station navy plates" },
  { key: "B", name: "Signal blue plates" },
  { key: "AS", name: "Station navy, Source Sans" },
  { key: "BS", name: "Signal blue, Source Sans" },
];

export function useStationInk() {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));
  return variant && variant !== "current" ? STATION_INKS[variant[0] as keyof typeof STATION_INKS] : null;
}

export function StationBluePrototype() {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));
  useEffect(() => {
    const root = document.documentElement;
    if (variant && variant !== "current") root.dataset.sign = variant[0];
    else delete root.dataset.sign;
    if (variant?.endsWith("S")) root.dataset.face = "source";
    else delete root.dataset.face;
  }, [variant]);
  return variant ? <PrototypeSwitcher variants={VARIANTS} current={variant} /> : null;
}
