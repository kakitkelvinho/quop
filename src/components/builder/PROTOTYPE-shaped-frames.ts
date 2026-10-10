/**
 * PROTOTYPE (#146), throwaway, not for merging.
 *
 * Geometry for frames with right-angled outlines. The rough storage used here:
 * a frame may carry `outline`, its corners in order, relative to `position`,
 * which is then the first corner (so snapping `position` to the grid keeps
 * every corner on it). `width` and `depth` follow the outline's bounding box.
 * A frame with no outline is the old centred rectangle.
 */
import type { Frame } from "@/components/builder/types";

export type P = [number, number];

export type ProtoMode = "edit" | "draw" | "rects";

/** What a press on a selected frame hit: a side (index i runs from corner i to i + 1) or a corner. */
export type ProtoTarget = { kind: "edge"; index: number } | { kind: "corner"; index: number };

/** A frame's corners on the table, mm, in order. */
export function frameCorners(frame: Frame): P[] {
  const [x, z] = frame.position;
  if (frame.outline && frame.outline.length >= 4) {
    return frame.outline.map(([ox, oz]): P => [x + ox, z + oz]);
  }
  const w = frame.width / 2;
  const d = frame.depth / 2;
  return [
    [x - w, z - d],
    [x + w, z - d],
    [x + w, z + d],
    [x - w, z + d],
  ];
}

/** The frame fields for a set of absolute corners. */
export function withCorners(corners: P[]): Pick<Frame, "position" | "outline" | "width" | "depth"> {
  const [x0, z0] = corners[0];
  const xs = corners.map((c) => c[0]);
  const zs = corners.map((c) => c[1]);
  return {
    position: [x0, z0],
    outline: corners.map(([x, z]): P => [round(x - x0), round(z - z0)]),
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...zs) - Math.min(...zs),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function same(a: P, b: P): boolean {
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

/** "x" when a side runs along x (constant z), "z" when along z, null when slanted or zero. */
export function sideAxis(a: P, b: P): "x" | "z" | null {
  const flatZ = Math.abs(a[1] - b[1]) < 1e-6;
  const flatX = Math.abs(a[0] - b[0]) < 1e-6;
  if (flatZ && !flatX) return "x";
  if (flatX && !flatZ) return "z";
  return null;
}

/** Drop repeated corners (zero-length sides), wrapping round. */
export function dropZeroSides(corners: P[]): P[] {
  const out: P[] = [];
  for (const c of corners) if (!out.length || !same(out[out.length - 1], c)) out.push(c);
  while (out.length > 1 && same(out[0], out[out.length - 1])) out.pop();
  return out;
}

/** Drop corners where the outline runs straight on (joints), and zero sides. */
export function mergeCollinear(corners: P[]): P[] {
  let pts = dropZeroSides(corners);
  let changed = true;
  while (changed && pts.length > 4) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const straight = (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]);
      if (straight) {
        pts = dropZeroSides(pts.filter((_, j) => j !== i));
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/** A joint is a corner where the outline runs straight on. */
export function isJoint(corners: P[], i: number): boolean {
  const n = corners.length;
  const a = corners[(i - 1 + n) % n];
  const b = corners[i];
  const c = corners[(i + 1) % n];
  return (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]);
}

export function isRectilinear(corners: P[]): boolean {
  if (corners.length < 4) return false;
  return corners.every((a, i) => {
    const b = corners[(i + 1) % corners.length];
    return a[0] === b[0] || a[1] === b[1];
  });
}

/** Whether any two sides that are not neighbours touch or cross. Rough, axis-aligned only. */
export function selfIntersects(corners: P[]): boolean {
  const n = corners.length;
  const sides = corners.map((a, i): [P, P] => [a, corners[(i + 1) % n]]);
  const box = ([a, b]: [P, P]) => [
    Math.min(a[0], b[0]),
    Math.max(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[1], b[1]),
  ];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) {
        // neighbours: they may only share their one corner, not fold back over each other
        const [a, b, c] = j === i + 1 ? [sides[i][0], sides[i][1], sides[j][1]] : [sides[j][0], sides[i][0], sides[i][1]];
        const foldX = a[1] === b[1] && c[1] === b[1] && (a[0] - b[0]) * (c[0] - b[0]) > 0;
        const foldZ = a[0] === b[0] && c[0] === b[0] && (a[1] - b[1]) * (c[1] - b[1]) > 0;
        if (foldX || foldZ) return true;
        continue;
      }
      const [ax0, ax1, az0, az1] = box(sides[i]);
      const [bx0, bx1, bz0, bz1] = box(sides[j]);
      if (ax0 <= bx1 && bx0 <= ax1 && az0 <= bz1 && bz0 <= az1) return true;
    }
  }
  return false;
}

