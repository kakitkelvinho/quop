"use client";

// PROTOTYPE, throwaway: the floating bar that flips ?variant= on a page.

import { useEffect, useState } from "react";

/** the ?variant= key on this page, kept in the URL so it survives a reload */
export function useVariant<K extends string>(keys: readonly K[]): [K, (next: K) => void] {
  const [variant, setVariant] = useState<K>(keys[0]);
  useEffect(() => {
    const read = () => {
      const found = new URLSearchParams(window.location.search).get("variant");
      setVariant(keys.includes(found as K) ? (found as K) : keys[0]);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [keys]);
  const choose = (next: K) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState(window.history.state, "", url);
    setVariant(next);
  };
  return [variant, choose];
}

export default function PrototypeSwitcher<K extends string>({
  names,
  current,
  onChange,
}: {
  names: Record<K, string>;
  current: K;
  onChange: (next: K) => void;
}) {
  const keys = Object.keys(names) as K[];
  const step = (by: number) => onChange(keys[(keys.indexOf(current) + by + keys.length) % keys.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft" && event.altKey) step(-1);
      if (event.key === "ArrowRight" && event.altKey) step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 999,
        background: "#ff2d7a",
        color: "#fff",
        font: "600 13px/1 system-ui, sans-serif",
        boxShadow: "0 6px 20px rgba(0,0,0,.35)",
      }}
    >
      <button type="button" onClick={() => step(-1)} style={arrow} aria-label="Previous variant">
        ←
      </button>
      <span style={{ minWidth: 170, textAlign: "center" }}>
        PROTOTYPE · {current} ({names[current]})
      </span>
      <button type="button" onClick={() => step(1)} style={arrow} aria-label="Next variant">
        →
      </button>
    </div>
  );
}

const arrow = {
  border: 0,
  borderRadius: 999,
  width: 28,
  height: 28,
  background: "rgba(255,255,255,.2)",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
} as const;
