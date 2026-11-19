import assert from "node:assert/strict";
import { it } from "node:test";

import { resolveTracedFlag } from "./traced-flag.ts";

it("traces by default and allows a per-visit fallback", () => {
  assert.equal(resolveTracedFlag(""), true);
  assert.equal(resolveTracedFlag("?traced=1"), true);
  assert.equal(resolveTracedFlag("?traced=0"), false);
  assert.equal(resolveTracedFlag("?traced=other"), true);
});
