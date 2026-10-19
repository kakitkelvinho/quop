"use client";

// PROTOTYPE: throwaway HUD surface languages (?variant=current|A|B|C|D). Not for main.
// D is also a layout: one + fan, one ? fan, one camera fan, undo/redo, and a
// panel rail that is always there.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Icon, type IconName } from "@/components/builder/builder-icons";
import { polar, wedge } from "@/components/builder/ring-geometry";
import { useBubbleDismiss } from "@/components/builder/use-bubble-dismiss";
import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";
import "./hud-style.prototype.css";

const VARIANTS = [
  { key: "current", name: "Current: lifted, soft" },
  { key: "A", name: "Flat: no shadow or blur" },
  { key: "B", name: "Flat + hard-edged" },
  { key: "C", name: "Signal: black plates, one red" },
  { key: "D", name: "Minimal: B, oxblood, grouped" },
];
const KEYS = VARIANTS.map((v) => v.key);

export function useHudVariant() {
  return usePrototypeVariant(KEYS);
}

export function HudStylePrototype() {
  const variant = useHudVariant();

  useEffect(() => {
    const root = document.documentElement;
    if (variant && variant !== "current") root.dataset.hud = variant;
    else delete root.dataset.hud;
    return () => {
      delete root.dataset.hud;
    };
  }, [variant]);

  return variant ? <PrototypeSwitcher variants={VARIANTS} current={variant} /> : null;
}

/* ---------- a quarter fan from a corner of the workspace ---------- */

export type ProtoFanItem = {
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
  disabled?: boolean;
  active?: boolean;
};

type Corner = "tl" | "tr" | "br";
// each corner's quarter, as the angle it starts at (0 = right, clockwise on screen)
const START: Record<Corner, number> = { tl: 0, tr: Math.PI / 2, br: Math.PI };
// the same ring as the file fan in D: the gap past what it clears, its band, its floor
const GAP = 8;
const EDGE = 8;
const BAND = 150;
const LEAST = 64;
const PAD = 6;
const ICON = 24;
// half the gap between petals, at the hole: it widens outward, as petals do
export const PETAL_GAP = 3;

type Geo = { left: number; top: number; inner: number; outer: number };

/**
 * Measure the corner: its hole clears every island in `clearOf` (so the + fan
 * and the QUOP fan lie on the same ring), and the band is the file fan's.
 */
function useCorner(rootRef: RefObject<HTMLDivElement | null>, corner: Corner, clearOf: string, open: boolean) {
  const [geo, setGeo] = useState<Geo | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const root = rootRef.current;
      const stage = root?.closest<HTMLElement>(".builderWorkspace");
      const box = root;
      if (!root || !stage || !box) return;
      const s = stage.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const cx = corner === "tl" ? s.left : s.right;
      const cy = corner === "br" ? s.bottom : s.top;
      let clear = 0;
      stage.querySelectorAll<HTMLElement>(clearOf).forEach((element) => {
        const r = element.getBoundingClientRect();
        const fx = corner === "tl" ? r.right : r.left;
        const fy = corner === "br" ? r.top : r.bottom;
        clear = Math.max(clear, Math.hypot(fx - cx, fy - cy));
      });
      clear += GAP;
      const room = Math.min(s.width, s.height) - EDGE;
      const band = Math.max(LEAST, Math.min(BAND, room - clear));
      setGeo({ left: cx - b.left, top: cy - b.top, inner: clear, outer: clear + band });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rootRef, corner, clearOf, open]);
  return open ? geo : null;
}

