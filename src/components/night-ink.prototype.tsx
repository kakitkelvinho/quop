"use client";

// PROTOTYPE: throwaway night-ink variants for #258 (?variant=current|A|B|C). Not for main.
// Only the night theme changes: switch to night to compare.

import { useEffect } from "react";
import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";
import "./night-ink.prototype.css";

/** Each variant's night ink: the fill, what's drawn thin (rings, the 3D selection), and accent text. */
export const NIGHT_INKS = {
  A: { fill: "#8b1e3f", ring: "#c23a48", text: "#d9545f" },
  B: { fill: "#b3304a", ring: "#b3304a", text: "#b3304a" },
  C: { fill: "#8b1e3f", ring: "#c23a48", text: "#ffffff" },
} as const;

const VARIANTS = [
  { key: "current", name: "Current: amber" },
  { key: "A", name: "#258 spec: fill 8b1e3f, ring c23a48, text d9545f" },
  { key: "B", name: "One shade: b3304a for all" },
  { key: "C", name: "Oxblood fills, white words" },
];

export function useNightInk() {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));
  return variant && variant !== "current" ? NIGHT_INKS[variant as keyof typeof NIGHT_INKS] : null;
}

export function NightInkPrototype() {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));
  useEffect(() => {
    const root = document.documentElement;
    if (variant && variant !== "current") root.dataset.ink = variant;
    else delete root.dataset.ink;
  }, [variant]);
  return variant ? <PrototypeSwitcher variants={VARIANTS} current={variant} /> : null;
}
