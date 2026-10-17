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

// the wheel's outer radius, the hole the eye button sits over, and the gap round it, in px
const OUTER = 152;
const INNER = 46;
const PAD = 6;
// where a segment's icon and name sit, from the centre
const ICON_RADIUS = 122;
const NAME_RADIUS = 86;
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

/** A name centred on a point, a long two-word one ("Beam distances") over two lines. */
function Name({ text, at }: { text: string; at: Point }) {
  const words = text.split(" ");
  const lines = words.length > 1 && text.length > 8 ? words : [text];
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
 * Space toggles, Esc closes. `footer` hangs in a card under the ring.
 */
export function ShowWheel({
  items,
  onClose,
  footer,
  rim,
  outer = OUTER,
  inner = INNER,
}: {
  items: WheelItem[];
  onClose: () => void;
  footer?: ReactNode;
  /** PROTOTYPE: drawn in the ring's svg over the hole (given the ring's radii) */
  rim?: (outer: number, inner: number) => ReactNode;
  /** PROTOTYPE: a roomier ring for more wedges */
  outer?: number;
  inner?: number;
}) {
  // the default ring keeps today's spots; a resized one stacks each wedge
  // outwards from the centre: icon, then name, then On/Off
  const sized = outer !== OUTER || inner !== INNER;
  const iconRadius = sized ? inner + 24 : ICON_RADIUS;
  const nameRadius = sized ? inner + (outer - inner) * 0.56 : NAME_RADIUS;
  const stateRadius = nameRadius + 30;
  const hole = inner - 4;
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

  // PROTOTYPE: a rim needs room round the ring
  const pad = rim ? PAD + 40 : PAD;
  const size = 2 * (outer + pad);

  return (
    <div className="showWheel" ref={rootRef}>
      <svg
        className="showWheel__ring"
        role="menu"
        aria-label="Show"
        aria-orientation="horizontal"
        viewBox={`${-outer - pad} ${-PAD} ${size} ${outer + PAD + pad}`}
        width={size}
        height={outer + PAD + pad}
        onKeyDown={onKeyDown}
      >
        {/* PROTOTYPE: the resized ring drops the idle half disc under the eye */}
        {sized ? null : <path className="showWheel__hole" d={`M${-hole} 0A${hole} ${hole} 0 0 0 ${hole} 0Z`} />}
        {rim?.(outer, inner)}
        {items.map((item, i) => {
          const { a0, a1, mid } = span(i, n);
          const [nx, ny] = polar(nameRadius, mid);
          const [ix, iy] = polar(iconRadius, mid);
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
              <path className="showWheel__wedge" d={wedge(inner, outer, a0, a1)} />
              <g transform={`translate(${ix - 10} ${iy - 10})`}>
                <Icon name={item.on ? item.icon : (item.iconOff ?? item.icon)} size={20} />
              </g>
              <Name text={item.label} at={[nx, ny]} />
              <text
                className="showWheel__state"
                x={sized ? polar(stateRadius, mid)[0] : nx}
                y={sized ? polar(stateRadius, mid)[1] : ny + 22}
                textAnchor="middle"
                dominantBaseline={sized ? "central" : undefined}
              >
                {item.on ? "On" : "Off"}
              </text>
            </g>
          );
        })}
      </svg>
      {footer ? <div className="showWheel__footer">{footer}</div> : null}
    </div>
  );
}
