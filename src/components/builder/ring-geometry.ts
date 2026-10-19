// Ring wedges for the builder's radial menus: the eye's Show wheel draws the
// same shapes on a half circle, the corner fans on a quarter.

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

/**
 * A corner fan's band: how deep it is unless asked otherwise, below which
 * hints drop, and its floor, in px.
 */
export const FAN_BAND = { full: 150, hints: 100, least: 64 } as const;

/**
 * A corner fan's ring, from the radius its hole must clear and the room the
 * workspace has from its corner (the shorter of its width and height, less a
 * margin). The band is `depth` deep, thinner when the room runs short, but
 * never thinner than its floor: past that the ring's far tips run off the edge
 * rather than its labels crowding. A thin band leaves the hints out, and a fan
 * that asks for none (`hints` false) never has them.
 */
export function fanRing(clear: number, room: number, depth: number = FAN_BAND.full, hints = true) {
  const band = Math.max(FAN_BAND.least, Math.min(depth, room - clear));
  return { inner: clear, outer: clear + band, band, hints: hints && band >= FAN_BAND.hints };
}

/** Half the gap between two petals at the hole, in px: the gap there is twice this, and widens outward. */
export const PETAL_GAP = 3;

/**
 * How far in each wedge's angles step, so neighbours part as petals: a gap of
 * 2 × `gap` px at the hole (radius `inner`), wider further out, as an angle
 * gap is.
 */
export function petalInset(inner: number, gap: number = PETAL_GAP): number {
  return inner > 0 ? gap / inner : 0;
}

/** The workspace corners a fan opens from: top left, top right, bottom right. */
export type Corner = "tl" | "tr" | "br";

/**
 * Each corner's quarter, swept from its horizontal edge to its vertical one,
 * so a fan reads from the edge its trigger sits on: the angle it starts at
 * and which way it turns (1 clockwise on screen, -1 counter-clockwise).
 */
const SWEEP: Record<Corner, { from: number; turn: 1 | -1 }> = {
  tl: { from: 0, turn: 1 },
  tr: { from: Math.PI, turn: -1 },
  br: { from: Math.PI, turn: 1 },
};

/**
 * Wedge i of n in a corner's quarter, its angles stepped in by `inset` (see
 * petalInset): a0 < a1 always, as `wedge` wants, and the middle for its icon
 * and name.
 */
export function cornerSpan(corner: Corner, i: number, n: number, inset = 0) {
  const { from, turn } = SWEEP[corner];
  const step = QUARTER / n;
  const start = from + turn * i * step;
  const end = start + turn * step;
  const a0 = Math.min(start, end);
  const a1 = Math.max(start, end);
  return { a0: a0 + inset, a1: a1 - inset, mid: (a0 + a1) / 2 };
}

/** A box on screen, as getBoundingClientRect gives it. */
export type Rect = { left: number; top: number; right: number; bottom: number };

/** The corner's own point on the workspace's box. */
export function cornerPoint(corner: Corner, stage: Rect): Point {
  return [corner === "tl" ? stage.left : stage.right, corner === "br" ? stage.bottom : stage.top];
}

/**
 * How far the hole must reach to clear every island in the corner: the
 * distance from the corner to the far point of the farthest island, plus a
 * gap. Fans that share a ring (the QUOP and + fans) measure the same boxes.
 */
export function cornerClear(corner: Corner, stage: Rect, islands: Rect[], gap = 8): number {
  const [cx, cy] = cornerPoint(corner, stage);
  let clear = 0;
  for (const box of islands) {
    const fx = corner === "tl" ? box.right : box.left;
    const fy = corner === "br" ? box.top : box.bottom;
    clear = Math.max(clear, Math.hypot(fx - cx, fy - cy));
  }
  return clear + gap;
}

/**
 * The arrow keys that walk a corner's fan forward and back. The wedges run
 * from the horizontal edge to the vertical one, so forward is the way that
 * walk goes on screen: down and left from the top left, down and right from
 * the top right, up and right from the bottom right.
 */
export function fanArrows(corner: Corner): { next: string[]; previous: string[] } {
  const down = corner !== "br";
  const right = corner !== "tl";
  return {
    next: [down ? "ArrowDown" : "ArrowUp", right ? "ArrowRight" : "ArrowLeft"],
    previous: [down ? "ArrowUp" : "ArrowDown", right ? "ArrowLeft" : "ArrowRight"],
  };
}
