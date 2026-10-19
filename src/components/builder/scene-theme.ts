"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useNightInk } from "@/components/night-ink.prototype";

/**
 * The canvas can't read CSS custom properties, so the day/night swap has to be
 * mirrored here as literal colours.
 *
 * The bench is lit like a 2001 interior photographed as a miniature: glossy
 * white enamel hardware under overhead ring lights, on a soft studio sweep
 * with no table in shot. Day is a bright room; night is the same parts floating
 * in a dark void, with a cool rim light to lift them off it.
 */
export type ScenePalette = {
  mode: "light" | "dark";
  /** radial studio sweep behind the parts: centre, middle, edge */
  backdrop: [string, string, string];
  /** the invisible table only catches shadows; this is their ink */
  shadow: string;
  shadowOpacity: number;
  /**
   * the grid's steel plate, its M6 holes, the bright countersink round each
   * and the rows through them; the plate is part see-through, so the sweep
   * still shades it
   */
  holeGrid: { plate: string; plateOpacity: number; hole: string; rim: string; row: string };
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
  /**
   * posts, pedestals and risers: a mid-grey below the light sweep and above
   * the dark one, so every post reads as a stroke. Night runs a step darker,
   * because the key and rim lights push a post there up toward the white
   * bodies (see SHADING.md, "Posts are grey")
   */
  post: string;
  metal: string;
  /**
   * black anodised hardware: the mirror mount's front plate and knobs. Black
   * by day; at night lifted to a charcoal, or it vanishes into the backdrop
   */
  anodise: string;
  /**
   * a translation stage's plates, where the part has no stage colour of its
   * own: near-black anodised by day; at night a dark grey, a block well above
   * the backdrop and the table plate but below the posts, so it reads as a
   * body rather than a hole (see SHADING.md, "Stages")
   */
  stage: string;
  /** the bearing seams between a stage's plates: light lines that split the stack */
  stageSeam: string;
};

/**
 * The viewer's lighting settings, laid over the palette: not part of the
 * setup, so neither saved nor undone. Brightness scales the key light, and
 * with it how dark the shadows it casts fall.
 */
export type Lighting = {
  /** the key light's strength, as a multiple of the palette's */
  brightness: number;
  shadows: boolean;
};

export const DEFAULT_LIGHTING: Lighting = { brightness: 1, shadows: true };
export const BRIGHTNESS_RANGE: [number, number] = [0.25, 2];

export const LIGHT_PALETTE: ScenePalette = {
  mode: "light",
  // ~8 L* below the enamel at the centre, so a white part keeps a silhouette
  backdrop: ["#e2dfd8", "#cfccc4", "#a8aaae"],
  // warm ink on a warm sweep; in light mode the shadow carries the edges
  shadow: "#3a352c",
  shadowOpacity: 0.3,
  holeGrid: { plate: "#c9ccd1", plateOpacity: 0.85, hole: "#2a2c31", rim: "#f4f5f7", row: "#b2b6bd" },
  accent: "#8b1e3f",
  hover: "#b4506c",
  ambient: 0.2,
  keyLight: 1.6,
  // a white rim on white parts is a no-op; a faint cool one at least does work
  rimLight: 0.5,
  rimColor: "#b9ccff",
  occlusion: 3.2,
  vignette: 0.3,
  body: "#fbfbf8",
  post: "#8d9095",
  metal: "#d8dce2",
  anodise: "#1b1c1f",
  stage: "#1f2024",
  stageSeam: "#b4bac3",
};

export const DARK_PALETTE: ScenePalette = {
  mode: "dark",
  backdrop: ["#2a2c33", "#101114", "#020203"],
  shadow: "#000000",
  shadowOpacity: 0.5,
  holeGrid: { plate: "#1d1f23", plateOpacity: 0.92, hole: "#050506", rim: "#4b4f57", row: "#30333a" },
  accent: "#f4b942",
  hover: "#ffd67c",
  ambient: 0.1,
  keyLight: 2.2,
  rimLight: 2.2,
  rimColor: "#b9ccff",
  occlusion: 3,
  vignette: 0.55,
  body: "#ecebe7",
  post: "#6f7378",
  metal: "#c9ced6",
  anodise: "#4a4c52",
  stage: "#45494f",
  stageSeam: "#b8bfc9",
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
  // PROTOTYPE (night-oxblood, #258): the scene's selection takes the night ink being tried
  const ink = useNightInk();
  return useMemo(
    () =>
      mode === "dark"
        ? ink
          ? { ...DARK_PALETTE, accent: ink.ring, hover: ink.text === "#ffffff" ? "#e07a86" : ink.text }
          : DARK_PALETTE
        : LIGHT_PALETTE,
    [mode, ink],
  );
}
