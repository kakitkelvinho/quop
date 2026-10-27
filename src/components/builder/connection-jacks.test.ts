import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FIBER_STUBS, connectionJack, leavesFromStub } from "./connection-jacks.ts";
import { COMPONENT_SPECS, type BuilderComponent, type ComponentType, type Vec3, delayRailMm } from "./types.ts";

// #315: where a fibre or cable plugs into each part, as plain numbers in the
// part's frame. The expected numbers are the ones the connections were drawn
// with before the measurements moved out of component-models.tsx.

const H = 100;
const part = (type: ComponentType, extra: Partial<BuilderComponent> = {}): BuilderComponent => ({
  id: type,
  type,
  position: [0, H, 0],
  rotation: 0,
  ...extra,
});

const BACK: Vec3 = [-1, 0, 0];
const FRONT: Vec3 = [1, 0, 0];
const UP: Vec3 = [0, 1, 0];

describe("connectionJack", () => {
  it("puts a fibre into a laser's front, a spectrometer's port and a counter's FC receptacle", () => {
    assert.deepEqual(connectionJack(part("laser-source"), "fiber", 0), { at: [70, H, 0], out: FRONT });
    assert.deepEqual(connectionJack(part("spectrometer"), "fiber", 0), { at: [-60, H, 0], out: BACK });
    assert.deepEqual(connectionJack(part("single-photon-detector"), "fiber", 0), { at: [-29.5, H, 0], out: BACK });
  });

  it("puts a cable into each instrument's connector", () => {
    assert.deepEqual(connectionJack(part("camera"), "cable", 0), { at: [16, H, 0], out: FRONT });
    assert.deepEqual(connectionJack(part("spectrometer"), "cable", 0), { at: [55, H, 0], out: FRONT });
    assert.deepEqual(connectionJack(part("laser-source"), "cable", 0), { at: [-48, H, 0], out: BACK });
    assert.deepEqual(connectionJack(part("aom"), "cable", 0), { at: [0, H + 15.5, 0], out: UP });
    assert.deepEqual(connectionJack(part("eom"), "cable", 0), { at: [0, H + 15, 0], out: UP });
    assert.deepEqual(connectionJack(part("time-tagger", { position: [0, 27, 0] }), "cable", 0), {
      at: [-83, 27, -5],
      out: BACK,
    });
  });

  it("puts either kind into a delay line's drive, at the far end of its rail", () => {
    const delay = part("delay-line", { delayMinPathMm: 100, delayStageMm: 40 });
    const expected = { at: [-delayRailMm(delay) / 2 - 12, H - 26, 0], out: BACK };
    assert.deepEqual(connectionJack(delay, "cable", 0), expected);
    assert.deepEqual(connectionJack(delay, "fiber", 0), expected);
  });

  it("gives nothing for a part with no connector of that kind", () => {
    for (const type of ["mirror-mount", "lens", "block", "photodiode", "fiber-collimator"] as const) {
      assert.equal(connectionJack(part(type), "fiber", 0), undefined, type);
      assert.equal(connectionJack(part(type), "cable", 0), undefined, type);
    }
    for (const type of ["camera", "aom", "eom", "time-tagger"] as const) {
      assert.equal(connectionJack(part(type), "fiber", 0), undefined, type);
    }
  });

  it("plugs into the time tagger's input nearest the other end", () => {
    const tagger = part("time-tagger");
    const inputZ = (towardZ: number) => connectionJack(tagger, "cable", towardZ)?.at[2];
    // the eight inputs sit at z = -41, -23, -5, 13, 31, 49, 67, 85
    assert.equal(inputZ(30), 31);
    assert.equal(inputZ(-20), -23);
    assert.equal(inputZ(60), 67);
    // past either end of the row, the end input
    assert.equal(inputZ(-1000), -41);
    assert.equal(inputZ(1000), 85);
  });

  it("takes a single-photon counter's cable from the SMA output on the other end's side", () => {
    const spcm = part("single-photon-detector");
    assert.deepEqual(connectionJack(spcm, "cable", -50), { at: [33, H - 6, -7], out: FRONT });
    assert.deepEqual(connectionJack(spcm, "cable", 50), { at: [33, H - 6, 7], out: FRONT });
    assert.equal(connectionJack(spcm, "cable", 0)?.at[2], 7);
  });
});

describe("fibre stubs", () => {
  it("leaves a collimator's fibre, and either kind at a photodiode, from the stub", () => {
    assert.equal(leavesFromStub("fiber-collimator", "fiber"), true);
    assert.equal(leavesFromStub("fiber-collimator", "cable"), false);
    assert.equal(leavesFromStub("photodiode", "fiber"), true);
    assert.equal(leavesFromStub("photodiode", "cable"), true);
    assert.equal(leavesFromStub("camera", "cable"), false);
  });

  it("starts each stub at its connector, at the part's height, and ends it on the table", () => {
    const collimator = FIBER_STUBS["fiber-collimator"]!(H);
    assert.deepEqual(collimator[0], [-44, H, 0]);
    assert.deepEqual(collimator.at(-1), [-104, 1.8, 40]);
    const photodiode = FIBER_STUBS.photodiode!(H);
    assert.deepEqual(photodiode[0], [17, H, 0]);
    assert.deepEqual(photodiode.at(-1), [75, 1.8, 40]);
  });
});

describe("port offsets worked out from the models' measurements", () => {
  it("keeps every referenceX it had", () => {
    assert.equal(COMPONENT_SPECS["laser-source"].referenceX, 56);
    assert.equal(COMPONENT_SPECS.camera.referenceX, -23);
    assert.equal(COMPONENT_SPECS.spectrometer.referenceX, -62);
    assert.equal(COMPONENT_SPECS["single-photon-detector"].referenceX, -30.5);
  });
});
