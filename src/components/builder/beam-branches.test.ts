import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { beamForTracePath, effectiveBeams, migrateBeamBranches, removeBeamBranch, validBeamParents } from "./beam-branches.ts";
import { measureBeam } from "./beam-measurement.ts";
import { fromYawDeg } from "./quaternion.ts";
import { parseScene, SCENE_VERSION, setBeamHidden, type Beam, type BuilderComponent } from "./types.ts";

const beams: Beam[] = [
  { id: "trunk", path: ["laser", "cube", "a"], color: "#f00", label: "Probe" },
  { id: "branch", parentId: "trunk", path: ["laser", "cube", "b"], color: "#000", inheritColor: true, inheritLabel: true, inheritHidden: true },
  { id: "tip", parentId: "branch", path: ["laser", "cube", "b", "c"], color: "#0f0", inheritHidden: true },
];

describe("Beam branches", () => {
  it("passes trunk colour and label through descendants until a branch overrides them", () => {
    const changed = [{ ...beams[0], color: "#00f", label: "Reference" }, ...beams.slice(1)];
    const resolved = effectiveBeams(changed);
    assert.deepEqual(resolved.map((beam) => beam.color), ["#00f", "#00f", "#0f0"]);
    assert.deepEqual(resolved.map((beam) => beam.label), ["Reference", "Reference", undefined]);
  });

  it("hides descendants while their path lengths still count", () => {
    const hidden = effectiveBeams(setBeamHidden(beams, "trunk", true));
    assert.deepEqual(hidden.map((beam) => beam.hidden), [true, true, true]);
    const components: BuilderComponent[] = ["laser", "cube", "b", "c"].map((id, index) => ({
      id, type: id === "laser" ? "laser-source" : "mirror-mount",
      position: [index * 100, 100, 0], orientation: fromYawDeg(0),
    }));
    assert.equal(measureBeam(components, hidden[2]).lengthMm, 300);
    assert.equal(effectiveBeams(setBeamHidden(setBeamHidden(beams, "trunk", true), "branch", false))[1].hidden, false);
  });

  it("keeps inherited appearance when its parent is deleted", () => {
    const before = effectiveBeams(beams)[1];
    const after = effectiveBeams(removeBeamBranch(beams, "trunk"))[0];
    assert.equal(after.color, before.color);
    assert.equal(after.label, before.label);
  });

  it("uses the branch reached by each traced segment", () => {
    assert.equal(beamForTracePath(beams, ["laser", "cube"])?.id, "trunk");
    assert.equal(beamForTracePath(beams, ["laser", "cube", "b"])?.id, "branch");
    assert.equal(beamForTracePath(beams, ["laser", "cube", "b", "c"])?.id, "tip");
  });

  it("matches a traced path only to a Beam whose route it lies on", () => {
    const [trunk] = beams;
    assert.equal(beamForTracePath([trunk], ["laser", "cube", "r"]), undefined);
    assert.equal(beamForTracePath([trunk], ["laser", "cube"])?.id, "trunk");
    assert.equal(beamForTracePath([trunk], ["laser", "cube"], true), undefined);
    assert.equal(beamForTracePath([trunk], ["laser", "cube", "a", "x"])?.id, "trunk");
    assert.equal(beamForTracePath([trunk], ["laser", "cube", "a"], true)?.id, "trunk");
  });

  it("merges old beams with the same source into one tree with their own colours", () => {
    const old: Beam[] = [
      { id: "red", path: ["laser", "cube", "a"], color: "#f00" },
      { id: "blue", path: ["laser", "cube", "b"], color: "#00f" },
    ];
    const migrated = migrateBeamBranches(old);
    assert.equal(migrated[1].parentId, "red");
    assert.deepEqual(effectiveBeams(migrated).map((beam) => beam.color), ["#f00", "#00f"]);
    const opened = parseScene({ version: 19, components: ["laser", "cube", "a", "b"].map((id) => ({ id, type: "beam-block", position: [0, 100, 0] })), beams: old });
    assert.equal(opened?.version, SCENE_VERSION);
    assert.equal(opened?.beams[1].parentId, "red");
  });

  it("rejects dangling, cross-source and circular parent links in setup data", () => {
    const invalid = validBeamParents([
      { ...beams[0], parentId: "branch" },
      beams[1],
      { ...beams[2], parentId: "missing" },
      { id: "elsewhere", path: ["other", "b"], color: "#fff", parentId: "trunk" },
    ]);
    assert.ok(invalid.every((beam) => !beam.parentId || beam.id === "branch"));
    assert.equal(invalid[0].parentId, undefined);
    assert.equal(invalid[2].parentId, undefined);
    assert.equal(invalid[3].parentId, undefined);
  });
});
