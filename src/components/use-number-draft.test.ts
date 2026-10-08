import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseNumberDraft, reduceDraft, type DraftEvent } from "./use-number-draft.ts";

/** Plays events against a field and returns what it handed on and what it shows. */
function play(events: DraftEvent[], live = false) {
  let draft: string | null = null;
  const commits: number[] = [];
  for (const event of events) {
    const next = reduceDraft(draft, event, live);
    draft = next.draft;
    if (next.commit !== null) commits.push(next.commit);
  }
  return { commits, draft };
}

/** What typing a string one key at a time reports: a browser's number input
 *  reads "" for "-", and for a half-written exponent. */
function typed(...texts: string[]): DraftEvent[] {
  return texts.map((text) => ({ type: "type", text }));
}

describe("parseNumberDraft", () => {
  it("reads the numbers a field can hold", () => {
    assert.equal(parseNumberDraft("-12.5"), -12.5);
    assert.equal(parseNumberDraft("0"), 0);
    assert.equal(parseNumberDraft(" 7 "), 7);
    assert.equal(parseNumberDraft("1e3"), 1000);
  });

  it("reads an empty or half-typed field as no number, not as 0", () => {
    assert.equal(parseNumberDraft(""), null);
    assert.equal(parseNumberDraft("   "), null);
    assert.equal(parseNumberDraft("-"), null);
    assert.equal(parseNumberDraft("1e"), null);
    assert.equal(parseNumberDraft("Infinity"), null);
  });
});

describe("a number field", () => {
  it("commits -12.5 typed one key at a time, once, on Enter", () => {
    const keys = typed("", "-", "-1", "-12", "-12.", "-12.5");
    assert.deepEqual(play(keys), { commits: [], draft: "-12.5" });
    assert.deepEqual(play([...keys, { type: "settle" }]), { commits: [-12.5], draft: null });
  });

  it("keeps a lone minus sign and an empty field in the field until settled", () => {
    assert.deepEqual(play(typed("")), { commits: [], draft: "" });
    assert.deepEqual(play(typed("-")), { commits: [], draft: "-" });
  });

  it("reverts to the value when settled on text that is not a number", () => {
    assert.deepEqual(play([...typed("-"), { type: "settle" }]), { commits: [], draft: null });
    assert.deepEqual(play([...typed(""), { type: "settle" }]), { commits: [], draft: null });
  });

  it("drops the draft on Esc without committing it", () => {
    assert.deepEqual(play([...typed("9", "99"), { type: "cancel" }]), { commits: [], draft: null });
    assert.deepEqual(play([...typed("99"), { type: "cancel" }, { type: "settle" }]), { commits: [], draft: null });
  });

  it("commits nothing when settled without an edit", () => {
    assert.deepEqual(play([{ type: "settle" }]), { commits: [], draft: null });
  });

  it("applies a step at once and shows the value again", () => {
    assert.deepEqual(play([{ type: "step", text: "330" }]), { commits: [330], draft: null });
  });

  it("applies a step taken from a half-typed draft", () => {
    assert.deepEqual(play([...typed("-"), { type: "step", text: "5" }]), { commits: [5], draft: null });
  });
});

describe("a live number field", () => {
  it("commits each typed text that is a number and skips the ones that are not", () => {
    const { commits, draft } = play(typed("", "-", "-1", "-12"), true);
    assert.deepEqual(commits, [-1, -12]);
    assert.equal(draft, "-12");
  });

  it("does not commit again when settled", () => {
    assert.deepEqual(play([...typed("12"), { type: "settle" }], true), { commits: [12], draft: null });
  });
});
