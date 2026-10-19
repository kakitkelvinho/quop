"use client";

// PROTOTYPE: throwaway HUD surface languages (?variant=current|A|B|C|D). Not for main.
// D is also a layout: one + fan, one ? fan, one camera fan, undo/redo, and a
// panel rail that is always there.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
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

/* ---------- a quarter fan anchored on its own button ---------- */

export type ProtoFanItem = {
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
  disabled?: boolean;
  active?: boolean;
};

// which quarter the fan opens into, as start angles (0 = right, clockwise on screen)
const QUARTERS = { se: 0, sw: Math.PI / 2, nw: Math.PI, ne: (3 * Math.PI) / 2 } as const;
const INNER = 26;
const BAND = 104;
const PAD = 6;
const ICON = 20;

export function ProtoFan({
  icon,
  label,
  quarter,
  items,
  active,
  onTrigger,
}: {
  icon: IconName;
  label: string;
  quarter: keyof typeof QUARTERS;
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
  const n = items.length;
  const outer = INNER + BAND;
  const R = outer + PAD;
  const start = QUARTERS[quarter];
  const step = Math.PI / 2 / n;

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

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
      {open ? (
        <div className="fileFan protoFan__layer" style={{ left: 16 - R, top: 16 - R }}>
          <svg
            className="fileFan__ring protoFan__ring"
            role="menu"
            aria-label={label}
            viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`}
            width={2 * R}
            height={2 * R}
            onKeyDown={onKeyDown}
          >
            {items.map((item, i) => {
              const a0 = start + i * step;
              const a1 = a0 + step;
              const mid = (a0 + a1) / 2;
              const [ix, iy] = polar(INNER + BAND * 0.3, mid);
              const [nx, ny] = polar(INNER + BAND * 0.68, mid);
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
                  <path className="fileFan__wedge" d={wedge(INNER, outer, a0, a1)} />
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
      ) : null}
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
  /** an empty slot starts the first one instead */
  create: { label: string; run: () => void; can: boolean; live: boolean };
};

export function PanelRail({ slots }: { slots: RailSlot[] }) {
  return (
    <div className="builderIsland protoRail" role="toolbar" aria-label="Panels" aria-orientation="vertical">
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
            onClick={empty ? slot.create.run : slot.onToggle}
          >
            <Icon name={slot.icon} />
            <span className="protoRail__count">{empty ? "+" : slot.count}</span>
          </button>
        );
      })}
    </div>
  );
}
