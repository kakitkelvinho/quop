import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  derivedAngleBeam,
  SCENE_VERSION,
  settleAngles,
} from "./types.ts";

// #81: a detector that ends a beam faces the light arriving at it, the stop
// before it on that beam. Yaw 0 points a detector's face west (−x).

const part = (id: string, type: ComponentType, x: number, z: number, rotation = 0): BuilderComponent => ({
  id,
  type,
  position: [x, 60, z],
  rotation,
});

function scene(components: BuilderComponent[], paths: string[][]): BuilderSceneData {
  return {
    version: SCENE_VERSION,
    components,
    beams: paths.map((path, index) => ({ id: `beam-${index}`, path, color: "#e33" })),
  };
}

const yawOf = (data: BuilderSceneData, id: string) =>
  data.components.find((component) => component.id === id)?.rotation;

describe("a photodiode that ends a beam", () => {
  it("faces a laser due west of it", () => {
    const settled = settleAngles(scene([part("laser", "laser-source", -200, 0), part("pd", "photodiode", 0, 0, 180)], [["laser", "pd"]]));
    assert.equal(yawOf(settled, "pd"), 0);
  });

  it("faces a stop due south (+z) of it", () => {
    const settled = settleAngles(scene([part("laser", "laser-source", 0, 200), part("pd", "photodiode", 0, 0)], [["laser", "pd"]]));
    assert.equal(yawOf(settled, "pd"), 90);
  });

  it("faces the stop before it, not the laser, on a folded path", () => {
    const settled = settleAngles(
      scene(
        [part("laser", "laser-source", -200, -200), part("m", "mirror-mount", 0, -200), part("pd", "photodiode", 0, 0)],
        [["laser", "m", "pd"]],
      ),
    );
    // the mirror sits at −z of the photodiode: yaw 270 turns the face to −z
    assert.equal(yawOf(settled, "pd"), 270);
  });

  it("re-aims when the stop before it moves", () => {
    const first = settleAngles(scene([part("laser", "laser-source", -200, 0), part("pd", "photodiode", 0, 0)], [["laser", "pd"]]));
    const moved = settleAngles({
      ...first,
      components: first.components.map((component) =>
        component.id === "laser" ? { ...component, position: [0, 60, 200] } : component,
      ),
    });
    assert.equal(yawOf(moved, "pd"), 90);
  });

  it("is locked to that beam", () => {
    const data = scene([part("laser", "laser-source", -200, 0), part("pd", "photodiode", 0, 0)], [["laser", "pd"]]);
    assert.equal(derivedAngleBeam(data.beams, data.components[1])?.id, "beam-0");
  });
});

describe("a detector turned by hand", () => {
  it("keeps its rotation on no beam", () => {
    const data = scene([part("pd", "photodiode", 0, 0, 135)], []);
    assert.equal(yawOf(settleAngles(data), "pd"), 135);
    assert.equal(derivedAngleBeam(data.beams, data.components[0]), undefined);
  });

  it("keeps its rotation at a beam's start", () => {
    const data = scene([part("pd", "photodiode", 0, 0, 135), part("block", "beam-block", 200, 0)], [["pd", "block"]]);
    assert.equal(yawOf(settleAngles(data), "pd"), 135);
  });
});

describe("cameras and spectrometers", () => {
  it("face the stop before them too", () => {
    const settled = settleAngles(
      scene(
        [part("laser", "laser-source", -200, 0), part("cam", "camera", 0, 0, 45), part("spec", "spectrometer", 0, 300, 45)],
        [["laser", "cam"], ["laser", "spec"]],
      ),
    );
    assert.equal(yawOf(settled, "cam"), 0);
    // the laser is at (−200, 0) from (0, 300): face points west-north-west
    assert.equal(yawOf(settled, "spec"), 303.69);
  });
});

describe("single-photon detectors", () => {
  it("face a laser due south (+z) of them", () => {
    const settled = settleAngles(scene([part("laser", "laser-source", 0, 200), part("spcm", "single-photon-detector", 0, 0, 45)], [["laser", "spcm"]]));
    assert.equal(yawOf(settled, "spcm"), 90);
  });

  it("face a laser due west of them", () => {
    const settled = settleAngles(scene([part("laser", "laser-source", -200, 0), part("spcm", "single-photon-detector", 0, 0, 45)], [["laser", "spcm"]]));
    assert.equal(yawOf(settled, "spcm"), 0);
  });

  it("are locked to the beam that ends at them", () => {
    const data = scene([part("laser", "laser-source", -200, 0), part("spcm", "single-photon-detector", 0, 0)], [["laser", "spcm"]]);
    assert.equal(derivedAngleBeam(data.beams, data.components[1])?.id, "beam-0");
  });

  it("keep their rotation at a beam's start", () => {
    const data = scene([part("spcm", "single-photon-detector", 0, 0, 135), part("block", "beam-block", 200, 0)], [["spcm", "block"]]);
    assert.equal(yawOf(settleAngles(data), "spcm"), 135);
    assert.equal(derivedAngleBeam(data.beams, data.components[0]), undefined);
  });
});

describe("a time tagger", () => {
  it("keeps its hand-set rotation at a beam's end: it is not aimed", () => {
    const data = scene([part("laser", "laser-source", -200, 0), part("tagger", "time-tagger", 0, 0, 135)], [["laser", "tagger"]]);
    assert.equal(yawOf(settleAngles(data), "tagger"), 135);
    assert.equal(derivedAngleBeam(data.beams, data.components[1]), undefined);
  });
});
