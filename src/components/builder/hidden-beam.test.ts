import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  beamLengthMm,
  parseScene,
  SCENE_VERSION,
  serializeScene,
  setBeamHidden,
  settleAngles,
} from "./types.ts";

// #119: a beam can be hidden from the drawing. Hiding changes nothing else:
// the beam still angles the mirrors and detectors it passes and still has its
// path length.

const part = (id: string, type: ComponentType, x: number, z: number): BuilderComponent => ({
  id,
  type,
  position: [x, 100, z],
  rotation: 0,
});

const bench = (beams: Beam[]): BuilderSceneData => ({
  version: SCENE_VERSION,
  frames: [],
  components: [
    part("L", "laser-source", -200, 0),
    part("M", "mirror-mount", 0, 0),
    part("north", "beam-block", 0, -200),
    part("pd", "photodiode", 0, 200),
  ],
  beams,
  connections: [],
});

const probe: Beam = { id: "probe", path: ["L", "M", "north"], color: "#e33" };

describe("hiding and showing a beam", () => {
  const beams: Beam[] = [probe, { id: "other", path: ["L", "M"], color: "#38f", arrows: false }];

  it("stores hidden: true on that beam only", () => {
    assert.deepEqual(setBeamHidden(beams, "probe", true), [{ ...probe, hidden: true }, beams[1]]);
  });

  it("takes the key away when the beam is shown again, rather than storing false", () => {
    const shown = setBeamHidden(setBeamHidden(beams, "probe", true), "probe", false);
    assert.deepEqual(shown, beams);
    assert.equal("hidden" in shown[0], false);
  });

  it("leaves the list it was given as it was", () => {
    setBeamHidden(beams, "probe", true);
    assert.equal("hidden" in beams[0], false);
  });

  it("keeps the beam's own width, opacity, arrows and place in the list", () => {
    const styled: Beam = { id: "s", path: ["L", "M"], color: "#38f", width: 4, opacity: 0.4, arrows: false, label: "Pump" };
    const [first, second] = setBeamHidden([styled, probe], "s", true);
    assert.deepEqual(first, { ...styled, hidden: true });
    assert.equal(second.id, "probe");
  });
});

describe("a hidden beam in a setup", () => {
  it("still angles a mirror in the middle of it: the face bisects the legs, 135 degrees", () => {
    const hidden = bench([{ ...probe, hidden: true }]);
    assert.equal(settleAngles(hidden).components.find(({ id }) => id === "M")?.rotation, 135);
  });

  it("still angles a detector at its end", () => {
    const hidden = bench([{ id: "to-pd", path: ["M", "pd"], color: "#e33", hidden: true }]);
    const shown = bench([{ id: "to-pd", path: ["M", "pd"], color: "#e33" }]);
    const yaw = (scene: BuilderSceneData) => settleAngles(scene).components.find(({ id }) => id === "pd")?.rotation;
    assert.equal(yaw(hidden), yaw(shown));
    assert.notEqual(yaw(hidden), 0);
  });

  it("keeps its path length: 200 mm in and 200 mm out", () => {
    const hidden = bench([{ ...probe, hidden: true }]);
    assert.equal(beamLengthMm(hidden.components, hidden.beams[0]), 400);
  });

  it("is hidden still after saving and opening, and the others are not", () => {
    const saved = serializeScene(bench([probe, { id: "ref", path: ["L", "pd"], color: "#999", hidden: true }]));
    const reopened = parseScene(JSON.parse(saved));
    assert.deepEqual(
      reopened?.beams.map((beam) => [beam.id, beam.hidden]),
      [
        ["probe", undefined],
        ["ref", true],
      ],
    );
  });

  it("is not written for a shown beam", () => {
    const saved = JSON.parse(serializeScene(bench([probe])));
    assert.equal("hidden" in saved.beams[0], false);
  });

  it("reads anything but true as shown", () => {
    const reopened = parseScene({
      version: 4,
      components: bench([]).components,
      beams: [
        { ...probe, id: "false", hidden: false },
        { ...probe, id: "text", hidden: "yes" },
      ],
    });
    assert.deepEqual(reopened?.beams.map((beam) => "hidden" in beam), [false, false]);
  });
});
