// Reshaping a selected frame by dragging a side or a corner (#156). Every
// outline these return is in standard form and held to the rules a saved one
// is (see `isValidOutline`): a drag that would fold or cross the outline stops
// at the last place it could go.

import { type Corner, FRAME_SIZE_RANGE_MM, clampToTable, isValidOutline, normaliseCorners } from "./types.ts";

/** What a press on a selected frame took hold of: side `index` runs from corner `index` to the next. */
export type FrameGrip = { kind: "side"; index: number } | { kind: "corner"; index: number };

/** Which way a side runs. */
const along = ([, z0]: Corner, [, z1]: Corner): "x" | "z" => (z0 === z1 ? "x" : "z");

/**
 * The outline with side `index` moved, perpendicular to itself, to `to` (its
 * z when it runs along x, its x when it runs along z). The sides either side
 * of it stretch or shrink; one that runs straight on from it keeps its place
 * and the moved side grows a step to meet it instead.
 */
export function moveSide(corners: Corner[], index: number, to: number): Corner[] {
  const count = corners.length;
  const end = (index + 1) % count;
  const [from, till] = [corners[index], corners[end]];
  const axis = along(from, till);
  const moved = ([x, z]: Corner): Corner => (axis === "x" ? [x, to] : [to, z]);
  return corners.flatMap((corner, at): Corner[] => {
    if (at === index) {
      const before = corners[(index + count - 1) % count];
      return along(before, from) === axis ? [from, moved(from)] : [moved(from)];
    }
    if (at === end) {
      const after = corners[(end + 1) % count];
      return along(till, after) === axis ? [moved(till), till] : [moved(till)];
    }
    return [corner];
  });
}

/**
 * The outline with corner `index` moved to `to`. Both sides that meet there
 * keep running along x and z, so the corners at their far ends slide with it.
 */
export function moveCorner(corners: Corner[], index: number, [x, z]: Corner): Corner[] {
  // from the corner before it, so neither side meeting there wraps round the list
  const start = (index + corners.length - 1) % corners.length;
  const ring = [...corners.slice(start), ...corners.slice(0, start)];
  const leaving = along(ring[1], ring[2]);
  const first = moveSide(ring, 1, leaving === "x" ? z : x);
  // a side running straight on into the corner put a step in before it
  const at = along(ring[0], ring[1]) === leaving ? 2 : 1;
  return moveSide(first, at - 1, along(first[at - 1], first[at]) === "x" ? z : x);
}

function reshape(corners: Corner[], grip: FrameGrip, [x, z]: Corner): Corner[] | null {
  const { index } = grip;
  const next = corners[(index + 1) % corners.length];
  const outline = normaliseCorners(
    grip.kind === "corner" ? moveCorner(corners, index, [x, z]) : moveSide(corners, index, along(corners[index], next) === "x" ? z : x),
  );
  return isValidOutline(outline) ? outline : null;
}

/**
 * The furthest value from `from` towards `to` whose outline `fits` (its corner
 * count, or null), every millimetre on the way fitting too, landing on the
 * grid `step` or on `to` itself. A drag so never jumps across a fold. The one
 * gap it crosses is a side squeezed under its minimum on the way to vanishing:
 * onto the outline it vanishes into, which has fewer corners, or back out of
 * it towards `home`, where the press was.
 */
function furthest(from: number, to: number, step: number, home: number, fits: (value: number) => number | null): number {
  const [shortest] = FRAME_SIZE_RANGE_MM;
  const ahead = Math.sign(to - from);
  let reached = from;
  let count = fits(from);
  for (let value = from; value !== to; ) {
    value = ahead > 0 ? Math.min(Math.floor(value) + 1, to) : Math.max(Math.ceil(value) - 1, to);
    let corners = fits(value);
    for (let skip = value; corners === null && Math.abs(skip - value) < shortest && skip !== to; ) {
      skip += ahead;
      const across = fits(skip);
      if (across !== null && (across < (count ?? 0) || (home - skip) * ahead >= 0)) [value, corners] = [skip, across];
    }
    if (corners === null) break;
    count = corners;
    if (value === to || value % step === 0) reached = value;
  }
  return reached;
}

/**
 * A drag of `grip` on the outline `corners` had at the press, from the grip
 * point it last reached, `from`, towards the pointer's, `to`, both on the
 * table. Returns the outline, in standard form, and the grip point it
 * reached: as far towards `to` as the outline stays valid all the way, an
 * axis at a time, so a corner slides along a limit. Pass that point back as
 * `from` on the next move.
 */
export function dragGrip(
  corners: Corner[],
  grip: FrameGrip,
  from: Corner,
  to: Corner,
  step: number,
): { corners: Corner[]; reached: Corner } {
  const [toX, toZ] = clampToTable(to[0], to[1]);
  const home = corners[grip.index];
  const x = furthest(from[0], toX, step, home[0], (value) => reshape(corners, grip, [value, from[1]])?.length ?? null);
  const z = furthest(from[1], toZ, step, home[1], (value) => reshape(corners, grip, [x, value])?.length ?? null);
  return { corners: reshape(corners, grip, [x, z]) ?? normaliseCorners(corners), reached: [x, z] };
}
