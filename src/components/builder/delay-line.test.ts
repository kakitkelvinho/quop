import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Beam,
  type BuilderComponent,
  DELAY_ARM_BASE_MM,
  DELAY_MIN_PATH_MM,
  DELAY_TRAVEL_MM,
  SCENE_VERSION,
  beamDelayMm,
  beamLengthMm,
  bodyCentre,
  delayArmMm,
  delayLineYaw,
  delayRailMm,
  delayRailOffset,
  delaySetting,
  parseScene,
  serializeScene,
  settleAngles,
} from "./types.ts";

// A delay line stands across a beam line: fold mirrors at its port send the
// light down its rail to a V of mirrors on its carriage and back, and it
// leaves along the line it came in on. It adds its minimum delay and twice
// how far its stage has travelled.

const m1: BuilderComponent = { id: "m1", type: "mirror-mount", position: [0, 100, 100], rotation: 0 };
const delay: BuilderComponent = { id: "delay", type: "delay-line", position: [200, 100, 50], rotation: 0, delayMinPathMm: 100, delayStageMm: 40 };
const m2: BuilderComponent = { id: "m2", type: "mirror-mount", position: [0, 100, 0], rotation: 0 };
const beam: Beam = { id: "b", path: ["m1", "delay", "m2"], color: "#e33" };
const components = [m1, delay, m2];

describe("a delay line", () => {
  it("adds its minimum delay and twice its stage's travel to a beam through it", () => {
    assert.equal(beamDelayMm(components, beam), 100 + 2 * 40);
    const toPort = Math.hypot(200, 50);
    assert.ok(Math.abs(beamLengthMm(components, beam) - (2 * toPort + 180)) < 1e-9);
  });

  it("adds nothing to a beam that only starts or ends at it", () => {
    assert.equal(beamDelayMm(components, { ...beam, path: ["m1", "delay"] }), 0);
  });

  it("counts each pass through it", () => {
    assert.equal(beamDelayMm(components, { ...beam, path: ["m1", "delay", "m2", "delay", "m1"] }), 360);
  });

  it("starts with its stage at the start of its travel, and holds the stage within it", () => {
    const fresh: BuilderComponent = { id: "d", type: "delay-line", position: [0, 100, 0], rotation: 0 };
    assert.deepEqual(delaySetting(fresh), { minPath: DELAY_MIN_PATH_MM, travel: DELAY_TRAVEL_MM, stage: 0, path: DELAY_MIN_PATH_MM });
    assert.equal(delaySetting({ ...fresh, delayStageMm: 500 }).stage, DELAY_TRAVEL_MM);
    assert.equal(delaySetting({ ...fresh, delayStageMm: -5 }).stage, 0);
  });

  it("is about 12 cm long as it comes, its rail reaching the carriage's farthest setting", () => {
    const fresh: BuilderComponent = { id: "d", type: "delay-line", position: [0, 100, 0], rotation: 0 };
    assert.equal(delayRailMm(fresh), DELAY_ARM_BASE_MM + DELAY_TRAVEL_MM + 30);
    assert.equal(delayRailMm({ ...fresh, delayTravelMm: 300 }) - delayRailMm(fresh), 250);
  });

  it("draws nothing of its minimum delay: the rail and carriage stay put", () => {
    const fresh: BuilderComponent = { id: "d", type: "delay-line", position: [0, 100, 0], rotation: 0, delayStageMm: 20 };
    const longer = { ...fresh, delayMinPathMm: 3000 };
    assert.equal(delayRailMm(longer), delayRailMm(fresh));
    assert.equal(delayArmMm(longer), delayArmMm(fresh));
    assert.equal(delayArmMm(fresh), DELAY_ARM_BASE_MM + 20);
    assert.equal(delaySetting(longer).path, 3000 + 2 * 20);
  });

  it("measures a drag along its rail, whichever way it is turned", () => {
    // at 90 the rail (local −x) runs toward +z
    const turned = { ...delay, position: [0, 100, 0] as [number, number, number], rotation: 90 };
    assert.ok(Math.abs(delayRailOffset(turned, 0, 30) - 30) < 1e-9);
    assert.ok(Math.abs(delayRailOffset(turned, 40, 30) - 30) < 1e-9);
    assert.ok(Math.abs(delayRailOffset({ ...turned, rotation: 0 }, -25, 0) - 25) < 1e-9);
  });

  it("stands across a straight beam line, its rail on the side it already faces", () => {
    const a: BuilderComponent = { id: "a", type: "mirror-mount", position: [0, 100, 0], rotation: 0 };
    const b: BuilderComponent = { id: "b", type: "mirror-mount", position: [400, 100, 0], rotation: 0 };
    const across = (rotation: number) =>
      settleAngles({
        version: SCENE_VERSION,
        components: [a, { ...delay, position: [200, 100, 0], rotation }, b],
        beams: [{ ...beam, path: ["a", "delay", "b"] }],
        connections: [],
        frames: [], groups: [],
      }).components.find((part) => part.id === "delay")?.rotation;
    // a beam along +x: the rail (local −x) points along +z at 90, −z at 270
    assert.equal(across(300), 270);
    assert.equal(across(60), 90);
    assert.equal(across(200), 270);
    assert.equal(across(90), 90);
  });

  it("at a bend, lies along the bisector of the stops", () => {
    assert.equal(delayLineYaw([200, 100, 50], m1.position, m2.position, 0), 0);
    assert.equal(delayLineYaw([200, 100, 50], m1.position, m2.position, 170), 180);
    assert.equal(delayLineYaw([0, 0, 0], [0, 0, 0], [0, 0, 0], 0), undefined);
  });

  it("keeps its port where it is when its rail grows; the rail runs back from it", () => {
    const short = bodyCentre({ ...delay, delayTravelMm: 50 });
    const long = bodyCentre({ ...delay, delayTravelMm: 250 });
    assert.equal(short[0], 200 - (DELAY_ARM_BASE_MM + 50 + 30) / 2);
    assert.equal(long[0], 200 - (DELAY_ARM_BASE_MM + 250 + 30) / 2);
  });

  it("opens from a setup file as it was saved, a stage past its travel held at the end", () => {
    const saved = { ...delay, delayMinPathMm: 80, delayTravelMm: 500, delayStageMm: 150 };
    const scene = parseScene({ version: SCENE_VERSION, components: [saved] })!;
    assert.equal(serializeScene(parseScene(JSON.parse(serializeScene(scene)))!), serializeScene(scene));
    const past = parseScene({ version: SCENE_VERSION, components: [{ ...delay, delayTravelMm: 100, delayStageMm: 300 }] })!;
    assert.equal(delaySetting(past.components[0]).stage, 100);
  });

  it("opens one saved by its arm, port to retroreflector, with the same path through it", () => {
    const bare: BuilderComponent = { id: "delay", type: "delay-line", position: [200, 100, 50], rotation: 0 };
    const old = parseScene({ version: SCENE_VERSION, components: [{ ...bare, delayMinMm: 60, delayMaxMm: 260, delayMm: 110 }] })!;
    assert.deepEqual(delaySetting(old.components[0]), { minPath: 120, travel: 200, stage: 50, path: 220 });
    // the old defaults filled what it left out: an arm of 50 to 350, at its shortest
    const partial = parseScene({ version: SCENE_VERSION, components: [{ ...bare, delayMm: 200 }] })!;
    assert.deepEqual(delaySetting(partial.components[0]), { minPath: 100, travel: 300, stage: 150, path: 400 });
  });
});

