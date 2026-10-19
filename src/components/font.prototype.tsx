"use client";

// PROTOTYPE: throwaway font variants for #266 (?variant=…), on every page. Not for main.
// Each font also takes over the Tabletop HUD; "-bold" sets headings at 700.

import { useEffect } from "react";
import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";
import "./font.prototype.css";

const VARIANTS = [
  { key: "current", name: "Current: Plex (HUD Inter)" },
  { key: "switzer", name: "Switzer" },
  { key: "switzer-bold", name: "Switzer, bold headings" },
  { key: "geist", name: "Geist" },
  { key: "geist-bold", name: "Geist, bold headings" },
  { key: "inter-tight", name: "Inter Tight" },
  { key: "inter-tight-bold", name: "Inter Tight, bold headings" },
  { key: "roboto", name: "Roboto" },
  { key: "roboto-bold", name: "Roboto, bold headings" },
];

// Switzer's licence allows use but not redistribution, so it comes from Fontshare
const SWITZER_CSS = "https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800&display=swap";

export function FontPrototype() {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));

  useEffect(() => {
    if (document.getElementById("proto-switzer")) return;
    const link = document.createElement("link");
    link.id = "proto-switzer";
    link.rel = "stylesheet";
    link.href = SWITZER_CSS;
    document.head.append(link);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const font = variant?.replace(/-bold$/, "");
    if (font && font !== "current") root.dataset.font = font;
    else delete root.dataset.font;
    if (variant?.endsWith("-bold")) root.dataset.fontBold = "";
    else delete root.dataset.fontBold;
  }, [variant]);

  return variant ? <PrototypeSwitcher variants={VARIANTS} current={variant} /> : null;
}
