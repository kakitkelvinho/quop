/**
 * Group mode: the empty Groups slot on the panel rail starts it. The author
 * picks parts as usual (⌘ click, ⌘ drag), then Enter, or the slot pressed
 * again, makes them a group; Esc cancels. One part is no group, so with fewer
 * than two picked it just stops.
 */

/** A key and what it does, as the mode badge shows it. */
export type ModeHint = [key: string, action: string];

/** The fewest parts a group is made of. */
export const GROUP_MIN_PARTS = 2;

/** What ending the mode does, with this many parts picked: group them, or just stop. */
export function finishGroupMode(picked: number): "group" | "stop" {
  return picked >= GROUP_MIN_PARTS ? "group" : "stop";
}

/** The badge's hints: Enter names how many it would group once there are enough. */
export function groupModeHints(picked: number): ModeHint[] {
  return [
    ["⌘ click", "pick"],
    ["⌘ drag", "box"],
    ["Enter", finishGroupMode(picked) === "group" ? `group ${picked}` : "group"],
    ["Esc", "cancel"],
  ];
}

/** The Groups slot's name while the mode is live: what pressing it again does. */
export function groupSlotLabel(picked: number): string {
  return finishGroupMode(picked) === "group" ? `Group the ${picked} picked parts` : "Stop grouping";
}
