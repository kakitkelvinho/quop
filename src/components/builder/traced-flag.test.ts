import assert from "node:assert/strict";
import { it } from "node:test";

import { resolveTracedFlag } from "./traced-flag.ts";

it("lets the traced query flag override a remembered choice", () => {
  assert.equal(resolveTracedFlag("?traced=1", "0"), true);
  assert.equal(resolveTracedFlag("?traced=0", "1"), false);
  assert.equal(resolveTracedFlag("", "1"), true);
  assert.equal(resolveTracedFlag("", "0"), false);
  assert.equal(resolveTracedFlag("?traced=other", null), false);
});
