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

/** A panel dragged by its bar: where it started, moved by the pointer, kept in reach. */
export function movePanel(start: PanelRect, dx: number, dy: number, bounds: PanelBounds): PanelRect {
  return clampPanel({ ...start, x: start.x + dx, y: start.y + dy }, bounds);
}
