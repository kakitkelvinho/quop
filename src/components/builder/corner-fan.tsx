"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { Icon, type IconName } from "@/components/builder/builder-icons";
import {
  type Corner,
  cornerClear,
  cornerSpan,
  fanArrows,
  fanRing,
  petalInset,
  polar,
  wedge,
} from "@/components/builder/ring-geometry";

/*
 * The HUD's one menu idiom: a quarter fan of wedges from a corner of the
 * workspace, flush with its edges. The QUOP mark's file menu and the + open
 * from the top left (on one ring), the ? from the top right, the camera from
 * the bottom right. Its hole clears the islands in its corner, measured, so
 * clicks pass through to them.
 */

export type CornerFanItem = {
  id: string;
  /** one word, under its icon */
  label: string;
  icon: IconName;
  run: () => void;
  /** its tooltip, when the word wants a few more */
  hint?: string;
  disabled?: boolean;
  /** marked as the current one (the camera's view, an open panel) */
  on?: boolean;
  /** a file format: its name is set in mono */
  file?: boolean;
  /** tinted orange on hover and focus, not the accent */
  danger?: boolean;
};

// the gap between the islands and the hole, and the margin the ring keeps from the workspace's far edges, px
const GAP = 8;
const EDGE = 8;
// room round the ring for its strokes and focus ring, px
const PAD = 4;
const ICON = 24;

type Geometry = { stage: HTMLElement; inner: number; outer: number };

/** Only one fan is open at a time: opening one closes the last. */
let closeOpenFan: (() => void) | null = null;

/** Measure the corner while open, and again when the window resizes. */
function useCornerRing(
  triggerRef: RefObject<HTMLElement | null>,
  corner: Corner,
  clearOf: string,
  open: boolean,
) {
  const [geo, setGeo] = useState<Geometry | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const stage =
        triggerRef.current?.closest<HTMLElement>(".builderWorkspace");
      if (!stage) return;
      const s = stage.getBoundingClientRect();
      const islands = Array.from(
        stage.querySelectorAll<HTMLElement>(clearOf),
        (element) => element.getBoundingClientRect(),
      );
      const clear = cornerClear(corner, s, islands, GAP);
      const ring = fanRing(
        clear,
        Math.min(s.width, s.height) - EDGE,
        undefined,
        false,
      );
      setGeo({ stage, inner: ring.inner, outer: ring.outer });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [triggerRef, corner, clearOf, open]);
  return open ? geo : null;
}

/** Where the ring's layer sits on the workspace: on its corner, its padding outside it. */
function layerPlace(corner: Corner): CSSProperties {
  return {
    [corner === "tl" ? "left" : "right"]: -PAD,
    [corner === "br" ? "bottom" : "top"]: -PAD,
  };
}

/**
 * The quarter ring: a menu with one roving tab stop. The arrows walk it
 * (forward is the way the wedges run from the corner), Home/End jump to its
 * ends, Enter or Space runs the item, Esc closes; the table's own keys stay out.
 */
