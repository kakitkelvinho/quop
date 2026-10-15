// Which beam a click on the table picks. Beams can run on top of one another,
// so a click picks the nearest beam under the pointer, and clicking the same
// spot again moves on to the next one there, round and round.

/** How far, in screen pixels, a click may land from the last and still count as the same spot. */
export const SAME_SPOT_PX = 6;

export type BeamPick = {
  /** where the click was, client pixels */
  x: number;
  y: number;
  /** the beams under it, nearest first */
  ids: string[];
  /** which of them it picked */
  index: number;
};

/**
 * The pick for a click at (x, y) over `ids`, nearest first, given the last
 * pick. The same spot over the same beams moves on to the next; anything else
 * starts again at the nearest.
 */
export function pickBeam(last: BeamPick | null, ids: string[], x: number, y: number): BeamPick {
  const again =
    last !== null &&
    Math.hypot(x - last.x, y - last.y) <= SAME_SPOT_PX &&
    sameMembers(last.ids, ids);
  return { x, y, ids, index: again ? (last.index + 1) % ids.length : 0 };
}

/** The beam ids in a click's hits, nearest first, each once. */
export function beamsHit(hits: { object: { userData: Record<string, unknown> } }[]): string[] {
  const ids: string[] = [];
  for (const hit of hits) {
    const id = hit.object.userData.beamId;
    if (typeof id === "string" && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function sameMembers(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}
