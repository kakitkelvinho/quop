"use client";

// PROTOTYPE: throwaway variant switcher for ?variant= UI prototypes. Not for main.

import { useCallback, useEffect, useSyncExternalStore } from "react";

const EVENT = "prototype-variant";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/** The ?variant= key. Ungated on the prototype branch so a static build shows it too. */
export function usePrototypeVariant(keys: readonly string[]): string | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get("variant"),
    () => null,
  );
  return raw && keys.includes(raw) ? raw : keys[0];
}

function setVariant(key: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("variant", key);
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(EVENT));
}

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: { key: string; name: string }[];
  current: string;
}) {
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );
  const step = useCallback(
    (by: number) => setVariant(variants[(index + by + variants.length) % variants.length].key),
    [index, variants],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (!event.altKey) return; // the table already uses bare arrows to nudge parts
      if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const v = variants[index];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        translate: "-50% 0",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 999,
        background: "#111",
        color: "#fff",
        font: "600 13px/1 system-ui, sans-serif",
        boxShadow: "0 8px 24px rgb(0 0 0 / 0.35)",
      }}
    >
      <button type="button" onClick={() => step(-1)} style={btn} aria-label="Previous variant">
        ←
      </button>
      <span style={{ minWidth: 190, textAlign: "center" }}>
        {v.key} · {v.name}
        <span style={{ opacity: 0.5, fontWeight: 400 }}> (⌥←/→)</span>
      </span>
      <button type="button" onClick={() => step(1)} style={btn} aria-label="Next variant">
        →
      </button>
    </div>
  );
}

const btn = {
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 999,
  background: "#333",
  color: "#fff",
  cursor: "pointer",
  font: "inherit",
} as const;
