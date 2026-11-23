"use client";

import { useCallback, useLayoutEffect, useState } from "react";

/**
 * The Tabletop's look, beside day / night: Station is the site's own; 2001
 * swaps the HUD to flat dark screens and the scene to its own palette, with no
 * change of shape. A viewer setting, so it is kept per browser and never saved
 * into a setup.
 */
export const BUILDER_LOOKS = ["station", "2001"] as const;
export type BuilderLook = (typeof BUILDER_LOOKS)[number];
export const BUILDER_LOOK_NAMES: Record<BuilderLook, string> = { station: "Station", "2001": "2001" };

const STORAGE_KEY = "builder-look";

function readLook(): BuilderLook {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return BUILDER_LOOKS.find((look) => look === saved) ?? "station";
  } catch {
    return "station";
  }
}

/**
 * The look is written to `data-look` on <html>, not a wrapper, because coach
 * marks and menus are portalled out of the workspace, and the scene palette
 * watches the attribute. It is removed when the Tabletop unmounts, so the rest
 * of the site stays Station.
 */
export function useBuilderLook(): [BuilderLook, (look: BuilderLook) => void] {
  const [look, setLookState] = useState<BuilderLook>(readLook);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (look === "station") delete root.dataset.look;
    else root.dataset.look = look;
    return () => {
      delete root.dataset.look;
    };
  }, [look]);

  const setLook = useCallback((next: BuilderLook) => {
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* storage can be unavailable */ }
    setLookState(next);
  }, []);

  return [look, setLook];
}
