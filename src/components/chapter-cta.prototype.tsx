"use client";

// PROTOTYPE (#280): throwaway chapter-CTA variants (?variant=current|A|B|C|D). Not for main.
// What replaces the chapters' blue plate with the arrow inside, now that the
// hero's signs (#278) are outlined at rest and blue only under the pointer.

import { useEffect } from "react";

import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";
import "./chapter-cta.prototype.css";

const VARIANTS = [
  { key: "current", name: "Current: blue plate, arrow inside" },
  { key: "A", name: "Hero sign: outlined 6:1, blue on hover" },
  { key: "B", name: "Chalk link: written on the board" },
  { key: "C", name: "Platform strip: column-wide, arrow at rest" },
  { key: "D", name: "Arrow square: words + outlined arrow box" },
];

export function CtaPrototype() {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));
  useEffect(() => {
    if (variant) document.documentElement.dataset.cta = variant;
    return () => {
      delete document.documentElement.dataset.cta;
    };
  }, [variant]);
  return variant ? <PrototypeSwitcher variants={VARIANTS} current={variant} /> : null;
}
