import { bringPanelToFront, panelState, setPanelView } from "./panel-store.ts";

/**
 * Where panels move (wide screens, fine pointers), a minimised panel leaves
 * the table: it is hidden, and an icon for it waits in a column at the bottom
 * left until it is restored. This is the logic of it; the column and the
 * View island's panels menu are `minimised-column.tsx`.
 */

/** One of the Tabletop's panels, as the column and the panels menu see it. */
export type TabletopPanel = {
  /** its id in the panel store */
  id: TabletopPanelId;
  title: string;
  /** what it holds, e.g. the Inspector's selection: shown after the title in the column */
  subtitle?: string;
  /** on the page: the Inspector while something is selected, a list while it has rows, a closing panel while open */
  mounted: boolean;
};

export type TabletopPanelId = "inspector" | "beams" | "frames" | "groups" | "parts" | "brief" | "json";

/** Whether a panel is minimised here: never where panels stay put, whatever the store kept. */
export type IsMinimised = (id: string) => boolean;

export function minimisedIn(moves: boolean): IsMinimised {
  return (id) => moves && Boolean(panelState(id).minimised);
}

/**
 * Every panel the Tabletop has, in the column's order (top to bottom).
 * The brief and the JSON panel share the parts panel's spot, so they are on
 * the page only while it is closed.
 */
export function tabletopPanels({
  inspector,
  beams,
  frames,
  groups,
  partsOpen,
  briefOpen,
  jsonOpen,
}: {
  /** what the Inspector holds; null while nothing is selected or drafted */
  inspector: { subtitle?: string } | null;
  beams: number;
  frames: number;
  groups: number;
  partsOpen: boolean;
  briefOpen: boolean;
  jsonOpen: boolean;
}): TabletopPanel[] {
  return [
    { id: "inspector", title: "Inspector", subtitle: inspector?.subtitle, mounted: inspector !== null },
    { id: "parts", title: "Parts", mounted: partsOpen },
    { id: "brief", title: "Setup brief", mounted: briefOpen && !partsOpen },
    { id: "json", title: "Setup JSON", mounted: jsonOpen && !partsOpen },
    { id: "beams", title: "Beams", mounted: beams > 0 },
    { id: "frames", title: "Frames", mounted: frames > 0 },
    { id: "groups", title: "Groups", mounted: groups > 0 },
  ];
}

/** The panels in the column: on the page, and minimised. */
export function minimisedPanels(panels: TabletopPanel[], isMinimised: IsMinimised): TabletopPanel[] {
  return panels.filter((panel) => panel.mounted && isMinimised(panel.id));
}

/** The panels Minimise all would minimise: those showing on the table. */
export function showingPanels(panels: TabletopPanel[], isMinimised: IsMinimised): TabletopPanel[] {
  return panels.filter((panel) => panel.mounted && !isMinimised(panel.id));
}

/** Minimise every panel showing on the table; how many that was. */
export function minimiseAll(panels: TabletopPanel[], isMinimised: IsMinimised): number {
  const showing = showingPanels(panels, isMinimised);
  showing.forEach((panel) => setPanelView(panel.id, "minimised"));
  return showing.length;
}

/** Back on the table where it was, in front of the others. */
export function restorePanel(id: string) {
  setPanelView(id, "restored");
  bringPanelToFront(id);
}

/** A column button's name, for its label and for a screen reader: "Restore Inspector: Mirror M3". */
export function restoreLabel(panel: Pick<TabletopPanel, "title" | "subtitle">): string {
  return `Restore ${panel.title}${panel.subtitle ? `: ${panel.subtitle}` : ""}`;
}

/**
 * Whether the parts panel's spot at the left is taken by a panel that is
 * showing: the parts panel, or the brief or JSON panel in its place. The lists
 * and the column step right of it; a minimised one, hidden, leaves no gap.
 */
export function partsSpotShowing(
  { partsOpen, briefOpen, jsonOpen }: { partsOpen: boolean; briefOpen: boolean; jsonOpen: boolean },
  isMinimised: IsMinimised,
): boolean {
  if (partsOpen) return !isMinimised("parts");
  return (briefOpen && !isMinimised("brief")) || (jsonOpen && !isMinimised("json"));
}

/**
 * What the Inspector shows, as a key that changes only when the selection
 * does: a draft (whatever it has clicked so far), the selected parts (in any
 * order), or a beam, frame or connection. Empty while nothing is selected.
 * The order of the checks is the Inspector's own.
 */
export function selectionKey({
  beamDraft,
  connectDraft,
  parts,
  beam,
  frame,
  connection,
}: {
  beamDraft: boolean;
  connectDraft: boolean;
  parts: readonly string[];
  beam?: string | null;
  frame?: string | null;
  connection?: string | null;
}): string {
  if (beamDraft) return "beam-draft";
  if (connectDraft) return "connect-draft";
  if (parts.length) return `parts:${[...parts].sort().join(",")}`;
  if (beam) return `beam:${beam}`;
  if (frame) return `frame:${frame}`;
  if (connection) return `connection:${connection}`;
  return "";
}

/**
 * Whether a minimised Inspector opens again: when something new is selected
 * or drafted. Re-selecting what it already held, or selecting nothing, isn't.
 */
export function selectionReopensInspector(previous: string, next: string): boolean {
  return next !== "" && next !== previous;
}
