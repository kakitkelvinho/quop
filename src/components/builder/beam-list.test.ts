import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Beam,
  type BeamListEdit,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  moveBeam,
  parseScene,
  SCENE_VERSION,
  serializeScene,
  settleAngles,
} from "./types.ts";

// #96: the beam list is ordered, saved in that order, and reordered one step
// at a time from the beams box.

const beam = (id: string, path: string[] = ["L", "M"]): Beam => ({ id, path, color: "#e33" });

const ids = (beams: Beam[]) => beams.map((entry) => entry.id);

function moved(edit: BeamListEdit): string[] {
  assert.equal(edit.ok, true, "the move should be allowed");
  return edit.ok ? ids(edit.beams) : [];
}

function reason(edit: BeamListEdit): string {
  assert.equal(edit.ok, false, "the move should be refused");
  return edit.ok ? "" : edit.reason;
}

describe("moving a beam in the list", () => {
  const beams = [beam("a"), beam("b"), beam("c")];

  it("moves a beam up past its neighbour", () => {
    assert.deepEqual(moved(moveBeam(beams, "c", -1)), ["a", "c", "b"]);
  });

  it("moves a beam down past its neighbour", () => {
    assert.deepEqual(moved(moveBeam(beams, "a", 1)), ["b", "a", "c"]);
  });

  it("undoes itself when moved back the other way", () => {
    const up = moveBeam(beams, "b", -1);
    assert.ok(up.ok);
    assert.deepEqual(moved(moveBeam(up.beams, "b", 1)), ["a", "b", "c"]);
  });

  it("leaves the list it was given as it was", () => {
    moveBeam(beams, "b", -1);
    assert.deepEqual(ids(beams), ["a", "b", "c"]);
  });

  it("keeps each beam's own path, colour and label", () => {
    const edit = moveBeam([{ ...beam("a", ["L", "M", "L"]), label: "Pump" }, beam("b")], "a", 1);
    assert.ok(edit.ok);
    assert.deepEqual(edit.beams[1], { id: "a", path: ["L", "M", "L"], color: "#e33", label: "Pump" });
  });

  it("refuses to move the first beam up or the last beam down, and says why", () => {
    assert.match(reason(moveBeam(beams, "a", -1)), /already first/);
    assert.match(reason(moveBeam(beams, "c", 1)), /already last/);
  });

  it("refuses a beam that isn't in the list", () => {
    assert.match(reason(moveBeam(beams, "nope", 1)), /isn't in the list/);
  });

  it("refuses to move the only beam either way", () => {
    assert.match(reason(moveBeam([beam("only")], "only", -1)), /already first/);
    assert.match(reason(moveBeam([beam("only")], "only", 1)), /already last/);
  });
});

const part = (id: string, type: ComponentType, x: number, z: number): BuilderComponent => ({
  id,
  type,
  position: [x, 100, z],
  rotation: 0,
});

const bench = (beams: Beam[]): BuilderSceneData => ({
  version: SCENE_VERSION,
  components: [
    part("L", "laser-source", -200, 0),
    part("M", "mirror-mount", 0, 0),
    part("north", "beam-block", 0, -200),
    part("south", "beam-block", 0, 200),
  ],
  beams,
  connections: [],
});

describe("the beam list in a setup", () => {
  const through = (id: string, end: string) => beam(id, ["L", "M", end]);

  it("opens in the order it was saved, after a beam is moved", () => {
    const edit = moveBeam([beam("a"), beam("b"), beam("c")], "c", -1);
    assert.ok(edit.ok);
    const saved = serializeScene(bench(edit.beams));
    assert.deepEqual(ids(parseScene(JSON.parse(saved))?.beams ?? []), ["a", "c", "b"]);
  });

  it("hands a shared mirror to the beam that is first in the list", () => {
    const mirrorYaw = (scene: BuilderSceneData) =>
      settleAngles(scene).components.find(({ id }) => id === "M")?.rotation;

    const northFirst = [through("to-north", "north"), through("to-south", "south")];
    assert.equal(mirrorYaw(bench(northFirst)), 135);

    const edit = moveBeam(northFirst, "to-south", -1);
    assert.ok(edit.ok);
    assert.equal(mirrorYaw(bench(edit.beams)), 225);
  });
});
