import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Beam,
  type BuilderComponent,
  type ComponentType,
  beamInternalPathMm,
  beamLengthMm,
  lengthToPicoseconds,
  parseScene,
} from "./types.ts";

// #94: a laser source can carry light before the aperture, a folded or internal
// delay path. A beam that starts at the laser counts it toward its path length;
// a laser anywhere else in a path adds nothing.

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
  const mirror = part("m", "mirror-mount", 300);

  it("adds to a beam that starts at the laser: 4000 mm inside plus 300 mm on the table is 4300", () => {
    assert.equal(beamLengthMm([laser, mirror], beam(["laser", "m"])), 4300);
    assert.equal(beamInternalPathMm([laser, mirror], beam(["laser", "m"])), 4000);
  });

  it("follows into the time of flight", () => {
    assert.equal(lengthToPicoseconds(beamLengthMm([laser, mirror], beam(["laser", "m"]))).toFixed(1), "14343.3");
  });

  it("adds nothing when the laser is a later stop", () => {
    const first = part("first", "mirror-mount", -300);
    const later = part("laser", "laser-source", 0, { internalPathMm: 4000 });
    assert.equal(beamLengthMm([first, later], beam(["first", "laser"])), 300);
    assert.equal(beamLengthMm([first, later, mirror], beam(["first", "laser", "m"])), 600);
    assert.equal(beamInternalPathMm([first, later], beam(["first", "laser"])), 0);
  });

  it("adds once, to a beam that is only a laser", () => {
    assert.equal(beamLengthMm([laser], beam(["laser"])), 4000);
  });

  it("is nothing when missing or 0", () => {
    assert.equal(beamLengthMm([part("laser", "laser-source", 0), mirror], beam(["laser", "m"])), 300);
    assert.equal(beamLengthMm([{ ...laser, internalPathMm: 0 }, mirror], beam(["laser", "m"])), 300);
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
