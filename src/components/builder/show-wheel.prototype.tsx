"use client";

/*
 * PROTOTYPE: throwaway. "What should the eye (Show) dropdown look like as a
 * selection wheel?" Three wheels that drop a semicircle out of the eye
 * button, one segment per overlay with its icon and name, plus the current
 * bubble for comparison; switch with `?wheel=ring|orbs|dial|bubble` or the
 * floating bar (dev only). Fold the winner into ShowMenu, drop the rest.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";

export const WHEEL_VARIANTS = [
  { key: "ring", name: "Ring: a half doughnut of wedges" },
  { key: "orbs", name: "Orbs: round keys on an arc" },
  { key: "dial", name: "Dial: pie slices round a readout hub" },
  { key: "bubble", name: "Bubble: today's list, for comparison" },
] as const;

export type WheelVariant = (typeof WHEEL_VARIANTS)[number]["key"];

export type WheelItem = {
  id: string;
  label: string;
  /** two short lines at most: the dial's hub shows it */
  description: string;
  icon: IconName;
  iconOff?: IconName;
  on: boolean;
  onToggle: () => void;
};

type Point = [number, number];

/** A point on the lower half: angle in radians, 0 at the right, π at the left, y down. */
function polar(r: number, angle: number): Point {
  return [r * Math.cos(angle), r * Math.sin(angle)];
}

function sector(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  const inner = r0 > 0 ? `L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}` : "L0 0";
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}${inner}Z`;
}

/** Segment i of n, left to right: its start and end angles and its middle. */
function span(i: number, n: number) {
  const step = Math.PI / n;
  const a1 = Math.PI - i * step;
  const a0 = a1 - step;
  return { a0, a1, mid: (a0 + a1) / 2 };
}

function IconAt({ name, at, size = 20 }: { name: IconName; at: Point; size?: number }) {
  return (
    <g transform={`translate(${at[0] - size / 2} ${at[1] - size / 2})`}>
      <Icon name={name} size={size} />
    </g>
  );
}

/** "Beam distances" over two lines, short names on one. */
function Words({ text, at, className }: { text: string; at: Point; className: string }) {
  const words = text.split(" ");
  const lines = words.length > 1 && text.length > 8 ? words : [text];
  const lead = ((lines.length - 1) * 1.1) / 2;
  return (
    <text className={className} x={at[0]} y={at[1]} textAnchor="middle" dominantBaseline="central">
      {lines.map((line, index) => (
        <tspan key={line} x={at[0]} dy={index === 0 ? `${-lead}em` : "1.1em"}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * The wheel: an SVG menu of checkbox items, one roving tab stop. Arrows walk
 * the arc, Home/End jump to its ends, Enter or Space toggles, Esc closes.
 */
export function ShowWheel({
  variant,
  items,
  onClose,
  footer,
}: {
  variant: Exclude<WheelVariant, "bubble">;
  items: WheelItem[];
  onClose: () => void;
  footer?: ReactNode;
}) {
  const [focus, setFocus] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const refs = useRef<(SVGGElement | null)[]>([]);
  const n = items.length;

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const move = (to: number) => {
    const next = (to + n) % n;
    setFocus(next);
    refs.current[next]?.focus();
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
    event.stopPropagation();
    run();
  };

  const R = variant === "dial" ? 180 : 152;
  const pad = 6;
  const tall = variant === "orbs" ? R + 26 : R + pad;
  const shown = items[hover ?? focus];

  const segment = (item: WheelItem, i: number) => {
    const { a0, a1, mid } = span(i, n);
    const icon = item.on ? item.icon : (item.iconOff ?? item.icon);
    const state = item.on ? "On" : "Off";
    let body: ReactNode;
    if (variant === "ring") {
      body = (
        <>
          <path className="showWheel__shape" d={sector(46, R, a0, a1)} />
          <IconAt name={icon} at={polar(122, mid)} />
          <Words className="showWheel__name" text={item.label} at={polar(86, mid)} />
          <text className="showWheel__state" {...xy(polar(86, mid), 22)} textAnchor="middle">
            {state}
          </text>
        </>
      );
    } else if (variant === "orbs") {
      const at = polar(100, mid);
      body = (
        <>
          <circle className="showWheel__shape" cx={at[0]} cy={at[1]} r={25} />
          <IconAt name={icon} at={at} size={22} />
          <Words className="showWheel__name" text={item.label} at={[at[0], at[1] + 42]} />
          <circle
            className="showWheel__pip"
            cx={at[0] + 18}
            cy={at[1] - 18}
            r={4.5}
            aria-hidden="true"
          />
        </>
      );
    } else {
      const degrees = (mid * 180) / Math.PI;
      const turn = degrees > 90 ? degrees - 180 : degrees;
      const [tx, ty] = polar(116, mid);
      body = (
        <>
          <path className="showWheel__shape" d={sector(0, R, a0, a1)} />
          <IconAt name={icon} at={polar(164, mid)} size={18} />
          <text
            className="showWheel__name"
            textAnchor="middle"
            dominantBaseline="central"
            transform={`translate(${tx} ${ty}) rotate(${turn})`}
          >
            {item.label}
          </text>
        </>
      );
    }
    return (
      <g
        key={item.id}
        ref={(node) => {
          refs.current[i] = node;
        }}
        className={`showWheel__seg${item.on ? " is-on" : ""}`}
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
        onPointerEnter={() => setHover(i)}
        onPointerLeave={() => setHover(null)}
      >
        <title>{item.description}</title>
        {body}
      </g>
    );
  };

  return (
    <div className={`showWheel showWheel--${variant}`}>
      <svg
        className="showWheel__svg"
        role="menu"
        aria-label="Show"
        aria-orientation="horizontal"
        viewBox={`${-R - pad} ${-pad} ${2 * (R + pad)} ${tall + pad}`}
        width={2 * (R + pad)}
        height={tall + pad}
        onKeyDown={onKeyDown}
      >
        {variant === "orbs" ? <path className="showWheel__backdrop" d={sector(0, R, 0, Math.PI)} /> : null}
        {variant === "ring" ? <path className="showWheel__backdrop" d={sector(0, 42, 0, Math.PI)} /> : null}
        {items.map(segment)}
        {variant === "dial" ? (
          <g className="showWheel__hub" aria-hidden="true">
            <path d={sector(0, 74, 0, Math.PI)} />
            <text className="showWheel__hubName" x={0} y={16} textAnchor="middle">
              {shown.label}
            </text>
            <text className="showWheel__hubState" x={0} y={30} textAnchor="middle">
              {shown.on ? "Shown" : "Hidden"}
            </text>
            <foreignObject x={-44} y={36} width={88} height={24}>
              <p className="showWheel__hubText">{shown.description}</p>
            </foreignObject>
          </g>
        ) : null}
      </svg>
      {footer ? <div className="showWheel__footer">{footer}</div> : null}
    </div>
  );
}

/** Text a little below a point. */
function xy(at: Point, dy: number) {
  return { x: at[0], y: at[1] + dy };
}
