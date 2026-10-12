// Drawing a frame by its corners (#155). A drawing is the corners placed so
// far, in click order. The builder hands these the table point under the
// pointer and shows what they return; every outline they finish is held to
// the rules a saved one is (see `outlineProblem`).

import { type Corner, clampToTable, normaliseCorners, outlineProblem, snapToGrid } from "./types.ts";

/** What a click, a double-click or Enter does to a drawing. */
export type DrawingStep =
  | { kind: "corner"; corners: Corner[] }
  /** the finished outline, in standard form */
  | { kind: "done"; corners: Corner[] }
  /** a sentence for the status line */
  | { kind: "refused"; reason: string }
  | { kind: "none" };

/** What the pointer at a table point would do, for the preview. */
export type DrawingPreview = {
  /** the corner a click there places; null when a click there closes the outline */
  next: Corner | null;
  /** from the last corner through any elbow back to the first, once there is an outline to close */
  closing: Corner[] | null;
  refused: "next" | "closing" | null;
  /** why, as a sentence for the status line */
  reason: string | null;
};

const same = ([ax, az]: Corner, [bx, bz]: Corner) => ax === bx && az === bz;

/** A table point on the grid `step`; adding 0 turns the −0 rounding gives just left of zero into 0. */
const onGrid = ([x, z]: Corner, step: number): Corner => clampToTable(snapToGrid(x, step) + 0, snapToGrid(z, step) + 0);

/**
 * Where a click at `point` puts the next corner, on the grid `step`: the first
 * anywhere on the table, and each after it along x or z from the last,
 * whichever way the pointer has moved further, so every side runs along an
 * axis.
 */
export function nextCorner(corners: Corner[], [x, z]: Corner, step: number): Corner {
  const [snappedX, snappedZ] = onGrid([x, z], step);
  const last = corners.at(-1);
  if (!last) return [snappedX, snappedZ];
  return Math.abs(x - last[0]) >= Math.abs(z - last[1]) ? [snappedX, last[1]] : [last[0], snappedZ];
}

/**
 * The corners as a loop: back from the last corner to the first, through an
 * elbow when the two don't line up. The elbow turns at the last corner, or,
 * when only that makes an outline a frame can have, runs straight on from it
 * and turns at the first.
 */
export function closeOutline(corners: Corner[]): Corner[] {
  const first = corners[0];
  const last = corners.at(-1);
  if (!first || !last || last[0] === first[0] || last[1] === first[1]) return corners;
  const before = corners.at(-2) ?? first;
  const downFirst: Corner = [last[0], first[1]];
  const acrossFirst: Corner = [first[0], last[1]];
  // the last side runs along x when it keeps its z; turning, the next runs along z
  const [turn, straightOn] = before[1] === last[1] ? [downFirst, acrossFirst] : [acrossFirst, downFirst];
  const turning = [...corners, turn];
  if (outlineProblem(turning, true) === null) return turning;
  const running = [...corners, straightOn];
  return outlineProblem(running, true) === null ? running : turning;
}

/** Close a drawing into a frame's outline, or say why it can't be. */
export function finishDrawing(corners: Corner[]): DrawingStep {
  if (corners.length < 3) return { kind: "refused", reason: "Can't close the outline: it needs at least 3 corners." };
  const outline = closeOutline(corners);
  const problem = outlineProblem(outline, true);
  if (problem) return { kind: "refused", reason: `Can't close the outline: ${problem}.` };
  return { kind: "done", corners: normaliseCorners(outline) };
}

/**
 * What a click at `point` does. A corner landing on the first one, or a click
 * `onFirst` (near it on screen), closes the outline; a click on the last
 * corner adds nothing. A double-click is this for its first click and
 * `finishDrawing` for its second, so it adds no corner of its own.
 */
export function clickDrawing(
  corners: Corner[],
  point: Corner,
  { step, onFirst = false }: { step: number; onFirst?: boolean },
): DrawingStep {
  const next = nextCorner(corners, point, step);
  if (corners.length >= 3 && (onFirst || same(next, corners[0]))) return finishDrawing(corners);
  const last = corners.at(-1);
  if (last && same(next, last)) return { kind: "none" };
  const problem = outlineProblem([...corners, next], false);
  return problem
    ? { kind: "refused", reason: `Can't put a corner there: ${problem}.` }
    : { kind: "corner", corners: [...corners, next] };
}

/** The way back to the first corner from the end of `path`, elbow included. */
function closingRun(path: Corner[]): Corner[] {
  return [...closeOutline(path).slice(path.length - 1), path[0]];
}

/** What a click at `point` would do, for the dashed preview and the status line. */
export function previewDrawing(
  corners: Corner[],
  point: Corner,
  { step, onFirst = false }: { step: number; onFirst?: boolean },
): DrawingPreview {
  const next = nextCorner(corners, point, step);
  if (corners.length >= 3 && (onFirst || same(next, corners[0]))) {
    const finish = finishDrawing(corners);
    const reason = finish.kind === "refused" ? finish.reason : null;
    return { next: null, closing: closingRun(corners), refused: reason ? "closing" : null, reason };
  }
  const last = corners.at(-1);
  const problem = last && !same(next, last) ? outlineProblem([...corners, next], false) : null;
  if (problem) return { next, closing: null, refused: "next", reason: `Can't put a corner there: ${problem}.` };
  const path = last && same(next, last) ? corners : [...corners, next];
  if (path.length < 3) return { next, closing: null, refused: null, reason: null };
  const closingProblem = outlineProblem(closeOutline(path), true);
  return {
    next,
    closing: closingRun(path),
    refused: closingProblem ? "closing" : null,
    reason: closingProblem ? `Can't close the outline from there: ${closingProblem}.` : null,
  };
}

/** The rectangle dragged out from `from` to `to`, its corners on the grid `step`, and why it can't be a frame, if it can't. */
export function dragRectangle(from: Corner, to: Corner, step: number): { corners: Corner[]; reason: string | null } {
  const [ax, az] = onGrid(from, step);
  const [bx, bz] = onGrid(to, step);
  const [left, right, back, front] = [Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz)];
  const corners: Corner[] = [
    [left, back],
    [right, back],
    [right, front],
    [left, front],
  ];
  const problem = outlineProblem(corners, true);
  return { corners, reason: problem ? `Can't make that rectangle: ${problem}.` : null };
}