/** Signed area, mm² (shoelace). */
export function area(corners: P[]): number {
  let sum = 0;
  corners.forEach(([x0, z0], i) => {
    const [x1, z1] = corners[(i + 1) % corners.length];
    sum += x0 * z1 - x1 * z0;
  });
  return sum / 2;
}

function inside(corners: P[], x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const [xi, zi] = corners[i];
    const [xj, zj] = corners[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Add a rectangle to an outline, or cut one out of it, on a compressed grid of
 * every x and z in play. Returns the largest piece's outline, and how many
 * pieces and holes there were (the prototype keeps one simple outline only).
 */
export function combineRect(
  corners: P[] | null,
  rect: [P, P],
  mode: "add" | "cut",
): { corners: P[] | null; pieces: number } {
  const [[rx0, rz0], [rx1, rz1]] = [
    [Math.min(rect[0][0], rect[1][0]), Math.min(rect[0][1], rect[1][1])],
    [Math.max(rect[0][0], rect[1][0]), Math.max(rect[0][1], rect[1][1])],
  ];
  const xs = [...new Set([...(corners ?? []).map((c) => c[0]), rx0, rx1])].sort((a, b) => a - b);
  const zs = [...new Set([...(corners ?? []).map((c) => c[1]), rz0, rz1])].sort((a, b) => a - b);
  const W = xs.length - 1;
  const H = zs.length - 1;
  const filled = (i: number, j: number): boolean => cells[j * W + i] ?? false;
  const cells: boolean[] = [];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cz = (zs[j] + zs[j + 1]) / 2;
      const inOld = corners ? inside(corners, cx, cz) : false;
      const inRect = cx > rx0 && cx < rx1 && cz > rz0 && cz < rz1;
      cells.push(mode === "add" ? inOld || inRect : inOld && !inRect);
    }
  }
  const at = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && filled(i, j);
  // directed boundary sides, each cell's interior on the same hand
  const next = new Map<string, P[]>();
  const key = (p: P) => `${p[0]},${p[1]}`;
  const push = (a: P, b: P) => {
    const list = next.get(key(a)) ?? [];
    list.push(b);
    next.set(key(a), list);
  };
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (!at(i, j)) continue;
      const [x0, x1, z0, z1] = [xs[i], xs[i + 1], zs[j], zs[j + 1]];
      if (!at(i, j - 1)) push([x0, z0], [x1, z0]);
      if (!at(i + 1, j)) push([x1, z0], [x1, z1]);
      if (!at(i, j + 1)) push([x1, z1], [x0, z1]);
      if (!at(i - 1, j)) push([x0, z1], [x0, z0]);
    }
  }
  const loops: P[][] = [];
  for (const [startKey] of next) {
    while ((next.get(startKey)?.length ?? 0) > 0) {
      const start = startKey.split(",").map(Number) as P;
      const loop: P[] = [start];
      let at2 = start;
      for (let guard = 0; guard < 10000; guard++) {
        const list = next.get(key(at2));
        if (!list?.length) break;
        const to = list.shift() as P;
        if (same(to, start)) break;
        loop.push(to);
        at2 = to;
      }
      loops.push(mergeCollinear(loop));
    }
  }
  if (!loops.length) return { corners: null, pieces: 0 };
  loops.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  return { corners: loops[0], pieces: loops.length };
}
