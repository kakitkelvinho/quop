/**
 * The maths of a rim dial: a slider bent onto an arc of the Show wheel's lower
 * half circle. Angles are in radians with 0 at the right, π at the left and y
 * pointing down, so the arc from π to 0 runs round the bottom. A dial's low
 * end is at `from`, its high end at `to`.
 */

export type DialArc = {
  /** the arc's radius, in px */
  r: number;
  /** the angle of the dial's low end */
  from: number;
  /** the angle of the dial's high end */
  to: number;
};

export type DialRange = readonly [number, number];

/** A point at radius r and angle a: the lower half circle has y > 0. */
export function pointAt(r: number, angle: number): [number, number] {
  return [r * Math.cos(angle), r * Math.sin(angle)];
}

/** How far a value is along its range, 0 at the low end and 1 at the high, held to the ends. */
export function fraction(value: number, [lo, hi]: DialRange): number {
  if (hi === lo) return 0;
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** The angle the knob sits at for a value. */
export function angleOf(value: number, range: DialRange, { from, to }: DialArc): number {
  return from + fraction(value, range) * (to - from);
}

/** A value held to its range and rounded to the nearest step from the low end. */
export function snap(value: number, [lo, hi]: DialRange, step: number): number {
  const stepped = lo + Math.round((value - lo) / step) * step;
  // round off the float dust a step leaves (0.30000000000000004)
  const clean = Math.round(stepped * 1e6) / 1e6;
  return Math.min(hi, Math.max(lo, clean));
}

/**
 * The value under a point (in the arc's own coordinates, its centre at 0, 0),
 * snapped to the step. A point above the centre line counts as on it, so a
 * drag past an end of the arc holds at that end.
 */
export function valueAt(x: number, y: number, range: DialRange, arc: DialArc, step: number): number {
  const [lo, hi] = range;
  const { from, to } = arc;
  if (x === 0 && y <= 0) return snap(lo + 0.5 * (hi - lo), range, step);
  const raw = Math.atan2(Math.max(y, 0), x);
  const angle = Math.min(Math.max(from, to), Math.max(Math.min(from, to), raw));
  const t = from === to ? 0 : (angle - from) / (to - from);
  return snap(lo + t * (hi - lo), range, step);
}

/**
 * The value a key moves a dial to, or null when the key isn't the dial's:
 * the arrows go a step (right and up raise it), Page Up/Down ten steps,
 * Home/End to the ends, as a slider's keys do.
 */
export function valueForKey(key: string, value: number, range: DialRange, step: number): number | null {
  const [lo, hi] = range;
  const by: Record<string, number> = {
    ArrowRight: step,
    ArrowUp: step,
    ArrowLeft: -step,
    ArrowDown: -step,
    PageUp: 10 * step,
    PageDown: -10 * step,
  };
  if (key === "Home") return lo;
  if (key === "End") return hi;
  if (!(key in by)) return null;
  return snap(value + by[key], range, step);
}

/**
 * The svg path of an arc from angle a0 to angle a1 at radius r, round the
 * bottom of the circle (the way from π down to 0). Spans of at most π only.
 */
export function arcPath(r: number, a0: number, a1: number): string {
  const [x0, y0] = pointAt(r, a0);
  const [x1, y1] = pointAt(r, a1);
  // going from a larger angle to a smaller one is anticlockwise on screen, y down
  const sweep = a1 < a0 ? 0 : 1;
  return `M${x0} ${y0}A${r} ${r} 0 0 ${sweep} ${x1} ${y1}`;
}

/** A value as the percentage a dial reads out. */
export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