describe("the light inside a cavity or delay line", () => {
  it("keeps its colour and hidden flag through a setup file", () => {
    const lit = [
      { id: "c", type: "cavity", position: [0, 100, 0], rotation: 0, lightColor: "#16a34a", lightHidden: true },
      { id: "d", type: "delay-line", position: [0, 100, 0], rotation: 0, lightColor: "#0891b2" },
    ];
    const scene = parseScene({ version: SCENE_VERSION, components: lit })!;
    assert.deepEqual(
      scene.components.map(({ lightColor, lightHidden }) => ({ lightColor, lightHidden })),
      [
        { lightColor: "#16a34a", lightHidden: true },
        { lightColor: "#0891b2", lightHidden: undefined },
      ],
    );
  });

  it("is read only on a cavity or delay line, and only from a real colour", () => {
    const scene = parseScene({
      version: SCENE_VERSION,
      components: [
        { id: "m", type: "mirror-mount", position: [0, 100, 0], rotation: 0, lightColor: "#16a34a", lightHidden: true },
        { id: "c", type: "cavity", position: [0, 100, 0], rotation: 0, lightColor: "url(x)" },
      ],
    })!;
    assert.equal(scene.components[0].lightColor, undefined);
    assert.equal(scene.components[0].lightHidden, undefined);
    assert.equal(scene.components[1].lightColor, undefined);
  });
});
