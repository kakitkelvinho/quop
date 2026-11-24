import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { TRACE_2001 } from "./scene-theme.ts";

test("the 2001 trace colour in the scene matches the page's --look-trace, day and night", () => {
  const css = readFileSync(new URL("../../app/builder/tabletop/builder-theme-2001.css", import.meta.url), "utf8");
  const traces = [...css.matchAll(/--look-trace:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1].toLowerCase());
  assert.deepEqual(traces, [TRACE_2001.light, TRACE_2001.dark]);
});
