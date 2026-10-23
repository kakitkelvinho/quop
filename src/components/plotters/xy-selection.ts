// The generic CSV plotter's X / Y choice, kept free of React so its rules
// can be tested with node:test.

// the x choice that is no column: a value's place in its column (1, 2, ...)
export const ROW_NUMBER = -1;

/**
 * The Ys as chosen: null until the user touches them (every candidate is
 * then plotted), and a list once they have - an empty list plots nothing.
 */
export type YSelection = number[] | null;

// how many Ys start plotted when the user hasn't chosen
export const DEFAULT_PLOTTED = 10;
// and how many can ever be plotted at once: drawing 8 000 series takes seconds
export const PLOTTED_LIMIT = 500;

function byIndex(a: number, b: number) {
  return a - b;
}

// The columns that can be Y: every one but X and those only X can be (a
// clock column).
export function yCandidates(columnCount: number, x: number, xOnly: number[] = []): number[] {
  return Array.from({ length: columnCount }, (_, index) => index).filter(
    (index) => index !== x && !xOnly.includes(index),
  );
}

// The Ys to plot: the chosen ones still on offer, or the first ten
// candidates while nothing has been chosen.
export function resolveY(selection: YSelection, candidates: number[]): number[] {
  if (selection === null) {
    return candidates.slice(0, DEFAULT_PLOTTED);
  }

  const offered = new Set(candidates);
  return selection.filter((index) => offered.has(index));
}

/**
 * The Ys after X moves from `previousX` to `nextX`: the new X leaves the
 * Ys, the old X comes back into them (unless it was Row number or a column
 * only X can be), and the other choices stay. Nothing chosen yet stays
 * that way.
 */
export function swapX(
  selection: YSelection,
  previousX: number,
  nextX: number,
  xOnly: number[] = [],
): YSelection {
  if (selection === null) {
    return null;
  }

  const next = selection.filter((index) => index !== nextX);

  if (
    previousX !== ROW_NUMBER &&
    previousX !== nextX &&
    !xOnly.includes(previousX) &&
    !next.includes(previousX)
  ) {
    next.push(previousX);
  }

  return next.sort(byIndex);
}

// Ticks or unticks one Y, starting from what is plotted now.
export function toggleY(current: number[], index: number, checked: boolean): number[] {
  if (checked) {
    return current.includes(index) ? current : [...current, index].sort(byIndex);
  }

  return current.filter((other) => other !== index);
}

// Ticks every Y the filter shows, keeping the ones already ticked.
export function addY(current: number[], indexes: number[]): number[] {
  return [...new Set([...current, ...indexes])].sort(byIndex);
}

/**
 * Holds a new Y choice to the plotting limit: the Ys already plotted stay,
 * and the new ones are added in column order until the limit is reached,
 * so a tick past it is refused and "All" ticks up to it. `limited` says
 * whether anything was left out.
 */
export function limitY(
  current: number[],
  next: number[],
  limit = PLOTTED_LIMIT,
): { plotted: number[]; limited: boolean } {
  if (next.length <= limit) {
    return { plotted: next, limited: false };
  }

  const kept = new Set(current);
  const plotted = next.filter((index) => kept.has(index)).slice(0, limit);
  const room = limit - plotted.length;
  const added = next.filter((index) => !kept.has(index)).slice(0, room);

  return { plotted: [...plotted, ...added].sort(byIndex), limited: true };
}
