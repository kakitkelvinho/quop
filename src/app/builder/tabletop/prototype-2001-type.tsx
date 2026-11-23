"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { PrototypeSwitcher } from "@/components/prototype-switcher";

// PROTOTYPE, throwaway: which faces replace Michroma in the 2001 look.
// Pick the 2001 look in the status bar, then flip ?variant=A..F (Alt+←/→).
// Styles are in prototype-2001-type.css, keyed on html[data-proto-type].
const variants = [
  { key: "A", name: "Now: Michroma + Jost" },
  { key: "B", name: "Gill labels + Futura titles" },
  { key: "C", name: "Gill only, Cond readouts" },
  { key: "D", name: "Gill, quiet mixed case" },
  { key: "E", name: "C in real Gill Sans (Mac)" },
  { key: "F", name: "Gill words, Archivo numbers" },
];

export function Prototype2001Type() {
  const variant = useSearchParams().get("variant") ?? "A";

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.protoType = variant;
    return () => {
      delete root.dataset.protoType;
    };
  }, [variant]);

  if (process.env.NODE_ENV === "production") return null;
  return <PrototypeSwitcher variants={variants} />;
}
