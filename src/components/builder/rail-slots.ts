import { bringPanelToFront, panelState, setPanelView } from "./panel-store.ts";

/**
 * The panel rail, bottom left: one slot each for Beams, Frames and Groups,
 * always there. A slot with items shows or hides its list (and brings a
 * minimised one back); an empty slot starts making the first one, and pressed
 * again while that is live, stops it. This is the logic of a slot; the rail
 * itself is `panel-rail.tsx`.
 */

export type RailSlotState = {
  /** how many the list holds */
  count: number;
  /** its list is on the table: neither hidden from the rail nor minimised */
  shown: boolean;
  /** what the empty slot starts is live (beam mode, a frame being drawn, group mode) */
  live: boolean;
  /** whether it can start now (a beam needs two parts) */
  canCreate: boolean;
};

export type RailAction = "toggle" | "create" | "stop" | "none";

/** What pressing a slot does. */
export function railSlotAction({ count, live, canCreate }: RailSlotState): RailAction {
  if (count > 0) return "toggle";
  if (live) return "stop";
  return canCreate ? "create" : "none";
}

/**
 * How a slot looks: in the accent while what it started is live (the accent
 * is for what's live), pressed in a neutral tint while its list shows, dimmed
 * while empty, with a + in place of a count.
 */
export function railSlotLook(state: RailSlotState) {
  const empty = state.count === 0;
  return {
    empty,
    active: empty && state.live,
    shown: !empty && state.shown,
    disabled: railSlotAction(state) === "none",
    badge: empty ? "+" : String(state.count),
  };
}

/** A slot's name, for its tooltip and a screen reader: the list and its count, or the action an empty one takes. */
export function railSlotLabel(
  title: string,
  state: RailSlotState,
  create: { start: string; stop: string },
): string {
  if (state.count > 0) return `${title} (${state.count})`;
  return state.live ? create.stop : create.start;
}

/**
 * A slot with items, pressed where panels move: a minimised list comes back
 * where it was, in front; a list on the table is minimised (its bar's own
 * minimise does the same, and the slot brings it back).
 */
export function toggleListPanel(id: string) {
  if (panelState(id).minimised) {
    setPanelView(id, "restored");
    bringPanelToFront(id);
  } else setPanelView(id, "minimised");
}
