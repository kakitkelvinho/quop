"use client";

// PROTOTYPE: throwaway station-blue identity (?variant=current|A|B|AS|BS). Not for main.
// Oxblood becomes the blue of European station signs: whatever is pressed or
// active becomes a blue plate with white lettering. Cosmetic only.

import { useEffect } from "react";
import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";
import "./station-blue.prototype.css";

const VARIANTS = [
  { key: "current", name: "Current: oxblood / amber" },
  { key: "A", name: "Station navy plates" },
  { key: "B", name: "Signal blue plates" },
  { key: "AS", name: "Station navy, Source Sans" },
  { key: "BS", name: "Signal blue, Source Sans" },
];

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
