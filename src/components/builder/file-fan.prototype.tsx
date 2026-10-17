"use client";

/*
 * PROTOTYPE, throwaway: what should the top-left Tabletop menu look like as a fan?
 * Three variants of a quarter fan opening from the window's top-left corner,
 * switchable via ?variant= on /builder/tabletop (plus "current", the old list):
 *   A  Corner wedges: one quarter ring, four labelled wedges
 *   B  Two tiers: inner ring = file (.json, .png), outer ring = table (example, clear)
 *   C  Bubble arc: round buttons on a quarter arc with name chips, no ring
 * Save / load JSON move into the JSON panel as floppy and folder buttons.
 */

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";

export const FAN_VARIANTS = [
  { key: "A", name: "Corner wedges" },
  { key: "B", name: "Two tiers" },
  { key: "C", name: "Bubble arc" },
  { key: "current", name: "Current list" },
];

type FanItem = {
  id: string;
  label: string;
  hint: string;
  icon: IconName;
  tier: "file" | "table";
  danger?: boolean;
  run: () => void;
};

type Point = [number, number];
// 0 rad along the window's top edge, π/2 down its left edge, y down
const polar = (r: number, a: number): Point => [r * Math.cos(a), r * Math.sin(a)];

function wedge(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

const QUARTER = Math.PI / 2;

/** Where the corner is, relative to the fan's containing block, and how far the island reaches from it. */
type Geometry = { left: number; top: number; clear: number };

function useCornerGeometry(rootRef: React.RefObject<HTMLDivElement | null>, islandRef: React.RefObject<HTMLElement | null>) {
  const [geo, setGeo] = useState<Geometry | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const root = rootRef.current;
      const island = islandRef.current;
      const stage = island?.offsetParent as HTMLElement | null;
      const box = root?.offsetParent as HTMLElement | null;
      if (!root || !island || !stage || !box) return;
      const c = stage.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const i = island.getBoundingClientRect();
      setGeo({
        left: c.left - b.left,
        top: c.top - b.top,
        clear: Math.hypot(i.right - c.left, i.bottom - c.top) + 8,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rootRef, islandRef]);
  return geo;
}

function useRoving(n: number, items: FanItem[], onClose: () => void) {
  const [focus, setFocus] = useState(0);
  const refs = useRef<(HTMLElement | SVGGElement | null)[]>([]);
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  const move = (to: number) => {
    const next = (to + n) % n;
    setFocus(next);
    refs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(focus - 1),
      ArrowUp: () => move(focus - 1),
      ArrowLeft: () => move(focus + 1),
      ArrowDown: () => move(focus + 1),
      Home: () => move(0),
      End: () => move(n - 1),
      Enter: () => items[focus].run(),
      " ": () => items[focus].run(),
      Escape: onClose,
    };
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    run();
  };
  return { focus, setFocus, refs, onKeyDown };
}