function FanRing({
  corner,
  label,
  items,
  geo,
  onPick,
  onClose,
}: {
  corner: Corner;
  label: string;
  items: CornerFanItem[];
  geo: Geometry;
  onPick: (item: CornerFanItem) => void;
  onClose: () => void;
}) {
  const first = Math.max(
    0,
    items.findIndex((item) => !item.disabled),
  );
  const [focus, setFocus] = useState(first);
  const refs = useRef<(SVGGElement | null)[]>([]);
  const n = items.length;
  const { inner, outer } = geo;
  const band = outer - inner;

  useEffect(() => {
    refs.current[first]?.focus();
  }, [first]);

  const move = (to: number) => {
    const next = (to + n) % n;
    setFocus(next);
    refs.current[next]?.focus();
  };
  const arrows = fanArrows(corner);
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    let run: (() => void) | undefined;
    if (arrows.next.includes(event.key)) run = () => move(focus + 1);
    else if (arrows.previous.includes(event.key)) run = () => move(focus - 1);
    else if (event.key === "Home") run = () => move(0);
    else if (event.key === "End") run = () => move(n - 1);
    else if (event.key === "Enter" || event.key === " ")
      run = () => onPick(items[focus]);
    else if (event.key === "Escape") run = onClose;
    else if (event.key === "Tab") run = onClose;
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    run();
  };

  const size = outer + 2 * PAD;
  // the svg's origin is the corner; its box runs from the corner into the workspace
  const vx = corner === "tl" ? -PAD : -outer - PAD;
  const vy = corner === "br" ? -outer - PAD : -PAD;
  const origin = `${corner === "tl" ? PAD : size - PAD}px ${corner === "br" ? size - PAD : PAD}px`;
  const inset = petalInset(inner);
  const iconAt = inner + band * 0.32;
  const nameAt = inner + band * 0.68;

  return (
    <svg
      className="cornerFan__ring"
      role="menu"
      aria-label={label}
      viewBox={`${vx} ${vy} ${size} ${size}`}
      width={size}
      height={size}
      style={{ transformOrigin: origin }}
      onKeyDown={onKeyDown}
    >
      {items.map((item, i) => {
        const { a0, a1, mid } = cornerSpan(corner, i, n, inset);
        const [ix, iy] = polar(iconAt, mid);
        const [nx, ny] = polar(nameAt, mid);
        return (
          <g
            key={item.id}
            ref={(node) => {
              refs.current[i] = node;
            }}
            className={`cornerFan__item${item.file ? " is-file" : ""}${item.danger ? " is-danger" : ""}${item.on ? " is-on" : ""}${item.disabled ? " is-disabled" : ""}`}
            style={{ animationDelay: `${30 + i * 30}ms` }}
            role="menuitem"
            aria-label={item.hint ? `${item.label}: ${item.hint}` : item.label}
            aria-disabled={item.disabled || undefined}
            aria-current={item.on || undefined}
            tabIndex={i === focus ? 0 : -1}
            onFocus={() => setFocus(i)}
            onClick={() => onPick(item)}
          >
            {item.hint ? <title>{item.hint}</title> : null}
            <path
              className="cornerFan__wedge"
              d={wedge(inner, outer, a0, a1)}
            />
            <g transform={`translate(${ix - ICON / 2} ${iy - ICON / 2})`}>
              <Icon name={item.icon} size={ICON} />
            </g>
            <text
              className="cornerFan__name"
              x={nx}
              y={ny}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * A trigger and its corner fan. Picking a wedge runs it and closes the fan;
 * Esc closes it and hands focus back to the trigger; a pointer-down outside
 * closes it and lets its click land where it was aimed. With `onTrigger`, a
 * press runs that instead of opening whenever it returns true (the + cancels
 * what it started).
 */
export function CornerFan({
  corner,
  clearOf,
  label,
  items,
  children,
  className = "builderIconBtn",
  active = false,
  onTrigger,
  guide,
  title = label,
}: {
  corner: Corner;
  /** the islands the hole must clear, as a selector inside the workspace */
  clearOf: string;
  /** the menu's name, and the trigger's unless it has words of its own */
  label: string;
  items: CornerFanItem[];
  /** the trigger's face */
  children: ReactNode;
  className?: string;
  /** the trigger lights while something it started is live */
  active?: boolean;
  onTrigger?: () => boolean;
  /** its key in the quick guide's coach marks */
  guide?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  const geo = useCornerRing(triggerRef, corner, clearOf, open);

  useEffect(() => {
    if (!open) return;
    if (closeOpenFan !== dismiss) closeOpenFan?.();
    closeOpenFan = dismiss;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !layerRef.current?.contains(target)
      )
        dismiss();
    };
    // Esc with the focus outside the ring, which handles its own
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (closeOpenFan === dismiss) closeOpenFan = null;
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, dismiss, close]);

  const pick = (item: CornerFanItem) => {
    if (item.disabled) return;
    close();
    item.run();
  };

  return (
    <div className="cornerFan__anchor" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${className}${active || open ? " is-active" : ""}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        data-guide={guide}
        onClick={() => {
          if (!open && onTrigger?.()) return;
          setOpen((current) => !current);
        }}
      >
        {children}
      </button>
      {geo
        ? createPortal(
            <div
              ref={layerRef}
              className="cornerFan"
              style={layerPlace(corner)}
            >
              <FanRing
                corner={corner}
                label={label}
                items={items}
                geo={geo}
                onPick={pick}
                onClose={close}
              />
            </div>,
            geo.stage,
          )
        : null}
    </div>
  );
}
