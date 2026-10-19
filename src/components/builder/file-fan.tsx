"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";
import { fanRing, polar, quarterSpan, wedge } from "@/components/builder/ring-geometry";
import { findTool } from "@/components/navigation";
import { BetaMark } from "@/components/beta-badge";

type FanItem = {
  id: string;
  label: string;
  hint: string;
  icon: IconName;
  /** a file format: its name is set in mono */
  file?: boolean;
  /** tinted orange on hover and focus, not the accent */
  danger?: boolean;
  run: () => void;
};

// the gap between the file island and the fan's hole, and the margin the ring
// keeps from the workspace's far edges, in px
const GAP = 8;
const EDGE = 8;
// room round the ring for its strokes and focus ring, in px
const PAD = 4;
const ICON = 22;

/** Where the workspace's corner is from the fan's own box, and the ring that fits there. */
type Geometry = { left: number; top: number; ring: ReturnType<typeof fanRing> };

/**
 * Measure the corner the fan opens from: the top left of the workspace the
 * file island sits in. The hole clears the whole island, and the band thins on
 * a small workspace (see fanRing). Measured again when the window resizes.
 */
function useCornerGeometry(rootRef: RefObject<HTMLDivElement | null>, roomy = false) {
  const [geo, setGeo] = useState<Geometry | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const root = rootRef.current;
      const island = root?.closest<HTMLElement>(".builderIsland");
      const stage = island?.offsetParent;
      const box = root?.offsetParent;
      if (!root || !island || !stage || !box) return;
      const s = stage.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const i = island.getBoundingClientRect();
      const clear = Math.hypot(i.right - s.left, i.bottom - s.top) + GAP;
      const room = Math.min(s.width, s.height) - EDGE;
      setGeo({ left: s.left - b.left, top: s.top - b.top, ring: roomy ? fanRing(clear, room, 150, false) : fanRing(clear, room) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rootRef, roomy]);
  return geo;
}

/**
 * The quarter ring itself: a menu with one roving tab stop, as in the Show
 * wheel. The arrows walk the arc, Home/End jump to its ends, Enter or Space
 * runs the item, Esc closes; the table's own keys stay out.
 */
function FanRing({ items, geo, onClose }: { items: FanItem[]; geo: Geometry; onClose: () => void }) {
  const [focus, setFocus] = useState(0);
  const refs = useRef<(SVGGElement | null)[]>([]);
  const n = items.length;
  const { inner, outer, band, hints } = geo.ring;

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const move = (to: number) => {
    const next = (to + n) % n;
    setFocus(next);
    refs.current[next]?.focus();
  };

  // the first wedge lies along the top edge, the last down the left one
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(focus + 1),
      ArrowLeft: () => move(focus + 1),
      ArrowUp: () => move(focus - 1),
      ArrowRight: () => move(focus - 1),
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

  const size = outer + PAD;
  // with the hint under it, the name sits a little nearer the hole
  const iconAt = inner + band * (hints ? 0.28 : 0.32);
  const nameAt = inner + band * (hints ? 0.6 : 0.7);

  return (
    <svg
      className="fileFan__ring"
      role="menu"
      aria-label="Tabletop"
      viewBox={`${-PAD} ${-PAD} ${size + PAD} ${size + PAD}`}
      width={size + PAD}
      height={size + PAD}
      style={{ translate: `${-PAD}px ${-PAD}px` }}
      onKeyDown={onKeyDown}
    >
      {items.map((item, i) => {
        const { a0, a1, mid } = quarterSpan(i, n);
        const [ix, iy] = polar(iconAt, mid);
        const [nx, ny] = polar(nameAt, mid);
        return (
          <g
            key={item.id}
            ref={(node) => {
              refs.current[i] = node;
            }}
            className={`fileFan__item${item.file ? " is-file" : ""}${item.danger ? " is-danger" : ""}`}
            style={{ animationDelay: `${40 + i * 35}ms` }}
            role="menuitem"
            aria-label={`${item.label}: ${item.hint}`}
            tabIndex={i === focus ? 0 : -1}
            onFocus={() => setFocus(i)}
            onClick={item.run}
          >
            <title>{item.hint}</title>
            <path className="fileFan__wedge" d={wedge(inner, outer, a0, a1)} />
            <g transform={`translate(${ix - ICON / 2} ${iy - ICON / 2})`}>
              <Icon name={item.icon} size={ICON} />
            </g>
            <text className="fileFan__name" x={nx} y={hints ? ny - 7 : ny} textAnchor="middle" dominantBaseline="central">
              {item.label}
            </text>
            {hints ? (
              <text className="fileFan__hint" x={nx} y={ny + 9} textAnchor="middle" dominantBaseline="central">
                {item.hint}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** The fan, laid at the workspace's corner once it is measured. */
function Fan({ items, onClose, roomy }: { items: FanItem[]; onClose: () => void; roomy?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const geo = useCornerGeometry(rootRef, roomy);
  return (
    <div ref={rootRef} className="fileFan" style={geo ? { left: geo.left, top: geo.top } : { visibility: "hidden" }}>
      {geo ? <FanRing items={items} geo={geo} onClose={onClose} /> : null}
    </div>
  );
}

/**
 * The Tabletop ▾ menu: a quarter fan of wedges from the workspace's top-left
 * corner, a cousin of the eye's Show wheel. Its hole clears the file island
 * and lets clicks through to the + island under it. Picking a wedge runs it
 * and closes the fan; a pointer-down outside or Esc closes it too.
 */
export function FileFan({
  onShowJson,
  onExportPng,
  onResetExample,
  onClear,
  brand,
  onSite,
}: {
  onShowJson: () => void;
  onExportPng: () => void;
  onResetExample: () => void;
  onClear: () => void;
  /** PROTOTYPE (flat-hud D): the trigger is the QUOP mark, and the fan's first wedge goes back to the site */
  brand?: boolean;
  onSite?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // a pointer-down outside lets its click land where it was aimed
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    // Esc with focus outside the ring, which handles its own
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const pick = (action: () => void) => () => {
    close();
    action();
  };
  const items: FanItem[] = [
    ...(onSite ? [{ id: "site", label: "Home", hint: "Back to the QUOP site", icon: "back" as const, run: pick(onSite) }] : []),
    { id: "json", label: ".json", hint: "Save, load, edit", icon: "braces", file: true, run: pick(onShowJson) },
    { id: "png", label: ".png", hint: "Export the view", icon: "image", file: true, run: pick(onExportPng) },
    { id: "example", label: "Example", hint: "Load the example", icon: "example", run: pick(onResetExample) },
    { id: "clear", label: "Clear", hint: "Empty the table", icon: "trash", danger: true, run: pick(onClear) },
  ];

  return (
    <div className="builderMenu" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className="builderMenu__trigger"
        data-guide="file"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        {brand ? (
          <span className="builderMenu__title protoBrand">QUOP</span>
        ) : (
          <>
            <span className="builderMenu__title">Tabletop</span>
            <BetaMark tool={findTool("/builder/tabletop")} />
          </>
        )}
        <Icon name="chevron" size={14} />
      </button>
      {open ? <Fan items={items} onClose={close} roomy={brand} /> : null}
    </div>
  );
}
