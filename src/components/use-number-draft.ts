"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

/** The number a field's text spells, or null while it spells none: "", "-", "1e". */
export function parseNumberDraft(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

/**
 * Whether the `input` event of a number field was a step (arrow key or spinner)
 * and not an edit of its text. Chromium and WebKit fire a plain `Event`, which
 * has no `inputType`. Firefox fires an `InputEvent` of type
 * "insertReplacementText" for a step, while typing, deleting, pasting and
 * dropping are insertText, deleteContent*, insertFromPaste and so on.
 */
export function isStepInput(event: { inputType?: string }): boolean {
  return event.inputType === undefined || event.inputType === "insertReplacementText";
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
 *
 * Leaving the field any other way settles it too: if the field unmounts with a
 * draft pending (clicking another part swaps the inspector before the input
 * blurs), the draft is committed. It goes to the `onCommit` of the field's last
 * render, so it reaches whatever owned the field then, not what replaced it.
 */
export function useNumberDraft(
  value: number,
  onCommit: (value: number) => void,
  { live = false }: { live?: boolean } = {},
) {
  const [draft, setDraft] = useState<string | null>(null);
  // What the unmount below can read. The draft is written the moment it changes
  // rather than on the next render, so blur and unmount settle it only once.
  const latest = useRef({ draft: null as string | null, onCommit, live });
  useEffect(() => {
    latest.current.onCommit = onCommit;
    latest.current.live = live;
  });

  const send = (event: DraftEvent) => {
    const next = reduceDraft(latest.current.draft, event, live);
    latest.current.draft = next.draft;
    setDraft(next.draft);
    if (next.commit !== null) onCommit(next.commit);
  };

  useEffect(
    () => () => {
      const field = latest.current;
      const next = reduceDraft(field.draft, { type: "settle" }, field.live);
      field.draft = null;
      if (next.commit !== null) field.onCommit(next.commit);
    },
    [],
  );

  return {
    value: draft ?? value,
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      send({
        type: isStepInput(event.nativeEvent as Event & { inputType?: string }) ? "step" : "type",
        text: event.target.value,
      }),
    onBlur: () => send({ type: "settle" }),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") send({ type: "settle" });
      else if (event.key === "Escape") send({ type: "cancel" });
    },
  };
}
