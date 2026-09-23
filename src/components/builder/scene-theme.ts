"use client";

import { useSyncExternalStore } from "react";

/**
 * The canvas can't read CSS custom properties, so the day/night swap has to be
 * mirrored here as literal colours.
 *
 * The bench is lit like a 2001 interior photographed as a miniature: glossy
 * white enamel hardware under overhead ring lights, on a soft studio sweep
 * with no table in shot. Day is a white room; night is the same parts floating
 * in a dark void, with a cool rim light to lift them off it.
 */
export type ScenePalette = {
  mode: "light" | "dark";
  /** radial studio sweep behind the parts: centre, middle, edge */
  backdrop: [string, string, string];
  /** the invisible table only catches shadows; this is their ink */
  shadow: string;
  shadowOpacity: number;
  gridCell: string;
  gridSection: string;
  /** the ink accent — selection rings, the beam being drawn */
  accent: string;
  hover: string;
  ambient: number;
  keyLight: number;
  rimLight: number;
  rimColor: string;
  occlusion: number;
  vignette: number;
  /** enamel instrument bodies */
  body: string;
  metal: string;
};

export const LIGHT_PALETTE: ScenePalette = {
  mode: "light",
  backdrop: ["#f7f6f2", "#e4e6ea", "#c3c7cf"],
  shadow: "#1c2230",
  shadowOpacity: 0.16,
  gridCell: "#c7cbd2",
  gridSection: "#a9aeb8",
  accent: "#8b1e3f",
  hover: "#b4506c",
  ambient: 0.2,
  keyLight: 1.6,
  rimLight: 1.1,
  rimColor: "#ffffff",
  occlusion: 3.2,
  vignette: 0.3,
  body: "#fbfbf8",
  metal: "#d8dce2",
};

export const DARK_PALETTE: ScenePalette = {
  mode: "dark",
  backdrop: ["#2a2c33", "#101114", "#020203"],
  shadow: "#000000",
  shadowOpacity: 0.5,
  gridCell: "#2c2c2c",
  gridSection: "#4a4a4a",
  accent: "#f4b942",
  hover: "#ffd67c",
  ambient: 0.1,
  keyLight: 2.2,
  rimLight: 2.2,
  rimColor: "#b9ccff",
  occlusion: 3,
  vignette: 0.55,
  body: "#ecebe7",
  metal: "#c9ced6",
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
