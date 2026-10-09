import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendStop,
  type Beam,
  dropComponentFromBeams,
  moveStopTo,
  parseScene,
  type PathEdit,
  removeStop,
} from "./types.ts";

// #82: editing a beam's stops is predictable. Clicks append in click order;
// a refused edit says why.

/** One step toward the start (-1) or the end (1), the move the keyboard makes. */
const moveStopStep = (path: string[], index: number, direction: 1 | -1) =>
  moveStopTo(path, index, index + direction);

describe("adding stops", () => {
  it("appends each click in order", () => {
    const first = appendStop(["A", "B"], "C");
    assert.deepEqual(first, { ok: true, path: ["A", "B", "C"] });
  });

  it("appends a part already on the beam as a revisit, closing a loop", () => {
    assert.deepEqual(appendStop(["A", "B", "C"], "A"), { ok: true, path: ["A", "B", "C", "A"] });
    assert.deepEqual(appendStop(["A", "B", "C"], "B"), { ok: true, path: ["A", "B", "C", "B"] });
  });

  it("refuses the current last stop, and says why", () => {
    assert.match(reason(appendStop(["A", "B", "C"], "C")), /already the last stop/);
  });
});

function reason(edit: PathEdit): string {
  assert.equal(edit.ok, false, "the edit should be refused");
  return edit.ok ? "" : edit.reason;
}

describe("removing and moving stops", () => {
  it("removes a stop", () => {
    assert.deepEqual(removeStop(["A", "B", "C"], 1), { ok: true, path: ["A", "C"] });
  });

  it("refuses a stop that isn't there", () => {
    assert.match(reason(removeStop(["A", "B", "C"], 3)), /isn't on this beam/);
  });

  it("refuses to leave fewer than 2 stops", () => {
    assert.match(reason(removeStop(["A", "B"], 0)), /needs 2 stops/);
  });

  it("refuses a removal that puts a part twice in a row", () => {
    assert.match(reason(removeStop(["A", "B", "A", "C"], 1)), /twice in a row/);
  });

  it("swaps a stop with its neighbour", () => {
    assert.deepEqual(moveStopStep(["A", "B", "C"], 2, -1), { ok: true, path: ["A", "C", "B"] });
  });

  it("refuses to move past either end", () => {
    assert.match(reason(moveStopStep(["A", "B", "C"], 0, -1)), /already first/i);
    assert.match(reason(moveStopStep(["A", "B", "C"], 2, 1)), /already last/i);
  });

  it("refuses a move that puts a part twice in a row", () => {
    assert.match(reason(moveStopStep(["A", "B", "A", "C"], 1, 1)), /twice in a row/);
  });
});

describe("dragging a stop to a new place", () => {
  const path = ["A", "B", "C", "D"];

  it("drops a stop two places later", () => {
    assert.deepEqual(moveStopTo(path, 1, 3), { ok: true, path: ["A", "C", "D", "B"] });
  });

  it("drops a stop to the front", () => {
    assert.deepEqual(moveStopTo(path, 3, 0), { ok: true, path: ["D", "A", "B", "C"] });
  });

  it("leaves the path as it was when the stop is dropped where it stood", () => {
    assert.deepEqual(moveStopTo(path, 2, 2), { ok: true, path });
  });

  it("refuses a drop that puts a part twice in a row, with the button wording", () => {
    assert.deepEqual(moveStopTo(["A", "B", "A", "C"], 1, 3), {
      ok: false,
      reason: "it would put the same part twice in a row",
    });
    assert.match(reason(moveStopTo(["A", "B", "C", "B"], 2, 3)), /twice in a row/);
  });

  it("refuses a stop that isn't there, and a place past either end", () => {
    assert.match(reason(moveStopTo(path, 4, 0)), /isn't on this beam/);
    assert.match(reason(moveStopTo(path, 0, -1)), /already first/);
    assert.match(reason(moveStopTo(path, 0, 4)), /already last/);
  });
});

const beam = (id: string, path: string[]): Beam => ({ id, path, color: "#e33" });

describe("deleting a part on a beam", () => {
  it("closes the gap it leaves, never a part twice in a row", () => {
    const beams = dropComponentFromBeams([beam("loop", ["A", "B", "A", "C"])], "B");
    assert.deepEqual(beams.map((entry) => entry.path), [["A", "C"]]);
  });

  it("drops a beam left with one distinct stop", () => {
    const beams = dropComponentFromBeams([beam("there-and-back", ["A", "B", "A"]), beam("kept", ["A", "C"])], "B");
    assert.deepEqual(beams.map((entry) => entry.id), ["kept"]);
  });
});

describe("opening a setup whose beam names a missing part", () => {
  const part = (id: string, x: number) => ({ id, type: "lens", position: [x, 100, 0], rotation: 0 });
  const open = (path: string[]) =>
    parseScene({ version: 2, components: [part("A", 0), part("C", 200)], beams: [beam("b", path)] });

  it("closes the gap the missing part leaves", () => {
    assert.deepEqual(open(["A", "B", "A", "C"])?.beams.map((entry) => entry.path), [["A", "C"]]);
  });

  it("drops a beam left with one distinct stop, keeping every part", () => {
    const setup = open(["A", "B", "A"]);
    assert.deepEqual(setup?.beams, []);
    assert.equal(setup?.components.length, 2);
  });
});
