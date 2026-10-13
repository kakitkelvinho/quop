import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Beam,
  type BuilderComponent,
  DELAY_RANGE_MM,
  SCENE_VERSION,
  beamDelayMm,
  beamLengthMm,
  bodyCentre,
  delayLineYaw,
  delaySetting,
  parseScene,
  serializeScene,
  settleAngles,
} from "./types.ts";

// A delay line stands across a beam line: fold mirrors at its port send the
// light down its rail to the retroreflector and back, and it leaves along the
// line it came in on. The round trip counts in path length.

const m1: BuilderComponent = { id: "m1", type: "mirror-mount", position: [0, 100, 100], rotation: 0 };
const delay: BuilderComponent = { id: "delay", type: "delay-line", position: [200, 100, 50], rotation: 0, delayMm: 120 };
const m2: BuilderComponent = { id: "m2", type: "mirror-mount", position: [0, 100, 0], rotation: 0 };
const beam: Beam = { id: "b", path: ["m1", "delay", "m2"], color: "#e33" };
const components = [m1, delay, m2];

describe("a delay line", () => {
  it("adds its arm twice, out and back, to a beam through it", () => {
    assert.equal(beamDelayMm(components, beam), 240);
    const toPort = Math.hypot(200, 50);
    assert.ok(Math.abs(beamLengthMm(components, beam) - (2 * toPort + 240)) < 1e-9);
  });

  it("adds nothing to a beam that only starts or ends at it", () => {
    assert.equal(beamDelayMm(components, { ...beam, path: ["m1", "delay"] }), 0);
  });

  it("counts each pass through it", () => {
    assert.equal(beamDelayMm(components, { ...beam, path: ["m1", "delay", "m2", "delay", "m1"] }), 480);
  });

  it("holds its arm within its range, and starts at its shortest", () => {
    assert.deepEqual(delaySetting({ ...delay, delayMm: undefined }), { min: DELAY_RANGE_MM[0], max: DELAY_RANGE_MM[1], arm: DELAY_RANGE_MM[0] });
    assert.equal(delaySetting({ ...delay, delayMinMm: 100, delayMaxMm: 200, delayMm: 500 }).arm, 200);
    assert.equal(delaySetting({ ...delay, delayMinMm: 300, delayMaxMm: 100 }).max, 300);
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
        frames: [],
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
    const short = bodyCentre({ ...delay, delayMaxMm: 200 });
    const long = bodyCentre({ ...delay, delayMaxMm: 400 });
    assert.equal(short[0], 200 - (200 + 40) / 2);
    assert.equal(long[0], 200 - (400 + 40) / 2);
  });

  it("opens from a setup file as it was saved, a backwards range held in order", () => {
    const saved = { ...delay, delayMinMm: 80, delayMaxMm: 500, delayMm: 150 };
    const scene = parseScene({ version: SCENE_VERSION, components: [saved] })!;
    assert.equal(serializeScene(parseScene(JSON.parse(serializeScene(scene)))!), serializeScene(scene));
    const backwards = parseScene({ version: SCENE_VERSION, components: [{ ...delay, delayMinMm: 300, delayMaxMm: 100, delayMm: 50 }] })!;
    assert.deepEqual(delaySetting(backwards.components[0]), { min: 300, max: 300, arm: 300 });
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