function Ring({
  items,
  geo,
  tiers,
  onClose,
}: {
  items: FanItem[];
  geo: Geometry;
  tiers: boolean;
  onClose: () => void;
}) {
  const { focus, setFocus, refs, onKeyDown } = useRoving(items.length, items, onClose);
  const r0 = geo.clear;
  // A: one ring of four; B: file ring inside, table ring outside
  const bands = tiers
    ? {
        file: [r0, r0 + 78] as const,
        table: [r0 + 82, r0 + 150] as const,
      }
    : { file: [r0, r0 + 118] as const, table: [r0, r0 + 118] as const };
  const outer = tiers ? r0 + 150 : r0 + 118;
  const layout = items.map((item, index) => {
    const group = tiers ? items.filter((it) => it.tier === item.tier) : items;
    const k = group.indexOf(item);
    const step = QUARTER / group.length;
    const [b0, b1] = bands[item.tier];
    return { item, index, a0: k * step, a1: (k + 1) * step, b0, b1 };
  });

  return (
    <svg
      className="fileFan__svg"
      width={outer + 12}
      height={outer + 12}
      viewBox={`0 0 ${outer + 12} ${outer + 12}`}
      role="menu"
      aria-label="Tabletop"
      onKeyDown={onKeyDown}
    >
      {tiers ? (
        <>
          <path className="fileFan__band" d={wedge(bands.file[0] - 2, bands.file[1] + 2, 0, QUARTER)} />
          <path className="fileFan__band is-table" d={wedge(bands.table[0] - 2, bands.table[1] + 2, 0, QUARTER)} />
        </>
      ) : null}
      {layout.map(({ item, index, a0, a1, b0, b1 }) => {
        const mid = (a0 + a1) / 2;
        const thick = b1 - b0;
        const [ix, iy] = polar(b0 + thick * (tiers ? 0.32 : 0.3), mid);
        const [nx, ny] = polar(b0 + thick * (tiers ? 0.68 : 0.6), mid);
        return (
          <g
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            className={`fileFan__seg${item.danger ? " is-danger" : ""}${item.tier === "table" ? " is-table" : ""}`}
            style={{ animationDelay: `${index * 40}ms` }}
            role="menuitem"
            aria-label={item.label}
            tabIndex={index === focus ? 0 : -1}
            onFocus={() => setFocus(index)}
            onClick={item.run}
          >
            <title>{item.hint}</title>
            <path className="fileFan__wedge" d={wedge(b0, b1, a0, a1)} />
            <g transform={`translate(${ix - 11} ${iy - 11})`}>
              <Icon name={item.icon} size={22} />
            </g>
            <text className="fileFan__name" x={nx} y={ny} textAnchor="middle" dominantBaseline="central">
              {item.label}
            </text>
            {tiers ? null : (
              <text className="fileFan__hint" x={nx} y={ny + 15} textAnchor="middle" dominantBaseline="central">
                {item.hint}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Bubbles({ items, geo, onClose }: { items: FanItem[]; geo: Geometry; onClose: () => void }) {
  const { focus, setFocus, refs, onKeyDown } = useRoving(items.length, items, onClose);
  const r = geo.clear + 34;
  const n = items.length;
  return (
    <div className="fileFan__bubbles" role="menu" aria-label="Tabletop" onKeyDown={onKeyDown}>
      <svg className="fileFan__guide" width={r + 40} height={r + 40} aria-hidden="true">
        <path d={`M${r} 0A${r} ${r} 0 0 1 0 ${r}`} />
      </svg>
      {items.map((item, index) => {
        // spread over the quarter, clear of the two window edges
        const a = 0.2 + (index * (QUARTER - 0.4)) / (n - 1);
        const [x, y] = polar(r, a);
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="menuitem"
            className={`fileFan__bubble${item.danger ? " is-danger" : ""}`}
            style={{ left: x, top: y, animationDelay: `${index * 45}ms` }}
            tabIndex={index === focus ? 0 : -1}
            title={item.hint}
            onFocus={() => setFocus(index)}
            onClick={item.run}
          >
            <span className="fileFan__dot">
              <Icon name={item.icon} size={20} />
            </span>
            <span className="fileFan__chip">
              {item.label}
              <small>{item.hint}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FileFanMenu({
  variant,
  islandRef,
  onShowJson,
  onExportPng,
  onResetExample,
  onClear,
  trigger,
}: {
  variant: string;
  islandRef: React.RefObject<HTMLElement | null>;
  onShowJson: () => void;
  onExportPng: () => void;
  onResetExample: () => void;
  onClear: () => void;
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => setOpen(false);
  const pick = (action: () => void) => () => {
    action();
    close();
  };
  const items: FanItem[] = [
    { id: "json", label: ".json", hint: "Save, load, edit", icon: "braces", tier: "file", run: pick(onShowJson) },
    { id: "png", label: ".png", hint: "Export the view", icon: "image", tier: "file", run: pick(onExportPng) },
    { id: "example", label: "Example", hint: "Load the example", icon: "example", tier: "table", run: pick(onResetExample) },
    { id: "clear", label: "Clear", hint: "Empty the table", icon: "trash", tier: "table", danger: true, run: pick(onClear) },
  ];

  return (
    <div className="builderMenu" ref={ref}>
      <style>{CSS}</style>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open ? <FanBody variant={variant} items={items} islandRef={islandRef} onClose={close} /> : null}
    </div>
  );
}

function FanBody({
  variant,
  items,
  islandRef,
  onClose,
}: {
  variant: string;
  items: FanItem[];
  islandRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const geo = useCornerGeometry(rootRef, islandRef);
  return (
    <div
      ref={rootRef}
      className={`fileFan fileFan--${variant}`}
      style={geo ? { left: geo.left, top: geo.top } : { visibility: "hidden" }}
    >
      {geo && variant === "C" ? <Bubbles items={items} geo={geo} onClose={onClose} /> : null}
      {geo && variant !== "C" ? <Ring items={items} geo={geo} tiers={variant === "B"} onClose={onClose} /> : null}
    </div>
  );
}

const CSS = `
.fileFan {
  position: absolute;
  z-index: 50;
  pointer-events: none;
}
.fileFan__svg {
  display: block;
  overflow: visible;
  filter: drop-shadow(0 14px 22px rgb(31 41 51 / 0.16));
  transform-origin: 0 0;
  animation: fileFanOpen 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
html[data-theme="dark"] .fileFan__svg { filter: drop-shadow(0 18px 28px rgb(0 0 0 / 0.55)); }
.fileFan__band { fill: var(--surface-strong); stroke: var(--border); pointer-events: auto; }
.fileFan__band.is-table { fill: var(--background-muted); }
.fileFan__seg {
  color: var(--muted);
  outline: none;
  cursor: pointer;
  pointer-events: auto;
  animation: fileFanFade 260ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
}
.fileFan__wedge {
  fill: var(--surface-strong);
  stroke: var(--surface-strong);
  stroke-width: 3;
  transition: fill 120ms ease;
}
.fileFan--B .fileFan__seg.is-table .fileFan__wedge { fill: var(--background-muted); stroke: var(--background-muted); }
.fileFan--B .fileFan__wedge { stroke-width: 4; }
.fileFan__name { fill: currentColor; font-size: 12px; font-weight: 700; font-family: var(--font-mono); }
.fileFan__seg.is-table .fileFan__name { font-family: inherit; }
.fileFan__hint { fill: currentColor; font-size: 9.5px; font-weight: 500; opacity: 0.75; }
.fileFan__seg:hover, .fileFan__seg:focus-visible { color: var(--accent-strong); }
.fileFan__seg:hover .fileFan__wedge,
.fileFan__seg:focus-visible .fileFan__wedge { fill: color-mix(in srgb, var(--accent) 14%, var(--surface-strong)); }
.fileFan__seg.is-danger:hover, .fileFan__seg.is-danger:focus-visible { color: #c2410c; }
.fileFan__seg.is-danger:hover .fileFan__wedge,
.fileFan__seg.is-danger:focus-visible .fileFan__wedge { fill: color-mix(in srgb, #ea580c 14%, var(--surface-strong)); }
.fileFan__seg:focus-visible .fileFan__wedge { stroke: var(--focus-ring); stroke-width: 2.5; }

.fileFan__bubbles { position: relative; }
.fileFan__guide { position: absolute; left: 0; top: 0; overflow: visible; animation: fileFanFade 300ms ease backwards; }
.fileFan__guide path { fill: none; stroke: var(--border); stroke-width: 1.5; stroke-dasharray: 3 5; }
.fileFan__bubble {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--foreground);
  font: inherit;
  translate: -22px -22px;
  cursor: pointer;
  pointer-events: auto;
  outline: none;
  animation: fileFanPop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}
.fileFan__dot {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-strong);
  box-shadow: var(--shadow);
  color: var(--muted);
  transition: background 120ms ease, color 120ms ease, transform 120ms ease;
}
.fileFan__chip {
  display: grid;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 0.55rem;
  background: var(--surface-strong);
  box-shadow: var(--shadow);
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
}
.fileFan__chip small { color: var(--muted); font-size: 0.66rem; font-weight: 500; }
.fileFan__bubble:hover .fileFan__dot,
.fileFan__bubble:focus-visible .fileFan__dot { background: var(--accent-soft); color: var(--accent-strong); transform: scale(1.08); }
.fileFan__bubble:focus-visible .fileFan__dot { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.fileFan__bubble.is-danger:hover .fileFan__dot,
.fileFan__bubble.is-danger:focus-visible .fileFan__dot { background: color-mix(in srgb, #ea580c 16%, var(--surface-strong)); color: #c2410c; }

.builderJson__icons { display: flex; gap: 0.15rem; margin-left: auto; }

@keyframes fileFanOpen { from { opacity: 0; transform: scale(0.6) rotate(-8deg); } }
@keyframes fileFanFade { from { opacity: 0; } }
@keyframes fileFanPop { from { opacity: 0; translate: -60px -60px; scale: 0.4; } }
@media (prefers-reduced-motion: reduce) {
  .fileFan__svg, .fileFan__seg, .fileFan__bubble, .fileFan__guide { animation: none; }
}
`;
