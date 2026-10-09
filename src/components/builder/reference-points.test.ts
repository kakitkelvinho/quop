import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Beam,
  type BuilderComponent,
  type ComponentType,
  type Vec3,
  beamLengthMm,
  beamPoints,
  SCENE_VERSION,
  settleAngles,
} from "./types.ts";

// #125: a beam meets each part at its reference point. A detector's is its
// entrance and an objective's its threaded plate; everything else's is its
// optical centre. Path length and the drawn beam both use it.

const part = (id: string, type: ComponentType, [x, z]: [number, number], rotation = 0): BuilderComponent => ({
  id,
  type,
  position: [x, 100, z],
  rotation,
});

const beam = (path: string[]): Beam => ({ id: "b", path, color: "#7c3aed" });

/** The scene as the builder keeps it: every detector turned to the light that ends at it. */
function settled(components: BuilderComponent[], path: string[]) {
  const scene = settleAngles({ version: SCENE_VERSION, components, beams: [beam(path)], connections: [] });
  return { components: scene.components, beam: scene.beams[0] };
}

const rounded = (points: Vec3[]) => points.map((point) => point.map((value) => Math.round(value * 1000) / 1000));

describe("a beam that ends at a detector stops at its entrance", () => {
  const cases: [ComponentType, number][] = [
    ["photodiode", 496],
    ["camera", 477],
    ["spectrometer", 438],
    ["single-photon-detector", 469.5],
  ];

  for (const [type, length] of cases) {
    it(`${type}: 500 mm between centres, ${length} mm to its entrance`, () => {
      const { components, beam: ending } = settled(
        [part("m", "mirror-mount", [0, 0]), part("d", type, [300, 400])],
        ["m", "d"],
      );
      assert.equal(Math.round(beamLengthMm(components, ending) * 1000) / 1000, length);
    });
  }

  it("turns with the part: a photodiode straight down +z from the mirror stops 4 mm short of its centre", () => {
    const { components, beam: ending } = settled(
      [part("m", "mirror-mount", [0, 0]), part("d", "photodiode", [0, 300])],
      ["m", "d"],
    );
    assert.deepEqual(rounded(beamPoints(components, ending.path)), [
      [0, 100, 0],
      [0, 100, 296],
    ]);
  });
});

describe("a beam through an objective turns at its threaded plate", () => {
  it("from the plate's side: 300 mm in and 400 mm out, 700 mm", () => {
    const components = [
      part("in", "mirror-mount", [-326, 0]),
      part("obj", "objective", [0, 0]),
      part("out", "mirror-mount", [-26, 400]),
    ];
    assert.deepEqual(rounded(beamPoints(components, ["in", "obj", "out"]))[1], [-26, 100, 0]);
    assert.equal(Math.round(beamLengthMm(components, beam(["in", "obj", "out"])) * 1000) / 1000, 700);
  });

  it("from the tip's side, the objective turned 180°: still the plate, 700 mm", () => {
    const components = [
      part("in", "mirror-mount", [326, 0]),
      part("obj", "objective", [0, 0], 180),
      part("out", "mirror-mount", [26, 400]),
    ];
    assert.deepEqual(rounded(beamPoints(components, ["in", "obj", "out"]))[1], [26, 100, 0]);
    assert.equal(Math.round(beamLengthMm(components, beam(["in", "obj", "out"])) * 1000) / 1000, 700);
  });
});

describe("every other part meets the beam at its optical centre", () => {
  it("mirror to lens to mirror: 300 + 400 = 700 mm between centres", () => {
    const components = [
      part("a", "mirror-mount", [0, 0]),
      part("lens", "lens", [300, 0], 37),
      part("b", "mirror-mount", [300, 400]),
    ];
    assert.equal(beamLengthMm(components, beam(["a", "lens", "b"])), 700);
  });
});
