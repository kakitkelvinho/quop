"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";
import {
  angleOf,
  arcPath,
  percent,
  pointAt,
  valueAt,
  valueForKey,
  type DialArc,
  type DialRange,
} from "@/components/builder/rim-dial";

// the knob's radius, and how far the readout rides from the arc, in px
const KNOB = 9;
const READOUT = 20;

/**
 * A rim dial: a slider bent onto an arc round the Show wheel, drawn inside the
 * wheel's svg (its centre at 0, 0). Drag the knob, or click along the arc;
 * with it focused, the arrows step it, Page Up/Down go ten steps and Home/End
 * go to the ends. Those keys stay in the dial: they don't reach the wheel's
 * wedges or the table. Esc still closes the wheel.
 *
 * `onBegin` runs before the first change of each drag or key press, so a
 * caller can take one undo snapshot for the whole gesture.
 */
export function ShowWheelDial({
  label,
  icon,
  arc,
  side,
  range,
  step = 0.05,
  value,
  disabled = false,
  disabledHint,
  onBegin,
  onChange,
}: {
  label: string;
  icon: IconName;
  arc: DialArc;
  /** where the readout rides: outside the arc (1) or inside it (-1) */
  side: 1 | -1;
  range: DialRange;
  step?: number;
  value: number;
  disabled?: boolean;
  /** the tooltip while disabled: what turns the dial on */
  disabledHint?: string;
  onBegin?: () => void;
  onChange: (value: number) => void;
}) {
  const dragging = useRef(false);
  const editing = useRef(false);

  const set = (next: number) => {
    if (next === value) return;
    if (!editing.current) {
      editing.current = true;
      onBegin?.();
    }
    onChange(next);
  };
  const end = () => {
    dragging.current = false;
    editing.current = false;
  };

  const fromPointer = (event: PointerEvent<SVGGElement>) => {
    const matrix = event.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!matrix) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    set(valueAt(p.x, p.y, range, arc, step));
  };

  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    // Esc closes the wheel and Tab moves on; every other key is the dial's
    if (event.key === "Escape" || event.key === "Tab") return;
    event.stopPropagation();
    const next = disabled ? null : valueForKey(event.key, value, range, step);
    if (next === null) {
      // Space would scroll the page, Enter would toggle a wedge
      if (event.key === " " || event.key === "Enter") event.preventDefault();
      return;
    }
    event.preventDefault();
    set(next);
  };

  const { r, from, to } = arc;
  const angle = angleOf(value, range, arc);
  const [kx, ky] = pointAt(r, angle);
  const [tx, ty] = pointAt(r + side * READOUT, angle);
  const track = arcPath(r, from, to);
  const readout = percent(value);

  return (
    <g
      className={`showWheel__dial${disabled ? " is-disabled" : ""}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-orientation="horizontal"
      aria-valuemin={range[0]}
      aria-valuemax={range[1]}
      aria-valuenow={value}
      aria-valuetext={readout}
      onKeyDown={onKeyDown}
      onKeyUp={() => {
        editing.current = false;
      }}
      onBlur={end}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        fromPointer(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current) fromPointer(event);
      }}
      onPointerUp={end}
      onLostPointerCapture={end}
    >
      <title>{disabled && disabledHint ? `${label}: ${disabledHint}` : `${label}: drag round the rim`}</title>
      <path className="showWheel__dialHit" d={track} />
      <path className="showWheel__dialTrack" d={track} />
      <path className="showWheel__dialFill" d={arcPath(r, from, angle)} />
      <circle className="showWheel__dialKnob" cx={kx} cy={ky} r={KNOB} />
      <g className="showWheel__dialIcon" transform={`translate(${kx - 6} ${ky - 6})`}>
        <Icon name={icon} size={12} />
      </g>
      <text className="showWheel__dialReadout" x={tx} y={ty} textAnchor="middle" dominantBaseline="central">
        {readout}
      </text>
    </g>
  );
}
