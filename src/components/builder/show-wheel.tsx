"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";

export type WheelItem = {
  id: string;
  label: string;
  /** the segment's tooltip */
  description: string;
  icon: IconName;
  /** drawn instead of `icon` while the item is off */
  iconOff?: IconName;
  on: boolean;
  onToggle: () => void;
};

type Point = [number, number];

// the wheel's outer radius, the hole the eye button sits over, and the gap round it, in px:
// room for six wedges' names, and for a rim dial round the eye inside the hole
const OUTER = 192;
const INNER = 84;
const PAD = 6;
// the room left round the ring for rim dials and their readouts, in px
const RIM_ROOM = 40;
// each wedge stacks outwards from the centre: its icon, then its name with On/Off
// under it (under, not further out: out is sideways on the end wedges, into a
// two-line name)
const ICON_RADIUS = INNER + 24;
const NAME_RADIUS = INNER + (OUTER - INNER) * 0.56;
// how far below the name's middle On/Off sits, and a name's line height, in px
const STATE_DROP = 22;
const NAME_LINE = 11 * 1.1;

/** The ring's radii, for placing rim dials round it. */
export const RING = { outer: OUTER, inner: INNER } as const;
// how close the wheel may come to the window's sides, in px
const EDGE = 8;

/** A point on the lower half circle: 0 rad at the right, π at the left, y down. */
function polar(r: number, angle: number): Point {
  return [r * Math.cos(angle), r * Math.sin(angle)];
}

/** The path of a ring wedge between radii r0 and r1, angles a0 < a1. */
function wedge(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

/** Segment i of n, counted from the left: its start and end angles and its middle. */
function span(i: number, n: number) {
  const step = Math.PI / n;
  const a1 = Math.PI - i * step;
  const a0 = a1 - step;
  return { a0, a1, mid: (a0 + a1) / 2 };
}

/** A name's lines: a long two-word one ("Beam distances") goes over two. */
function nameLines(text: string) {
  const words = text.split(" ");
  return words.length > 1 && text.length > 8 ? words : [text];
}

/** A name centred on a point, over its lines. */
function Name({ text, at }: { text: string; at: Point }) {
  const lines = nameLines(text);
  const lead = ((lines.length - 1) * 1.1) / 2;
  return (
    <text className="showWheel__name" x={at[0]} y={at[1]} textAnchor="middle" dominantBaseline="central">
      {lines.map((line, index) => (
        <tspan key={line} x={at[0]} dy={index === 0 ? `${-lead}em` : "1.1em"}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * The Show wheel: a half ring that drops out of the eye button, one wedge per
 * item with its icon, name and On/Off. It is a menu of checkbox items with one
 * roving tab stop: the arrows walk the arc, Home/End jump to its ends, Enter or
 * Space toggles, Esc closes. `rims` draws in the ring's svg, its centre at
 * the eye: rim dials round the outside of the ring (`RING.outer`) or round
 * the eye inside it (`RING.inner`), each its own tab stop after the wedges.
 */
export function ShowWheel({
  items,
  onClose,
  rims,
}: {
  items: WheelItem[];
  onClose: () => void;
  rims?: ReactNode;
}) {
  const [focus, setFocus] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(SVGGElement | null)[]>([]);
  const n = items.length;

  useEffect(() => {
    segmentRefs.current[0]?.focus();
  }, []);

  // the eye sits near the window's right edge on a phone: slide the wheel in
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const over = rect.right - (window.innerWidth - EDGE);
    const under = EDGE - rect.left;
    if (over > 0) root.style.marginLeft = `${-over}px`;
    else if (under > 0) root.style.marginLeft = `${under}px`;
  }, []);

  const move = (to: number) => {
    const next = (to + n) % n;
    setFocus(next);
    segmentRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    // a rim dial keeps its own keys; only Esc reaches here from one
    const onSegment = segmentRefs.current.some((node) => node === event.target);
    if (!onSegment && event.key !== "Escape") return;
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(focus + 1),
      ArrowDown: () => move(focus + 1),
      ArrowLeft: () => move(focus - 1),
      ArrowUp: () => move(focus - 1),
      Home: () => move(0),
      End: () => move(n - 1),
      Enter: () => items[focus].onToggle(),
      " ": () => items[focus].onToggle(),
      Escape: onClose,
    };
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    // the table's own keys (nudging, undo) stay out of the wheel
    event.stopPropagation();
    run();
  };

  const pad = rims ? PAD + RIM_ROOM : PAD;
  const size = 2 * (OUTER + pad);

  return (
    <div className="showWheel" ref={rootRef}>
      <svg
        className="showWheel__ring"
        role="menu"
        aria-label="Show"
        aria-orientation="horizontal"
        viewBox={`${-OUTER - pad} ${-PAD} ${size} ${OUTER + PAD + pad}`}
        width={size}
        height={OUTER + PAD + pad}
        onKeyDown={onKeyDown}
      >
        {items.map((item, i) => {
          const { a0, a1, mid } = span(i, n);
          const [nx, ny] = polar(NAME_RADIUS, mid);
          const [ix, iy] = polar(ICON_RADIUS, mid);
          return (
            <g
              key={item.id}
              ref={(node) => {
                segmentRefs.current[i] = node;
              }}
              className={`showWheel__segment${item.on ? " is-on" : ""}`}
              style={{ animationDelay: `${i * 35}ms` }}
              role="menuitemcheckbox"
              aria-checked={item.on}
              aria-label={item.label}
              tabIndex={i === focus ? 0 : -1}
              onClick={() => {
                setFocus(i);
                item.onToggle();
              }}
              onFocus={() => setFocus(i)}
            >
              <title>{item.description}</title>
              <path className="showWheel__wedge" d={wedge(INNER, OUTER, a0, a1)} />
              <g transform={`translate(${ix - 10} ${iy - 10})`}>
                <Icon name={item.on ? item.icon : (item.iconOff ?? item.icon)} size={20} />
              </g>
              <Name text={item.label} at={[nx, ny]} />
              <text
                className="showWheel__state"
                x={nx}
                y={ny + STATE_DROP + ((nameLines(item.label).length - 1) * NAME_LINE) / 2}
                textAnchor="middle"
              >
                {item.on ? "On" : "Off"}
              </text>
            </g>
          );
        })}
        {rims}
      </svg>
    </div>
  );
}
