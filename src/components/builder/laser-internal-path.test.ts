import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { measureBeam } from "./beam-measurement.ts";

import {
  type Beam,
  type BuilderComponent,
  type ComponentType,
  parseScene,
} from "./types.ts";

// #94: a laser source can carry light before the aperture, a folded or internal
// delay path. A beam that starts at the laser counts it toward its path length;
// a laser anywhere else in a path adds nothing. On the table a beam is measured
// from the laser's opening, which is where the laser is placed.

const part = (id: string, type: ComponentType, x: number, extra: Partial<BuilderComponent> = {}): BuilderComponent => ({
  id,
  type,
  position: [x, 100, 0],
  rotation: 0,
  ...extra,
});

const beam = (path: string[]): Beam => ({ id: "b", path, color: "#7c3aed" });

describe("a laser's built-in path", () => {
  const laser = part("laser", "laser-source", 0, { internalPathMm: 4000 });
  // 300 mm from the laser's opening, its position
  const mirror = part("m", "mirror-mount", 300);

  it("adds to a beam that starts at the laser: 4000 mm inside plus 300 mm on the table is 4300", () => {
    const result = measureBeam([laser, mirror], beam(["laser", "m"]));
    assert.equal(result.lengthMm, 4300);
    assert.equal(result.laserInternalMm, 4000);
    assert.equal(result.delayLineMm, 0);
    assert.deepEqual(result.legLengthsMm, [300]);
  });

  it("follows into the time of flight", () => {
    assert.equal(measureBeam([laser, mirror], beam(["laser", "m"])).timeOfFlightPs.toFixed(1), "14343.3");
  });

  it("adds nothing when the laser is a later stop", () => {
    const first = part("first", "mirror-mount", -300);
    const later = part("laser", "laser-source", 0, { internalPathMm: 4000 });
    // through a laser later in a path, the beam still meets it at its opening
    assert.equal(measureBeam([first, later], beam(["first", "laser"])).lengthMm, 300);
    assert.equal(measureBeam([first, later, mirror], beam(["first", "laser", "m"])).lengthMm, 600);
    assert.equal(measureBeam([first, later], beam(["first", "laser"])).laserInternalMm, 0);
  });

  it("adds once, to a beam that is only a laser", () => {
    const result = measureBeam([laser], beam(["laser"]));
    assert.equal(result.lengthMm, 4000);
    assert.deepEqual(result.legLengthsMm, []);
    assert.equal(result.laserInternalMm, 4000);
  });

  it("starts on the table at the opening, the laser's position, however it is turned", () => {
    const bare = part("laser", "laser-source", 0);
    assert.equal(measureBeam([bare, part("m", "mirror-mount", 300)], beam(["laser", "m"])).lengthMm, 300);
    const turned = { ...bare, rotation: 90 };
    assert.equal(measureBeam([turned, { ...part("m", "mirror-mount", 0), position: [0, 100, -300] }], beam(["laser", "m"])).lengthMm, 300);
  });

  it("is nothing when missing or 0", () => {
    assert.equal(measureBeam([part("laser", "laser-source", 0), mirror], beam(["laser", "m"])).lengthMm, 300);
    assert.equal(measureBeam([{ ...laser, internalPathMm: 0 }, mirror], beam(["laser", "m"])).lengthMm, 300);
  });
});

describe("opening a laser's built-in path", () => {
  const open = (components: object[]) => parseScene({ version: 3, components, beams: [] })?.components;
  const at = (type: string, extra: object) => ({ id: "x", type, position: [0, 100, 0], rotation: 0, ...extra });

  it("keeps it on a laser", () => {
    assert.equal(open([at("laser-source", { internalPathMm: 4000 })])?.[0].internalPathMm, 4000);
  });

  it("clamps it to 0 to 100000 mm and ignores anything that is not a number", () => {
    assert.equal(open([at("laser-source", { internalPathMm: -5 })])?.[0].internalPathMm, 0);
    assert.equal(open([at("laser-source", { internalPathMm: 1e9 })])?.[0].internalPathMm, 100000);
    assert.equal(open([at("laser-source", { internalPathMm: "4000" })])?.[0].internalPathMm, undefined);
    assert.equal(open([at("laser-source", {})])?.[0].internalPathMm, undefined);
  });

  it("is dropped from any part that is not a laser", () => {
    assert.equal(open([at("mirror-mount", { internalPathMm: 4000 })])?.[0].internalPathMm, undefined);
  });
});
