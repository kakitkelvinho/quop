"use client";

// PROTOTYPE — throwaway. Where should the matplotlib / Chart.js style toggle live?
// Four variants on the real plotter pages, switched with ?variant=A|B|C|D:
//   A  Customize menu → Style → dropdown (what PR #48 ships)
//   B  one-click icon button in the chart footer, beside dark mode
//   C  segmented pill over the chart's top-right corner
//   D  one page-level strip above everything ("Chart style" for the whole page)
// Lives on branch prototype/chart-style-toggle; do not merge.

import { useEffect, useSyncExternalStore } from "react";

import {
  CHART_STYLE_LABELS,
  setChartStyle,
  useChartStyle,
  type ChartStyle,
} from "@/components/plotters/chart-style";

import "./chart-style-toggle.prototype.css";

export const VARIANTS = {
  A: "Customize menu dropdown (current)",
  B: "Footer icon button",
  C: "Corner pill on the chart",
  D: "Page-level strip",
} as const;
export type Variant = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as Variant[];

const listeners = new Set<() => void>();

function readVariant(): Variant {
  const value = new URLSearchParams(window.location.search).get("variant");
  return KEYS.includes(value as Variant) ? (value as Variant) : "A";
}

export function useVariant(): Variant {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      window.addEventListener("popstate", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("popstate", onChange);
      };
    },
    readVariant,
    () => "A",
  );
}

function goTo(variant: Variant) {
  const url = new URL(window.location.href);
  url.searchParams.set("variant", variant);
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((listener) => listener());
}

function step(from: Variant, by: number) {
  goTo(KEYS[(KEYS.indexOf(from) + by + KEYS.length) % KEYS.length]);
}

const STYLES = Object.keys(CHART_STYLE_LABELS) as ChartStyle[];

function Segmented({ className }: { className: string }) {
  const style = useChartStyle();
  return (
    <div className={className} role="radiogroup" aria-label="Chart style">
      {STYLES.map((option) => (
        <button
          aria-checked={style === option}
          className={style === option ? "is-on" : ""}
          key={option}
          onClick={() => setChartStyle(option)}
          role="radio"
          type="button"
        >
          {CHART_STYLE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

/** C: sits inside the chart stage, top-right. */
export function CornerStylePill() {
  return <Segmented className="styleProto__corner" />;
}

/** B: a footer icon button that flips between the two looks. */
export function FooterStyleButton() {
  const style = useChartStyle();
  const next: ChartStyle = style === "matplotlib" ? "chartjs" : "matplotlib";
  return (
    <button
      aria-label={`Switch every chart to the ${CHART_STYLE_LABELS[next]} style`}
      className="interactiveChart__iconButton styleProto__footerButton"
      onClick={() => setChartStyle(next)}
      title={`Style: ${CHART_STYLE_LABELS[style]} (click for ${CHART_STYLE_LABELS[next]})`}
      type="button"
    >
      <span className="styleProto__footerGlyph">{style === "matplotlib" ? "mpl" : "cjs"}</span>
    </button>
  );
}

/** D: one strip per page, above the plotter. Mounted by the plotters layout. */
function PageStyleStrip() {
  return (
    <div className="styleProto__strip">
      <span>Chart style</span>
      <Segmented className="styleProto__stripSegment" />
      <small>applies to every chart; exports follow it</small>
    </div>
  );
}

function Switcher({ variant }: { variant: Variant }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(variant, -1);
      if (event.key === "ArrowRight") step(variant, 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  return (
    <div className="styleProto__switcher">
      <button aria-label="Previous variant" onClick={() => step(variant, -1)} type="button">
        ←
      </button>
      <span>
        {variant} ({VARIANTS[variant]})
      </span>
      <button aria-label="Next variant" onClick={() => step(variant, 1)} type="button">
        →
      </button>
    </div>
  );
}

/** Mounted once in app/plotters/layout.tsx. */
export function ChartStylePrototypeChrome({ children }: { children: React.ReactNode }) {
  const variant = useVariant();
  const show = process.env.NODE_ENV !== "production";
  return (
    <>
      {show && variant === "D" ? <PageStyleStrip /> : null}
      {children}
      {show ? <Switcher variant={variant} /> : null}
    </>
  );
}
