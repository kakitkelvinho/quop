"use client";

// PROTOTYPE — throwaway variant switcher. Never ships: hidden in production.
import { useEffect } from "react";

import {
  PROTOTYPE_VARIANTS,
  setPrototypeVariant,
  usePrototypeVariant,
} from "@/components/builder/prototype-variant";

export default function PrototypeSwitcher() {
  const current = usePrototypeVariant();
  const index = PROTOTYPE_VARIANTS.findIndex((v) => v.key === current);
  const n = PROTOTYPE_VARIANTS.length;
  const step = (delta: number) =>
    setPrototypeVariant(PROTOTYPE_VARIANTS[(index + delta + n) % n].key);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.closest("input, textarea, select") || target.isContentEditable)
      )
        return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  const button: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
    padding: "4px 10px",
  };
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
        gap: 4,
        padding: "6px 8px",
        borderRadius: 999,
        background: "#111",
        color: "#fff",
        font: "600 13px/1.2 ui-monospace, monospace",
        boxShadow: "0 6px 24px rgba(0,0,0,.35)",
      }}
    >
      <button style={button} onClick={() => step(-1)} aria-label="Previous">
        ←
      </button>
      <span style={{ minWidth: 260, textAlign: "center" }}>
        {current} ({PROTOTYPE_VARIANTS[index].name})
      </span>
      <button style={button} onClick={() => step(1)} aria-label="Next">
        →
      </button>
    </div>
  );
}
