"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// PROTOTYPE tooling: flips ?variant= on the current route. Never ships.
export function PrototypeSwitcher({ variants }: { variants: { key: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = variants.find((v) => v.key === params.get("variant")) ?? variants[0];
  const index = variants.indexOf(current);

  const go = (step: number) => {
    const next = variants[(index + step + variants.length) % variants.length];
    const query = new URLSearchParams(params.toString());
    query.set("variant", next.key);
    router.replace(`${pathname}?${query}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (!event.altKey) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "6.4rem",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.25rem",
        borderRadius: 999,
        background: "#ff0",
        color: "#000",
        boxShadow: "0 4px 18px rgb(0 0 0 / 35%)",
        font: "600 13px/1 system-ui, sans-serif",
        letterSpacing: 0,
        textTransform: "none",
        textShadow: "none",
      }}
    >
      <button type="button" onClick={() => go(-1)} style={buttonStyle} aria-label="Previous variant">
        ←
      </button>
      <span style={{ padding: "0 0.5rem", whiteSpace: "nowrap" }}>
        {current.key} ({current.name})
      </span>
      <button type="button" onClick={() => go(1)} style={buttonStyle} aria-label="Next variant">
        →
      </button>
    </div>
  );
}

const buttonStyle = {
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 999,
  background: "#000",
  color: "#ff0",
  cursor: "pointer",
  font: "inherit",
} as const;
