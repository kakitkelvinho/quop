import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { describe, it } from "node:test";

import { setupBrief } from "./setup-brief.ts";
import { parseScene, serializeScene } from "./types.ts";

// A safety net for refactors that must change nothing a person sees: each
// fixture, opened and saved again, and the setup brief, compared with the
// copy checked into setup-snapshots/. setup-files.test.ts guards ADR 0001
// (what must survive); this guards everything else (that nothing moved).
// After a change that is meant to alter the output, regenerate with
// `UPDATE_SNAPSHOTS=1 npm test` and review the diff.

const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";

function matchesSnapshot(name: string, actual: string) {
  const url = new URL(`./setup-snapshots/${name}`, import.meta.url);
  if (UPDATE) {
    writeFileSync(url, actual);
    return;
  }
  assert.equal(actual, readFileSync(url, "utf8"), `${name} changed; see setup-snapshots.test.ts`);
}

const FIXTURES = readdirSync(new URL("./setup-fixtures/", import.meta.url))
  .filter((name) => name.endsWith(".json"))
  .sort();

describe("setup snapshots", () => {
  for (const name of FIXTURES) {
    it(`${name} opens and saves exactly as before`, () => {
      const saved = JSON.parse(readFileSync(new URL(`./setup-fixtures/${name}`, import.meta.url), "utf8"));
      const setup = parseScene(saved);
      assert.ok(setup, `${name} should open`);
      matchesSnapshot(name, `${serializeScene(setup)}\n`);
    });
  }

  it("writes the same setup brief as before", () => {
    matchesSnapshot("setup-brief.md", setupBrief());
  });
});
