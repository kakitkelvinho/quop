"use client";

import { useSyncExternalStore } from "react";

/**
 * The canvas can't read CSS custom properties, so the day/night ink swap has
 * to be mirrored here as literal colours. Day is a warm bench under room
 * light; night is the same bench under a desk lamp, with the amber accent.
 */
export type ScenePalette = {
  mode: "light" | "dark";
  background: string;
  table: string;
  tableEdge: string;
  gridCell: string;
  gridSection: string;
  /** the ink accent — selection rings, the beam being drawn */
  accent: string;
  hover: string;
  ambient: number;
  keyLight: number;
  fillLight: number;
  metal: string;
  body: string;
  skyLight: string;
};

export const LIGHT_PALETTE: ScenePalette = {
  mode: "light",
  background: "#ece7dc",
  table: "#ded7c9",
  tableEdge: "#b9ad97",
  gridCell: "#c6bca8",
  gridSection: "#a3977f",
  accent: "#8b1e3f",
  hover: "#b4506c",
  ambient: 0.35,
  keyLight: 1.15,
  fillLight: 0.45,
  metal: "#c9ced6",
  body: "#3a3f47",
  skyLight: "#f2ece0",
};

export const DARK_PALETTE: ScenePalette = {
  mode: "dark",
  background: "#0c0f16",
  table: "#171c27",
  tableEdge: "#2b3345",
  gridCell: "#2f3850",
  gridSection: "#48536e",
  accent: "#f4b942",
  hover: "#ffd67c",
  ambient: 0.25,
  keyLight: 1.05,
  fillLight: 0.4,
  metal: "#aeb5bf",
  body: "#2b2f36",
  skyLight: "#2a3344",
};

/** The site writes its theme to `data-theme`; treat that attribute as the store. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

export function useScenePalette(): ScenePalette {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return mode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
}
