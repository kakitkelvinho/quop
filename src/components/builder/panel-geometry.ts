/**
 * Where a moved panel sits: its rect in the workspace's own pixels, from the
 * workspace's top-left corner. A panel nobody has moved has no rect; today's
 * CSS places it.
 */
export type PanelRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** The workspace's size, px. */
export type PanelBounds = { width: number; height: number };

/** How much of a panel's title bar stays inside the workspace sideways, so it can always be grabbed. */
export const PANEL_KEEP_PX = 90;
/** A panel's title bar height, px: a whole number, so the bar's border never smears. */
export const PANEL_BAR_PX = 30;

/**
 * Whole pixels. A panel at x = 14.4 smears its 1 px border, or loses it, at
 * some window sizes.
 */
export function wholeRect({ x, y, w, h }: PanelRect): PanelRect {
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/**
 * Never stuck: the panel's title bar stays inside the workspace, top to
 * bottom, and at least PANEL_KEEP_PX of it sideways. The rest of the panel
 * may hang off an edge.
 */
export function clampPanel(rect: PanelRect, bounds: PanelBounds): PanelRect {
  const whole = wholeRect(rect);
  const keep = Math.min(PANEL_KEEP_PX, whole.w);
  const between = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  return {
    ...whole,
    x: between(whole.x, keep - whole.w, Math.floor(bounds.width) - keep),
    y: between(whole.y, 0, Math.floor(bounds.height) - PANEL_BAR_PX),
  };
}

/** How far in from the workspace's edges a panel snaps to, px. */
export const PANEL_INSET_PX = 12;
/** The gap a panel snaps to beside, above or below another, px. */
export const PANEL_GAP_PX = 8;
/** How close an edge must come to snap, px. */
export const PANEL_SNAP_PX = 10;

/**
 * Where a panel's left (or top) edge may snap to on one axis, for a panel
 * `size` long: the workspace's edges, inset; and against each other panel,
 * lined up with either of its edges or beside it with the gap.
 */
function snapTargets(size: number, extent: number, others: [number, number][]): number[] {
  const targets = [PANEL_INSET_PX, extent - PANEL_INSET_PX - size];
  for (const [start, length] of others) {
    const end = start + length;
    targets.push(start, end - size, end + PANEL_GAP_PX, start - size - PANEL_GAP_PX);
  }
  return targets;
}

/** The target nearest `value` within PANEL_SNAP_PX, or `value` itself; the first of a tie wins. */
function nearest(value: number, targets: number[]): number {
  let best = value;
  let distance = Infinity;
  for (const target of targets) {
    const off = Math.abs(target - value);
    if (off <= PANEL_SNAP_PX && off < distance) {
      best = target;
      distance = off;
    }
  }
  return best;
}

/**
 * Snap a moving panel, each axis on its own, to the nearest edge within
 * PANEL_SNAP_PX: the workspace's, PANEL_INSET_PX in, or another panel's,
 * lined up or PANEL_GAP_PX beside it. Beyond that it stays where it is.
 */
export function snapPanel(rect: PanelRect, others: PanelRect[], bounds: PanelBounds): PanelRect {
  return {
    ...rect,
    x: nearest(rect.x, snapTargets(rect.w, bounds.width, others.map(({ x, w }) => [x, w]))),
    y: nearest(rect.y, snapTargets(rect.h, bounds.height, others.map(({ y, h }) => [y, h]))),
  };
}

/**
 * A panel dragged by its bar: where it started, moved by the pointer, snapped
 * to the workspace and the other panels, and kept in reach.
 */
export function movePanel(
  start: PanelRect,
  dx: number,
  dy: number,
  bounds: PanelBounds,
  others: PanelRect[] = [],
): PanelRect {
  return clampPanel(snapPanel({ ...start, x: start.x + dx, y: start.y + dy }, others, bounds), bounds);
}

/**
 * Where a maximised panel goes, px: between the Parts panel's own top and
 * bottom (7.3rem and 3.8rem), so its bar clears the + toolbar and its foot the
 * View toolbar, and the workspace's inset at the sides.
 */
export const PANEL_MAX_TOP_PX = 117;
export const PANEL_MAX_BOTTOM_PX = 61;

/** A maximised panel's rect: the workspace below the toolbars, whole pixels, never below the minimum. */
export function maximisedRect(bounds: PanelBounds): PanelRect {
  return wholeRect({
    x: PANEL_INSET_PX,
    y: PANEL_MAX_TOP_PX,
    w: Math.max(PANEL_KEEP_PX, bounds.width - 2 * PANEL_INSET_PX),
    h: Math.max(PANEL_BAR_PX, bounds.height - PANEL_MAX_TOP_PX - PANEL_MAX_BOTTOM_PX),
  });
}
