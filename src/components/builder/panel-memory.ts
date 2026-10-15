import type { PanelRect } from "./panel-geometry.ts";
import type { PanelState } from "./panel-store.ts";

/**
 * The panels' arrangement, kept in this browser: each panel's place and size,
 * and whether it is minimised, maximised or resized. A viewer setting, like
 * the graphics quality: never in the setup file, the JSON panel or the brief.
 * The stacking order isn't kept; panels open in their own CSS order.
 */
export const PANELS_STORAGE_KEY = "quop-builder-panels:v1";
const VERSION = 1;

/** The panels there are, so a saved name nothing answers to is dropped. */
export const PANEL_IDS = ["parts", "inspector", "beams", "frames", "groups", "brief", "json"] as const;

/** Far past any screen, px: a coordinate or size beyond it is not one this page wrote. */
const LIMIT_PX = 20000;

type SavedPanel = PanelRect & { minimised?: true; maximised?: true; sized?: true };

/** The arrangement as text to save, or null when every panel is where it starts. */
export function serializePanels(panels: ReadonlyMap<string, PanelState>): string | null {
  const saved: Record<string, SavedPanel> = {};
  for (const [id, { rect, minimised, maximised, sized }] of panels) {
    if (!rect) continue;
    saved[id] = {
      ...rect,
      ...(minimised && { minimised: true }),
      ...(maximised && { maximised: true }),
      ...(sized && { sized: true }),
    };
  }
  return Object.keys(saved).length ? JSON.stringify({ version: VERSION, panels: saved }) : null;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= LIMIT_PX;
}

function isSize(value: unknown): value is number {
  return isCoordinate(value) && value > 0;
}

/**
 * The arrangement saved as `text`. Anything missing, unreadable or of another
 * version is no arrangement at all (every panel where it starts); a panel
 * saved with a name, place or size this page never writes is left out.
 */
export function parseSavedPanels(text: string | null): Map<string, PanelState> {
  const panels = new Map<string, PanelState>();
  if (!text) return panels;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return panels;
  }
  if (typeof data !== "object" || data === null) return panels;
  const { version, panels: saved } = data as { version?: unknown; panels?: unknown };
  if (version !== VERSION || typeof saved !== "object" || saved === null) return panels;
  for (const id of PANEL_IDS) {
    const entry = (saved as Record<string, unknown>)[id];
    if (typeof entry !== "object" || entry === null) continue;
    const { x, y, w, h, minimised, maximised, sized } = entry as Record<string, unknown>;
    if (!isCoordinate(x) || !isCoordinate(y) || !isSize(w) || !isSize(h)) continue;
    panels.set(id, {
      rect: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) },
      // one view at a time, as setPanelView keeps it
      ...(minimised === true && { minimised: true }),
      ...(maximised === true && minimised !== true && { maximised: true }),
      ...(sized === true && { sized: true }),
    });
  }
  return panels;
}

/** The arrangement this browser kept, or none. */
export function readSavedPanels(): Map<string, PanelState> {
  try {
    return parseSavedPanels(window.localStorage.getItem(PANELS_STORAGE_KEY));
  } catch {
    return new Map();
  }
}

/** Keep the arrangement, or forget it once every panel is back where it starts. */
export function savePanels(panels: ReadonlyMap<string, PanelState>): void {
  try {
    const text = serializePanels(panels);
    if (text) window.localStorage.setItem(PANELS_STORAGE_KEY, text);
    else window.localStorage.removeItem(PANELS_STORAGE_KEY);
  } catch {
    // private windows and blocked storage: the arrangement lasts this visit only
  }
}
