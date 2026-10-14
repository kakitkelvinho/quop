// A setup as text, typed or pasted into the JSON panel or read from a file,
// checked before it can replace the table: within a size, valid JSON, a
// setup's shape and a sane number of things. parseScene then keeps only what
// it can read, and the check says how much it left out.

import { GROUP_LIMIT, parseScene, type BuilderSceneData } from "./types.ts";

/** The most text a setup may be, bytes: a large lab setup is a few tens of kB. */
export const SCENE_TEXT_MAX_BYTES = 1_000_000;

/** The most of each a setup may hold, so a hand-made file can't stall the page. */
export const SCENE_LIMITS = { components: 500, beams: 200, connections: 500, frames: 100, groups: GROUP_LIMIT } as const;

const NOUNS: Record<keyof typeof SCENE_LIMITS, [string, string]> = {
  components: ["part", "parts"],
  beams: ["beam", "beams"],
  connections: ["connection", "connections"],
  frames: ["frame", "frames"],
  groups: ["group", "groups"],
};

const count = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;

export type SceneTextCheck =
  | {
      ok: true;
      scene: BuilderSceneData;
      /** what it holds, as a sentence: "12 parts, 2 beams, 1 connection" */
      summary: string;
      /** entries parseScene couldn't read and left out */
      skipped: number;
    }
  | { ok: false; error: string };

/** "line 4, column 12" for a character offset into `text`. */
function lineAndColumn(text: string, offset: number): string {
  const before = text.slice(0, offset).split("\n");
  return `line ${before.length}, column ${before.at(-1)!.length + 1}`;
}

/**
 * Where in `text` a JSON.parse error points, if it says. Node and some faults
 * give the position. Otherwise Chrome quotes the stretch around the fault:
 * `Unexpected token ',', ..."onents": [,\n    {"id"... is not valid JSON`,
 * in quotes and trimmed with "..." where it is cut, which is found in the text.
 */
export function errorPlace(text: string, message: string): string | null {
  const lineColumn = /line (\d+) column (\d+)/i.exec(message);
  if (lineColumn) return `line ${lineColumn[1]}, column ${lineColumn[2]}`;
  const position = /position (\d+)/i.exec(message);
  if (position) return lineAndColumn(text, Number(position[1]));
  if (/unexpected end/i.test(message)) return lineAndColumn(text, text.length);
  const quoted = /^Unexpected token '([\s\S])', ([\s\S]*) is not valid JSON$/.exec(message);
  if (!quoted) return null;
  const [, token] = quoted;
  let stretch = quoted[2];
  const cutBefore = stretch.startsWith("...");
  if (cutBefore) stretch = stretch.slice(3);
  if (stretch.endsWith("...")) stretch = stretch.slice(0, -3);
  // the stretch sits in quotes of its own, inside any "..."
  if (stretch.startsWith('"') && stretch.endsWith('"')) stretch = stretch.slice(1, -1);
  const at = text.indexOf(stretch);
  if (at < 0) return null;
  // the stretch starts about 10 characters before the fault when cut there
  const named = stretch.indexOf(token, cutBefore ? 5 : 0);
  return lineAndColumn(text, at + Math.max(0, named));
}

/** Check a setup's text: why it can't be loaded, or the setup it makes. */
export function checkSceneText(text: string): SceneTextCheck {
  if (!text.trim()) return { ok: false, error: "There's nothing here yet: paste or type a setup's JSON." };
  if (new TextEncoder().encode(text).length > SCENE_TEXT_MAX_BYTES) {
    return { ok: false, error: `That's over ${SCENE_TEXT_MAX_BYTES / 1_000_000} MB, far more than any setup.` };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const place = errorPlace(text, error instanceof Error ? error.message : "");
    return { ok: false, error: `That isn't valid JSON${place ? `: the problem is at ${place}` : ""}.` };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "That isn't a setup: a setup is one JSON object, { … }." };
  }
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.components)) {
    return { ok: false, error: 'That isn\'t a setup: it has no "components" list.' };
  }
  for (const key of Object.keys(SCENE_LIMITS) as (keyof typeof SCENE_LIMITS)[]) {
    const list = raw[key];
    if (list !== undefined && !Array.isArray(list)) {
      return { ok: false, error: `"${key}" should be a list, [ … ].` };
    }
    if (Array.isArray(list) && list.length > SCENE_LIMITS[key]) {
      return { ok: false, error: `That has ${count(list.length, NOUNS[key])}; a setup holds at most ${SCENE_LIMITS[key]}.` };
    }
  }

  const scene = parseScene(raw);
  if (!scene) return { ok: false, error: "That isn't a setup the Tabletop can read." };

  const given = (key: keyof typeof SCENE_LIMITS) => (Array.isArray(raw[key]) ? (raw[key] as unknown[]).length : 0);
  const skipped =
    given("components") - scene.components.length +
    (given("beams") - scene.beams.length) +
    (given("connections") - scene.connections.length) +
    (given("frames") - scene.frames.length) +
    (given("groups") - scene.groups.length);
  const summary = (Object.keys(SCENE_LIMITS) as (keyof typeof SCENE_LIMITS)[])
    .filter((key) => key === "components" || scene[key].length > 0)
    .map((key) => count(scene[key].length, NOUNS[key]))
    .join(", ");
  return { ok: true, scene, summary, skipped: Math.max(0, skipped) };
}
