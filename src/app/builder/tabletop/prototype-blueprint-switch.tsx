"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { PrototypeSwitcher } from "@/components/prototype-switcher";

// PROTOTYPE, throwaway: the Blueprint look, picked by ?variant= (Alt+←/→).
// The HUD keeps the 2001 type verdict (F). Scene styles are in
// src/components/builder/prototype-blueprint.tsx, HUD styles in
// prototype-blueprint.css.
const variants = [
  { key: "A", name: "2001, lit (reference)" },
  { key: "B", name: "Blueprint, night: deep blue" },
  { key: "C", name: "Blueprint, day: assembly drawing" },
];

export function PrototypeBlueprintSwitch() {
  const variant = useSearchParams().get("variant") ?? "A";

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.protoType = "F";
    if (variant === "A") delete root.dataset.protoBlueprint;
    else root.dataset.protoBlueprint = variant;
    return () => {
      delete root.dataset.protoType;
      delete root.dataset.protoBlueprint;
    };
  }, [variant]);

  if (process.env.NODE_ENV === "production") return null;
  return <PrototypeSwitcher variants={variants} />;
}
