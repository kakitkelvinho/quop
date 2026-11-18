import assert from "node:assert/strict";
import { it } from "node:test";

import { settleAims } from "./aim-settling.ts";
import { upgradeNotice } from "./setup-upgrade.ts";
import { traceScene } from "./trace-scene.ts";
import { newComponent, parseScene } from "./types.ts";

it("keeps a drawn Beam when the trace misses an aperture and is blocked", () => {
  const raw = {
    version: 17,
    components: [
      newComponent("laser-source", "laser", 0, 0),
      newComponent("mirror-mount", "mirror", 100, 0),
      { ...newComponent("iris", "iris", 107, 25), orientation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] },
      { ...newComponent("beam-block", "block", 100, 50), orientation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] },
      newComponent("photodiode", "detector", 100, 100),
    ],
    beams: [{ id: "drawn", path: ["laser", "mirror", "detector"], color: "#ffffff" }],
    connections: [], frames: [], groups: [],
  };
  const parsed = parseScene(raw);
  assert.ok(parsed);
  assert.equal(parsed.components.find((part) => part.id === "mirror")?.aim, "detector");
  assert.deepEqual(parsed.beams.map((beam) => beam.path), [raw.beams[0].path]);
  const traced = traceScene(settleAims(parsed).scene);
  assert.deepEqual(traced.matchedDrawnBeamIds, []);
  assert.ok(traced.checks.some((check) => check.kind === "missed-aperture" && check.componentId === "iris"));
  assert.match(upgradeNotice(parsed) ?? "", /This file was upgraded/);
  const again = parseScene({ ...raw, version: 18 });
  assert.ok(again);
  assert.equal(upgradeNotice(again), null);
});
