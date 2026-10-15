"use client";

// PROTOTYPE, throwaway: which font for a beam's distance labels?
// Switch with ?distanceFont=sans|garamond|medium|medium-bare|plexmono|condensed (dev only),
// or the bar at the bottom of the Tabletop. Plex Mono and Plex Sans Condensed
// load from jsDelivr here; the winner, if it's one of those, ships as a local file.

import { useEffect, useState } from "react";

const VARIANTS = [
  ["sans", "Plex Sans bold (now)"],
  ["garamond", "Garamond italic"],
  ["medium", "Plex Sans medium"],
  ["medium-bare", "Plex Sans medium, no outline"],
  ["plexmono", "Plex Mono"],
  ["condensed", "Plex Sans Condensed"],
] as const;
type Key = (typeof VARIANTS)[number][0];

const CDN = "https://cdn.jsdelivr.net/npm/@fontsource";

function stepped(key: Key, by: number): Key {
  const index = VARIANTS.findIndex(([k]) => k === key);
  return VARIANTS[(index + by + VARIANTS.length) % VARIANTS.length][0];
}

export function DistanceFontPrototype() {
  const [key, setKey] = useState<Key | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const value = new URLSearchParams(window.location.search).get("distanceFont");
    // read after hydration: the page is static, so the URL isn't known at build time
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(VARIANTS.some(([k]) => k === value) ? (value as Key) : "sans");
  }, []);

  useEffect(() => {
    if (!key) return;
    document.documentElement.dataset.distanceFont = key;
    const url = new URL(window.location.href);
    url.searchParams.set("distanceFont", key);
    window.history.replaceState(null, "", url);
  }, [key]);

  useEffect(() => {
    if (!key) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        const by = event.key === "ArrowRight" ? 1 : -1;
        setKey((current) => (current ? stepped(current, by) : current));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);

  if (!key) return null;
  const index = VARIANTS.findIndex(([k]) => k === key);
  const step = (by: number) => setKey(stepped(key, by));

  return (
    <>
      <style>{CSS}</style>
      <div className="protoFontBar" role="toolbar" aria-label="Distance font prototype">
        <button type="button" onClick={() => step(-1)} aria-label="Previous font">‹</button>
        <span>
          <b>{index + 1}/{VARIANTS.length}</b> {VARIANTS[index][1]}
        </span>
        <button type="button" onClick={() => step(1)} aria-label="Next font">›</button>
        <span className="protoFontBar__sample builderDistance">1 250 mm</span>
      </div>
    </>
  );
}

const CSS = `
@font-face { font-family: "Proto Plex Mono"; font-weight: 600; src: url(${CDN}/ibm-plex-mono@5.2.5/files/ibm-plex-mono-latin-600-normal.woff2) format("woff2"); }
@font-face { font-family: "Proto Plex Sans Condensed"; font-weight: 600; src: url(${CDN}/ibm-plex-sans-condensed@5.2.5/files/ibm-plex-sans-condensed-latin-600-normal.woff2) format("woff2"); }

/* Garamond's x-height is small and its default figures dip, so: a size up, lining figures */
html[data-distance-font="garamond"] .builderDistance {
  font-family: var(--font-serif); font-style: italic; font-weight: 500;
  font-size: calc(0.7rem * var(--label-size, 1)); letter-spacing: 0;
  font-variant-numeric: lining-nums tabular-nums;
}
html[data-distance-font="medium"] .builderDistance { font-weight: 500; }
html[data-distance-font="medium-bare"] .builderDistance { font-weight: 500; text-shadow: none; }
html[data-distance-font="plexmono"] .builderDistance {
  font-family: "Proto Plex Mono", var(--font-mono); font-weight: 600; letter-spacing: 0;
}
html[data-distance-font="condensed"] .builderDistance {
  font-family: "Proto Plex Sans Condensed", var(--font-sans); font-weight: 600; letter-spacing: 0.01em;
}

.protoFontBar {
  position: fixed; z-index: 10000; left: 50%; bottom: 1rem; transform: translateX(-50%);
  display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.8rem; border-radius: 999px;
  background: #111; color: #fff; font: 600 0.8rem/1 var(--font-sans); box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}
.protoFontBar button { border: 0; background: none; color: inherit; font: inherit; cursor: pointer; padding: 0.2rem 0.35rem; }
.protoFontBar button:hover { color: #ffd99d; }
.protoFontBar__sample { color: #ffd99d; text-shadow: none !important; font-size: 0.95rem !important; }
`;
