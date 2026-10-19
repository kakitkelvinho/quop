// Ring wedges for the builder's radial menus: the eye's Show wheel draws the
// same shapes on a half circle, the file fan on a quarter.

export type Point = [number, number];

/** A point at radius r and angle a: 0 rad to the right, angles turning clockwise on screen (y down). */
export function polar(r: number, angle: number): Point {
  return [r * Math.cos(angle), r * Math.sin(angle)];
}

/** The path of a ring wedge between radii r0 < r1 and angles a0 < a1. */
export function wedge(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

/** The quarter from a corner's top edge (0) round to its left edge (π/2). */
export const QUARTER = Math.PI / 2;

/** Wedge i of n on the quarter, counted from the top edge: its start and end angles and its middle. */
export function quarterSpan(i: number, n: number) {
  const step = QUARTER / n;
  const a0 = i * step;
  const a1 = a0 + step;
  return { a0, a1, mid: (a0 + a1) / 2 };
}

/** The file fan's band: how thick it is at most, below which the hints drop, and its floor, in px. */
export const FAN_BAND = { full: 118, hints: 100, least: 64 } as const;

/**
 * The file fan's ring, from the radius its hole must clear and the room the
 * workspace has from its corner (the shorter of its width and height, less a
 * margin). The band is as thick as it may be, thinner when the room runs
 * short, but never thinner than its floor: past that the ring's far tips run
 * off the edge rather than its labels crowding. A thin band leaves the hints
 * out.
 */
export function fanRing(clear: number, room: number, full: number = FAN_BAND.full, hints = true) {
  const band = Math.max(FAN_BAND.least, Math.min(full, room - clear));
  return { inner: clear, outer: clear + band, band, hints: hints && band >= FAN_BAND.hints };
}
