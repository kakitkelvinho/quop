import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { BLUEPRINT_NEON, TRACE_SPACE } from "./scene-theme.ts";

test("the Space trace colour in the scene matches the page's --look-trace, day and night", () => {
  const css = readFileSync(new URL("../../app/builder/tabletop/builder-theme-space.css", import.meta.url), "utf8");
  const traces = [...css.matchAll(/--look-trace:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1].toLowerCase());
  assert.deepEqual(traces, [TRACE_SPACE.light, TRACE_SPACE.dark]);
});

test("Blueprint's night ink in the scene matches the page's --bp-ink", () => {
  const css = readFileSync(new URL("../../app/builder/tabletop/builder-theme-blueprint.css", import.meta.url), "utf8");
  const night = css.slice(css.indexOf('[data-mode="dark"]'));
  assert.equal(/--bp-ink:\s*(#[0-9a-f]{6})/i.exec(night)?.[1].toLowerCase(), BLUEPRINT_NEON);
});
