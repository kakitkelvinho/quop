import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Beam,
  type BuilderComponent,
  type ComponentType,
  type Vec3,
  COMPONENT_SPECS,
  beamLengthMm,
  bodyCentre,
  parseScene,
  SCENE_VERSION,
  settleAngles,
} from "./types.ts";

// #125: a beam meets each part at its reference point, the first surface a
// ruler laid along the beam touches: a laser's opening, a photodiode's chip, a
// camera's C-mount ring face, an objective's threaded plate's outer face.
// Since version 10 a part with such a port is placed, snapped and saved by it,
// and its body is drawn behind it, so the distance between two parts'
// positions is the beam between them. Everything else's is its optical centre.

const part = (id: string, type: ComponentType, [x, z]: [number, number], rotation = 0): BuilderComponent => ({
  id,
  type,
  position: [x, 100, z],
  rotation,
});

const beam = (path: string[]): Beam => ({ id: "b", path, color: "#7c3aed" });

/** The scene as the builder keeps it: every detector turned to the light that ends at it. */
function settled(components: BuilderComponent[], path: string[]) {
  const scene = settleAngles({ version: SCENE_VERSION, components, beams: [beam(path)], connections: [], frames: [], groups: [] });
  return { components: scene.components, beam: scene.beams[0] };
}

// adding 0 turns the -0 a cosine leaves into 0
const rounded = (points: Vec3[]) => points.map((point) => point.map((value) => Math.round(value * 1000) / 1000 + 0));

const PORTED: ComponentType[] = [
  "laser-source",
  "fiber-collimator",
  "photodiode",
  "camera",
  "spectrometer",
  "single-photon-detector",
  "objective",
];

describe("a part with a port is placed by it", () => {
  for (const type of PORTED) {
    it(`${type}: 500 mm between positions is 500 mm of beam`, () => {
      const { components, beam: run } = settled([part("m", "mirror-mount", [0, 0]), part("p", type, [300, 400])], ["m", "p"]);
      assert.equal(Math.round(beamLengthMm(components, run) * 1000) / 1000, 500);
    });
  }

  it("a laser's opening 300 mm from a spectrometer's port is 300 mm of beam, whatever their sizes", () => {
    const components = [part("l", "laser-source", [0, 0]), part("s", "spectrometer", [300, 0])];
    assert.equal(beamLengthMm(components, beam(["l", "s"])), 300);
  });
});

describe("its body is drawn behind its port", () => {
  for (const type of PORTED) {
    const offset = COMPONENT_SPECS[type].referenceX ?? 0;
    it(`${type}: its body's centre is ${offset} mm from its port, against its local x`, () => {
      assert.deepEqual(rounded([bodyCentre(part("p", type, [0, 0]))]), rounded([[-offset, 100, 0]]));
    });
  }

  it("turns with the part: a laser turned to fire along -z has its body at z = +56", () => {
    assert.deepEqual(rounded([bodyCentre(part("l", "laser-source", [0, 0], 90))]), [[0, 100, 56]]);
  });

  it("a part with no port is its own body's centre", () => {
    assert.deepEqual(bodyCentre(part("m", "mirror-mount", [10, 20], 45)), [10, 100, 20]);
  });

  it("a detector turned to the light keeps its port where it is and swings its body behind it", () => {
    const { components } = settled([part("m", "mirror-mount", [0, 0]), part("d", "photodiode", [0, 300])], ["m", "d"]);
    const detector = components.find(({ id }) => id === "d")!;
    assert.deepEqual(detector.position, [0, 100, 300]);
    assert.deepEqual(rounded([bodyCentre(detector)]), [[0, 100, 302.15]]);
  });
});

describe("a beam through an objective turns at its threaded plate's outer face, its position", () => {
  it("300 mm in and 400 mm out, 700 mm, from either side", () => {
    for (const rotation of [0, 180]) {
      const components = [
        part("in", "mirror-mount", [-300, 0]),
        part("obj", "objective", [0, 0], rotation),
        part("out", "mirror-mount", [0, 400]),
      ];
      assert.equal(beamLengthMm(components, beam(["in", "obj", "out"])), 700, `turned ${rotation}°`);
    }
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

describe("a setup saved by its parts' centres, before version 10", () => {
  // the default scene as version 9 saved it: the laser's centre 56 mm behind
  // its opening, the spectrometer's 62 mm behind its port
  const old = {
    version: 9,
    components: [
      { id: "l", type: "laser-source", position: [-356, 100, -150], rotation: 0 },
      { id: "m", type: "mirror-mount", position: [0, 100, -150], rotation: 0 },
      { id: "s", type: "spectrometer", position: [337, 100, -150], rotation: 0 },
      { id: "c", type: "fiber-collimator", position: [0, 100, 0], rotation: 90 },
    ],
    beams: [{ id: "b", path: ["l", "m", "s"], color: "#7c3aed" }],
  };

  it("opens with each part with a port moved to that port, and the rest where they were", () => {
    const scene = parseScene(old)!;
    const at = (id: string) => rounded([scene.components.find((part) => part.id === id)!.position])[0];
    assert.deepEqual(at("l"), [-300, 100, -150]);
    assert.deepEqual(at("m"), [0, 100, -150]);
    assert.deepEqual(at("s"), [275, 100, -150]);
    assert.deepEqual(at("c"), [0, 100, -10.5]);
  });

  it("draws every body where it was and measures every beam the same", () => {
    const scene = parseScene(old)!;
    for (const saved of old.components) {
      const opened = scene.components.find((part) => part.id === saved.id)!;
      assert.deepEqual(rounded([bodyCentre(opened)]), rounded([saved.position as Vec3]), saved.id);
    }
    assert.equal(beamLengthMm(scene.components, scene.beams[0]), 575);
  });
});
