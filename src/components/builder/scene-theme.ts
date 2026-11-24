"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Color } from "three";

/**
 * The canvas can't read CSS custom properties, so the day/night swap has to be
 * mirrored here as literal colours. The ink is the exception: it's read from
 * the page's tokens (see `useScenePalette`), so the selection can't drift from
 * the HUD's.
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
  /**
   * the ink accent — selection rings, the beam being drawn: the site's
   * `--focus-ring`, the ink as a thin mark, lifted toward red at night
   */
  accent: string;
  /** the hover ring: the ink a third of the way back to the backdrop */
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

/** a palette without its ink, which comes from the page's tokens */
type Inkless = Omit<ScenePalette, "accent" | "hover">;

export const LIGHT_PALETTE: Inkless = {
  mode: "light",
  // ~8 L* below the enamel at the centre, so a white part keeps a silhouette
  backdrop: ["#e2dfd8", "#cfccc4", "#a8aaae"],
  // warm ink on a warm sweep; in light mode the shadow carries the edges
  shadow: "#3a352c",
  shadowOpacity: 0.3,
  holeGrid: { plate: "#c9ccd1", plateOpacity: 0.85, hole: "#2a2c31", rim: "#f4f5f7", row: "#b2b6bd" },
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

export const DARK_PALETTE: Inkless = {
  mode: "dark",
  backdrop: ["#2a2c33", "#101114", "#020203"],
  shadow: "#000000",
  shadowOpacity: 0.5,
  holeGrid: { plate: "#1d1f23", plateOpacity: 0.92, hole: "#050506", rim: "#4b4f57", row: "#30333a" },
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

/*
 * The 2001 theme (`data-theme="2001"`, see site-theme.ts): the same parts in
 * the film's colour and light, never a new shape. Day is the space station's
 * lounge: a cooler, brighter white sweep, pure white enamel and blacker
 * anodise, with softer shadows from a stronger ambient. Night is space itself:
 * a near-black void, a harder cold rim light and a deeper vignette.
 */
export const LIGHT_2001_PALETTE: Inkless = {
  ...LIGHT_PALETTE,
  backdrop: ["#f3f4f5", "#e3e5e8", "#b9bec5"],
  shadow: "#1d2733",
  shadowOpacity: 0.26,
  holeGrid: { plate: "#d9dce0", plateOpacity: 0.8, hole: "#1a1d22", rim: "#ffffff", row: "#c3c7cd" },
  ambient: 0.28,
  keyLight: 1.7,
  rimLight: 0.4,
  rimColor: "#cfe0ff",
  occlusion: 2.6,
  vignette: 0.2,
  body: "#ffffff",
  post: "#9aa0a7",
  metal: "#e4e8ee",
  anodise: "#0d0e10",
  stage: "#121316",
  stageSeam: "#c4cad2",
};

export const DARK_2001_PALETTE: Inkless = {
  ...DARK_PALETTE,
  backdrop: ["#10131a", "#05060a", "#000000"],
  shadowOpacity: 0.6,
  holeGrid: { plate: "#111318", plateOpacity: 0.9, hole: "#000000", rim: "#3a4250", row: "#1e222a" },
  ambient: 0.06,
  keyLight: 2.4,
  rimLight: 2.8,
  rimColor: "#8fb8ff",
  occlusion: 3.2,
  vignette: 0.7,
  body: "#f4f4f2",
  post: "#5f656d",
  metal: "#cdd4de",
  anodise: "#3c3f46",
  stage: "#383c43",
  stageSeam: "#aeb8c6",
};

/** The root attributes carry both preferences; the scene redraws when either changes. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-mode", "data-theme"],
  });
  return () => observer.disconnect();
}

/**
 * The ring ink as `#rrggbb`. The token may be a `color-mix()`, which neither
 * getComputedStyle nor three resolves, so a canvas paints it and reads it back.
 */
function readRing(root: HTMLElement): string {
  const token = getComputedStyle(root).getPropertyValue("--focus-ring").trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!token || !ctx) return "";
  ctx.fillStyle = token;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The mode, theme and ring ink share one primitive snapshot. The token is read
 * once per preference pair, rather than on every render.
 */
let cached: { key: string; snapshot: string } | null = null;

function getSnapshot(): string {
  const root = document.documentElement;
  const mode = root.dataset.mode === "dark" ? "dark" : "light";
  const theme = root.dataset.theme === "2001" ? "2001" : "station";
  const key = `${mode} ${theme}`;
  if (!cached || cached.key !== key) {
    cached = { key, snapshot: `${key} ${readRing(root)}` };
  }
  return cached.snapshot;
}

function getServerSnapshot(): string {
  return "light station ";
}

export function useScenePalette(): ScenePalette {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    const [mode, theme, ring] = snapshot.split(" ");
    const base = theme === "2001"
      ? mode === "dark" ? DARK_2001_PALETTE : LIGHT_2001_PALETTE
      : mode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
    // before the tokens are read (the server render), a neutral the canvas never shows
    const accent = new Color(ring || base.post);
    const hover = accent.clone().lerp(new Color(base.backdrop[0]), 1 / 3);
    return { ...base, accent: `#${accent.getHexString()}`, hover: `#${hover.getHexString()}` };
  }, [snapshot]);
}
