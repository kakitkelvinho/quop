import { type PanelBounds, type PanelRect, clampPanel } from "./panel-geometry.ts";

/**
 * The Tabletop's panels: where each moved one sits and which is in front.
 * One store for the page, so a panel that closes (the Inspector, whenever
 * nothing is selected) opens again where it was left.
 */
export type PanelState = {
  /** where it was moved to; none while today's CSS places it */
  rect?: PanelRect;
  /** its place in the stack: the panel last pressed is highest */
  z?: number;
};

/** Above every panel's own CSS z-index (5 and 6), so a pressed panel clears the ones never pressed. */
const FIRST_Z = 10;

let panels = new Map<string, PanelState>();
let top = FIRST_Z;
let version = 0;
const listeners = new Set<() => void>();

function changed() {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribePanels(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Changes whenever any panel does, for useSyncExternalStore. */
export function panelsVersion(): number {
  return version;
}

export function panelState(id: string): PanelState {
  return panels.get(id) ?? {};
}

/** The panel just pressed comes to the front. */
export function bringPanelToFront(id: string) {
  const current = panelState(id);
  if (current.z === top) return;
  top += 1;
  panels.set(id, { ...current, z: top });
  changed();
}

export function movePanelTo(id: string, rect: PanelRect) {
  panels.set(id, { ...panelState(id), rect });
  changed();
}

/** The workspace changed size: every moved panel slides back in reach. */
export function keepPanelsInside(bounds: PanelBounds) {
  let moved = false;
  for (const [id, state] of panels) {
    if (!state.rect) continue;
    const rect = clampPanel(state.rect, bounds);
    if (rect.x === state.rect.x && rect.y === state.rect.y) continue;
    panels.set(id, { ...state, rect });
    moved = true;
  }
  if (moved) changed();
}

/** Every panel back where it starts, in its own CSS order. */
export function resetPanels() {
  panels = new Map();
  top = FIRST_Z;
  changed();
}
