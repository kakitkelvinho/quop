import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AIMED_DETECTORS,
  type BuilderComponent,
  type ComponentType,
  COMPONENT_SPECS,
  HOST_TYPES,
  LIT_TYPES,
  MIRROR_LIKE,
  MOUNTED_TYPES,
  PERISCOPE_MIRRORS,
  STAGED_TYPES,
  kindsWhere,
  newComponent,
} from "./types.ts";

// COMPONENT_SPECS is the one table that says what each Component kind is. These
// pin it to what the builder did before the table grew: the kind sets as they
// were written out by hand, and the object addComponent built for a new part.

const MOUNT = "#8b1e3f";

// Written out from addComponent as it stood before newComponent: every part
// at its default height, unturned, and with no colour or label unless set.
const BUILT: Record<ComponentType, BuilderComponent> = {
  "laser-source": { id: "p", type: "laser-source", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  "fiber-collimator": { id: "p", type: "fiber-collimator", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  "mirror-mount": { id: "p", type: "mirror-mount", position: [10, 100, 20], rotation: 0, color: MOUNT, label: undefined },
  "beam-splitter": { id: "p", type: "beam-splitter", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  lens: {
    id: "p",
    type: "lens",
    position: [10, 100, 20],
    rotation: 0,
    color: undefined,
    label: undefined,
    lensShape: "plano-convex",
    focalLength: 100,
  },
  waveplate: { id: "p", type: "waveplate", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  filter: { id: "p", type: "filter", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  iris: { id: "p", type: "iris", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  sample: { id: "p", type: "sample", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  "paul-trap": { id: "p", type: "paul-trap", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  cavity: { id: "p", type: "cavity", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined, cavityLength: 50 },
  particle: { id: "p", type: "particle", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  photodiode: { id: "p", type: "photodiode", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  camera: { id: "p", type: "camera", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  spectrometer: { id: "p", type: "spectrometer", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  "single-photon-detector": {
    id: "p",
    type: "single-photon-detector",
    position: [10, 100, 20],
    rotation: 0,
    color: undefined,
    label: undefined,
  },
  "time-tagger": { id: "p", type: "time-tagger", position: [10, 27, 20], rotation: 0, color: undefined, label: undefined },
  "beam-block": { id: "p", type: "beam-block", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  objective: { id: "p", type: "objective", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  block: {
    id: "p",
    type: "block",
    position: [10, 100, 20],
    rotation: 0,
    color: "#3b4a6b",
    label: undefined,
    size: [30, 30, 30],
  },
  aom: { id: "p", type: "aom", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  eom: { id: "p", type: "eom", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  "faraday-isolator": { id: "p", type: "faraday-isolator", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  periscope: { id: "p", type: "periscope", position: [10, 100, 20], rotation: 0, color: MOUNT, label: undefined },
  "periscope-top": { id: "p", type: "periscope-top", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
  "delay-line": { id: "p", type: "delay-line", position: [10, 100, 20], rotation: 0, color: undefined, label: undefined },
};

const KINDS = Object.keys(COMPONENT_SPECS) as ComponentType[];

describe("newComponent", () => {
  for (const type of KINDS) {
    it(`builds a new ${type} as addComponent did`, () => {
      const built = newComponent(type, "p", 10, 20);
      assert.deepStrictEqual(built, BUILT[type]);
      // the same keys in the same order, so a saved setup lists them as before
      assert.deepStrictEqual(Object.keys(built), Object.keys(BUILT[type]));
    });
  }

  it("takes a label and a host, after the kind's own values", () => {
    const built = newComponent("particle", "p", 0, 0, { label: "Ion", host: "trap" });
    assert.deepStrictEqual(built, {
      id: "p",
      type: "particle",
      position: [0, 100, 0],
      rotation: 0,
      color: undefined,
      label: "Ion",
      host: "trap",
    });
    assert.deepStrictEqual(Object.keys(built), ["id", "type", "position", "rotation", "color", "label", "host"]);
  });

  it("leaves an empty host out, as addComponent did", () => {
    assert.equal("host" in newComponent("particle", "p", 0, 0, { host: "" }), false);
  });

  it("gives every block its own size", () => {
    const one = newComponent("block", "a", 0, 0);
    const two = newComponent("block", "b", 0, 0);
    assert.notEqual(one.size, two.size);
    one.size![0] = 99;
    assert.deepStrictEqual(newComponent("block", "c", 0, 0).size, [30, 30, 30]);
  });
});

describe("the kind table", () => {
  // in the same order too: the setup brief names the kinds in a set in its order
  const sameSet = (actual: ReadonlySet<ComponentType>, expected: ComponentType[]) =>
    assert.deepStrictEqual([...actual], expected);

  it("derives each kind set as it was written out by hand", () => {
    sameSet(LIT_TYPES, ["cavity", "delay-line"]);
    sameSet(HOST_TYPES, ["paul-trap", "cavity"]);
    sameSet(MOUNTED_TYPES, [
      "mirror-mount",
      "beam-splitter",
      "waveplate",
      "filter",
      "iris",
      "fiber-collimator",
      "periscope",
      "periscope-top",
    ]);
    sameSet(STAGED_TYPES, ["objective", "sample"]);
    sameSet(MIRROR_LIKE, ["mirror-mount", "delay-line"]);
    sameSet(PERISCOPE_MIRRORS, ["periscope", "periscope-top"]);
    sameSet(AIMED_DETECTORS, ["photodiode", "camera", "spectrometer", "single-photon-detector"]);
    // component-models.tsx's stubs that take a cable as well as a fibre
    sameSet(kindsWhere((spec) => spec.stubTakesCable === true), ["photodiode"]);
  });

  it("lists each kind's own fields", () => {
    const fields = Object.fromEntries(
      KINDS.filter((type) => COMPONENT_SPECS[type].fields.length > 0).map((type) => [
        type,
        [...COMPONENT_SPECS[type].fields].sort(),
      ]),
    );
    assert.deepStrictEqual(fields, {
      "laser-source": ["internalPathMm"],
      lens: ["focalLength", "lensShape"],
      sample: ["opacity", "sampleStage", "sampleStageLeft", "stageColor"],
      cavity: ["cavityLength", "lightColor", "lightHidden"],
      particle: ["host", "particleRadius"],
      objective: ["objectiveLength", "stageColor"],
      block: ["size"],
      "periscope-top": ["periscope"],
      "delay-line": ["delayMinPathMm", "delayStageMm", "delayTravelMm", "lightColor", "lightHidden"],
    });
  });

  it("starts a new part only with fields its kind has, or a colour", () => {
    for (const type of KINDS) {
      const { created = {}, fields } = COMPONENT_SPECS[type];
      for (const key of Object.keys(created)) {
        assert.ok(key === "color" || (fields as readonly string[]).includes(key), `${type} starts with ${key}`);
      }
    }
  });
});
