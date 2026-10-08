"use client";

import { useState, type ChangeEvent, type KeyboardEvent } from "react";

/** The number a field's text spells, or null while it spells none: "", "-", "1e". */
export function parseNumberDraft(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

export type DraftEvent =
  /** the text changed because someone typed or pasted */
  | { type: "type"; text: string }
  /** the text changed because a stepper button or an arrow key stepped it */
  | { type: "step"; text: string }
  /** blur or Enter */
  | { type: "settle" }
  /** Esc */
  | { type: "cancel" };

/**
 * The text of a number field is a draft while it is being edited: "-" and an
 * empty field are steps on the way to a number, not numbers, so they must not
 * reach the value. `draft` is that text, or null when the field just shows the
 * value. `commit` is the number to hand on, if the event produced one.
 *
 * A field commits when the draft is settled (blur or Enter) and never mid-word,
 * unless it is `live`: then every typed text that parses commits at once, for a
 * field whose value is safe to apply half-typed.
 */
export function reduceDraft(
  draft: string | null,
  event: DraftEvent,
  live: boolean,
): { draft: string | null; commit: number | null } {
  switch (event.type) {
    case "type":
      return { draft: event.text, commit: live ? parseNumberDraft(event.text) : null };
    case "step":
      // a step is a whole number the person asked for, so it applies now and
      // the field goes back to showing the value, which may have been clamped
      return { draft: null, commit: parseNumberDraft(event.text) };
    case "settle":
      return { draft: null, commit: !live && draft !== null ? parseNumberDraft(draft) : null };
    case "cancel":
      return { draft: null, commit: null };
  }
}

/**
 * Props for an `<input type="number">` that keeps what is typed as a draft
 * until it is a number (see `reduceDraft`). Text that never becomes one is
 * dropped on blur and the field shows the value again.
 */
export function useNumberDraft(
  value: number,
  onCommit: (value: number) => void,
  { live = false }: { live?: boolean } = {},
) {
  const [draft, setDraft] = useState<string | null>(null);

  const send = (event: DraftEvent) => {
    const next = reduceDraft(draft, event, live);
    setDraft(next.draft);
    if (next.commit !== null) onCommit(next.commit);
  };

  return {
    value: draft ?? value,
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      // browsers fire a plain Event for a step and an InputEvent for typing; where
      // one reports a step as typing, it applies on blur like any other edit
      send({ type: event.nativeEvent instanceof InputEvent ? "type" : "step", text: event.target.value }),
    onBlur: () => send({ type: "settle" }),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") send({ type: "settle" });
      else if (event.key === "Escape") send({ type: "cancel" });
    },
  };
}
