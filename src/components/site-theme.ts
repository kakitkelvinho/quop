"use client";

import { useCallback, useSyncExternalStore } from "react";

export const SITE_THEMES = ["station", "2001", "blueprint"] as const;
export type SiteTheme = (typeof SITE_THEMES)[number];
export const SITE_THEME_NAMES: Record<SiteTheme, string> = { station: "Station", "2001": "2001", blueprint: "Blueprint" };

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getTheme(): SiteTheme {
  const theme = document.documentElement.dataset.theme;
  return theme === "2001" || theme === "blueprint" ? theme : "station";
}

/** Theme belongs to the browser, not to a saved Setup. The root layout restores it on every page. */
export function useTheme(): [SiteTheme, (theme: SiteTheme) => void] {
  const theme = useSyncExternalStore(subscribe, getTheme, (): SiteTheme => "station");
  const setTheme = useCallback((next: SiteTheme) => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("site-theme", next); } catch { /* storage can be unavailable */ }
  }, []);
  return [theme, setTheme];
}
