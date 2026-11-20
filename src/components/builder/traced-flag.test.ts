import assert from "node:assert/strict";
import { it } from "node:test";

import { resolveTracedFlag, tracedViewHref } from "./traced-flag.ts";

it("traces by default and allows a per-visit fallback", () => {
  assert.equal(resolveTracedFlag(""), true);
  assert.equal(resolveTracedFlag("?traced=1"), true);
  assert.equal(resolveTracedFlag("?traced=0"), false);
  assert.equal(resolveTracedFlag("?traced=other"), true);
});

it("switches view and keeps the page's other settings", () => {
  const legacy = tracedViewHref("https://lab.example/builder/tabletop/?graphics=light", false);
  assert.equal(legacy, "https://lab.example/builder/tabletop/?graphics=light&traced=0");
  assert.equal(resolveTracedFlag(new URL(legacy).search), false);
  assert.equal(tracedViewHref(legacy, true), "https://lab.example/builder/tabletop/?graphics=light");
});

it("drops a share link's hash, which would reopen the shared setup over the table", () => {
  assert.equal(tracedViewHref("https://lab.example/t/?a=1#s=abc", false), "https://lab.example/t/?a=1&traced=0");
});
