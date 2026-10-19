"use client";

// PROTOTYPE: throwaway HUD surface languages (?variant=current|A|B|C). Not for main.

import { useEffect } from "react";
import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";
import "./hud-style.prototype.css";

const VARIANTS = [
  { key: "current", name: "Current: lifted, soft" },
  { key: "A", name: "Flat: no shadow or blur" },
  { key: "B", name: "Flat + hard-edged" },
  { key: "C", name: "Signal: black plates, one red" },
];

export function HudStylePrototype() {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));

  useEffect(() => {
    const root = document.documentElement;
    if (variant && variant !== "current") root.dataset.hud = variant;
    else delete root.dataset.hud;
    return () => {
      delete root.dataset.hud;
    };
  }, [variant]);

  return variant ? <PrototypeSwitcher variants={VARIANTS} current={variant} /> : null;
}
