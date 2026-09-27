"use client";

// PROTOTYPE — throwaway. The floating ?variant= switcher for the new-parts
// prototype on /experiment/builder. Never shown in a production build.

import { useCallback, useEffect, useState } from "react";

import {
  PROTOTYPE_VARIANTS,
  type PrototypeVariantKey,
} from "@/components/builder/component-models.prototype";
import {
  createBeamId,
  createComponentId,
  defaultHeight,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
} from "@/components/builder/types";

function readVariant(): PrototypeVariantKey {
  const key = new URLSearchParams(window.location.search).get("variant");
  return PROTOTYPE_VARIANTS.find((variant) => variant.key === key)?.key ?? "A";
}

export function usePrototypeVariant() {
  const [variant, setVariant] = useState<PrototypeVariantKey>(readVariant);
  const change = useCallback((next: PrototypeVariantKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState(window.history.state, "", url);
    setVariant(next);
  }, []);
  return [variant, change] as const;
}

export function PrototypeSwitcher({
  variant,
  onChange,
  keysEnabled,
  onShowcase,
}: {
  variant: PrototypeVariantKey;
  onChange: (variant: PrototypeVariantKey) => void;
  /** ← → also nudge a selected part, so they only switch with nothing selected */
  keysEnabled: boolean;
  onShowcase: () => void;
}) {
  const index = PROTOTYPE_VARIANTS.findIndex((entry) => entry.key === variant);
  const step = useCallback(
    (direction: 1 | -1) => {
      const count = PROTOTYPE_VARIANTS.length;
      onChange(PROTOTYPE_VARIANTS[(index + direction + count) % count].key);
    },
    [index, onChange],
  );

  useEffect(() => {
    if (!keysEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keysEnabled, step]);

  if (process.env.NODE_ENV === "production") return null;

  const current = PROTOTYPE_VARIANTS[index];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 999,
        background: "#111",
        color: "#fff",
        font: "600 13px/1 system-ui, sans-serif",
        boxShadow: "0 6px 20px rgba(0,0,0,.35)",
        border: "2px dashed #f5c518",
      }}
    >
      <button type="button" onClick={() => step(-1)} style={pill} aria-label="Previous variant">
        ←
      </button>
      <span style={{ minWidth: 170, textAlign: "center" }}>
        PROTOTYPE {current.key} ({current.name})
      </span>
      <button type="button" onClick={() => step(1)} style={pill} aria-label="Next variant">
        →
      </button>
      <button type="button" onClick={onShowcase} style={{ ...pill, width: "auto", padding: "0 10px" }}>
        + showcase row
      </button>
    </div>
  );
}

/**
 * One row of every prototyped part at z = +300, with a beam through it, so
 * each variant can be judged on a populated bench. One undo step.
 */
export function withShowcaseRow(scene: BuilderSceneData): BuilderSceneData {
  const z = 300;
  const part = (
    type: ComponentType,
    x: number,
    extra: Partial<BuilderComponent> = {},
    dz = 0,
  ): BuilderComponent => ({
    id: createComponentId(type),
    type,
    position: [x, defaultHeight(type), z + dz],
    rotation: 0,
    ...extra,
  });
  const parts = [
    part("laser-source", -500, { label: "Showcase" }),
    part("aom", -375),
    part("eom", -275),
    part("beam-splitter", -175, { label: "PBS" }),
    part("block", -100, { label: "Faraday", size: [40, 36, 36], color: "#3b4a6b" }),
    part("beam-splitter", -25, { label: "PBS" }),
    part("lens", 50, { lensShape: "biconvex", focalLength: 50 }),
    part("lens", 125, { lensShape: "biconvex", focalLength: 150 }),
    part("objective", 200, { label: "100x / 1.3" }),
    part("particle", 250, { color: "#6fa8ff", particleRadius: 4, label: "SiO₂" }),
    part("photodiode", 325),
    part("beam-block", -175, { rotation: 270 }, 100),
    part("photodiode", 400, { color: "#1f9d55", label: "PD green" }),
  ];
  const main = parts.slice(0, 11).map((component) => component.id);
  return {
    ...scene,
    components: [...scene.components, ...parts],
    beams: [
      ...scene.beams,
      { id: createBeamId(), path: main, color: "#dc2626", label: "Showcase" },
      { id: createBeamId(), path: [parts[3].id, parts[11].id], color: "#dc2626", label: "Dump" },
    ],
  };
}

const pill: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "none",
  background: "#333",
  color: "#fff",
  cursor: "pointer",
  font: "inherit",
};