export function ProtoFan({
  icon,
  label,
  corner,
  clearOf,
  items,
  active,
  onTrigger,
}: {
  icon: IconName;
  label: string;
  corner: Corner;
  /** the islands the hole must clear, as a selector */
  clearOf: string;
  items: ProtoFanItem[];
  /** the trigger lights while something it started is live */
  active?: boolean;
  /** runs instead of opening, when it returns true (e.g. cancel a live mode) */
  onTrigger?: () => boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useBubbleDismiss(open, close);
  const itemRefs = useRef<(SVGGElement | null)[]>([]);
  const [focus, setFocus] = useState(0);
  const geo = useCorner(ref, corner, clearOf, open);
  const n = items.length;
  const step = Math.PI / 2 / n;

  useEffect(() => {
    if (geo) itemRefs.current[0]?.focus();
  }, [geo]);

  const move = (to: number) => {
    const next = (to + n) % n;
    setFocus(next);
    itemRefs.current[next]?.focus();
  };
  const runItem = (item: ProtoFanItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.run();
  };
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(focus + 1),
      ArrowRight: () => move(focus + 1),
      ArrowUp: () => move(focus - 1),
      ArrowLeft: () => move(focus - 1),
      Enter: () => runItem(items[focus]),
      " ": () => runItem(items[focus]),
      Escape: close,
    };
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    run();
  };

  let ring = null;
  if (geo) {
    const { inner, outer } = geo;
    const size = outer + PAD;
    // the svg's origin is the corner; its box runs from the corner inward
    const vx = corner === "tl" ? -PAD : -outer;
    const vy = corner === "br" ? -outer : -PAD;
    const band = outer - inner;
    const inset = PETAL_GAP / inner;
    ring = (
      <div
        className="fileFan protoFan__layer"
        style={{ left: geo.left + vx, top: geo.top + vy }}
      >
        <svg
          className={`fileFan__ring protoFan__ring protoFan__ring--${corner}`}
          role="menu"
          aria-label={label}
          viewBox={`${vx} ${vy} ${size} ${size}`}
          width={size}
          height={size}
          onKeyDown={onKeyDown}
        >
          {items.map((item, i) => {
            const a0 = START[corner] + i * step;
            const a1 = a0 + step;
            const mid = (a0 + a1) / 2;
            const [ix, iy] = polar(inner + band * 0.3, mid);
            const [nx, ny] = polar(inner + band * 0.68, mid);
            return (
              <g
                key={item.id}
                ref={(node) => {
                  itemRefs.current[i] = node;
                }}
                className={`fileFan__item${item.disabled ? " is-disabled" : ""}${item.active ? " is-on" : ""}`}
                style={{ animationDelay: `${30 + i * 30}ms` }}
                role="menuitem"
                aria-label={item.label}
                aria-disabled={item.disabled}
                tabIndex={i === focus ? 0 : -1}
                onFocus={() => setFocus(i)}
                onClick={() => runItem(item)}
              >
                <path className="fileFan__wedge" d={wedge(inner, outer, a0 + inset, a1 - inset)} />
                <g transform={`translate(${ix - ICON / 2} ${iy - ICON / 2})`}>
                  <Icon name={item.icon} size={ICON} />
                </g>
                <text className="fileFan__name" x={nx} y={ny} textAnchor="middle" dominantBaseline="central">
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className="protoFan" ref={ref}>
      <button
        type="button"
        className={`builderIconBtn${active || open ? " is-active" : ""}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={() => {
          if (onTrigger?.()) return;
          setOpen((current) => !current);
        }}
      >
        <Icon name={icon} />
      </button>
      {ring}
    </div>
  );
}

/* ---------- the panel rail: the same slots every time ---------- */

export type RailSlot = {
  id: string;
  label: string;
  icon: IconName;
  count: number;
  shown: boolean;
  onToggle: () => void;
  /** an empty slot starts the first one instead; pressed again, it stops */
  create: { label: string; run: () => void; cancel?: () => void; can: boolean; live: boolean };
};

export function PanelRail({ slots }: { slots: RailSlot[] }) {
  return (
    <div className="builderIsland protoRail" role="toolbar" aria-label="Panels">
      {slots.map((slot) => {
        const empty = slot.count === 0;
        const name = empty ? slot.create.label : `${slot.label} (${slot.count})`;
        return (
          <button
            key={slot.id}
            type="button"
            className={`builderIconBtn protoRail__slot${empty ? " is-empty" : ""}${(slot.shown && !empty) || slot.create.live ? " is-active" : ""}`}
            aria-label={name}
            aria-pressed={empty ? undefined : slot.shown}
            title={name}
            disabled={empty && !slot.create.can && !slot.create.live}
            onClick={
              empty ? (slot.create.live && slot.create.cancel ? slot.create.cancel : slot.create.run) : slot.onToggle
            }
          >
            <Icon name={slot.icon} />
            <span className="protoRail__count">{empty ? "+" : slot.count}</span>
          </button>
        );
      })}
    </div>
  );
}
