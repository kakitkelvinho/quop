// What the JSON panel's box shows. Until the author types, pastes or opens a
// file into it, the box follows the table: every drag, turn, edit, group, add
// or delete shows up in it, so Copy always copies what is on screen. Once
// they edit it, their text is a draft that the table's changes never
// overwrite; the panel says it isn't on the table yet, and whether the table
// has moved on since the draft began. Apply or Revert ends the draft and the
// box follows the table again.

/** Text the author put in the box, and the table's JSON when they began. */
export type JsonDraft = { text: string; base: string };

export type JsonPanelView = {
  /** what the box shows */
  text: string;
  /** the box holds the author's draft, not the table */
  edited: boolean;
  /** the table has changed since the draft began */
  behind: boolean;
};

/** The box for the table's JSON as it is now, `live`, and any draft. */
export function jsonPanelView(live: string, draft: JsonDraft | null): JsonPanelView {
  if (!draft) return { text: live, edited: false, behind: false };
  return { text: draft.text, edited: true, behind: draft.base !== live };
}

/**
 * The draft after the author puts `text` in the box. Text that matches the
 * table again is no draft, so the box goes back to following it.
 */
export function editJson(live: string, draft: JsonDraft | null, text: string): JsonDraft | null {
  if (text === live) return null;
  return { text, base: draft?.base ?? live };
}
