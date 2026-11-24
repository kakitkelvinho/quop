"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { PrototypeSwitcher } from "@/components/prototype-switcher";

// PROTOTYPE, throwaway: space-age touches on the 2001 theme, picked by
// ?variant= (Alt+←/→). Pick the 2001 theme in the status bar first. Verdicts so far:
// HAL eyes, acrylic slides and Archivo Narrow long text in; zigzag bands out.
const variants = [
  { key: "A", name: "2001 now" },
  { key: "B", name: "HAL eyes, slides, Archivo Narrow text" },
  { key: "C", name: "B + yellow trace ring" },
  { key: "D", name: "B + phosphor-white trace ring" },
];
const flags: Record<string, string | undefined> = {
  B: "eye slides prose",
  C: "eye slides prose trace",
  D: "eye slides prose tracewhite",
};

export function Prototype2001Switch() {
  const variant = useSearchParams().get("variant") ?? "A";

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.protoType = "F";
    const on = flags[variant];
    if (on) root.dataset.proto2001 = on;
    else delete root.dataset.proto2001;
    return () => {
      delete root.dataset.protoType;
      delete root.dataset.proto2001;
    };
  }, [variant]);

  if (process.env.NODE_ENV === "production") return null;
  return <PrototypeSwitcher variants={variants} />;
}
