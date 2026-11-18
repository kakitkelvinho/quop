import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adjoint, multiplyJones, IDENTITY_JONES } from "./jones.ts";
import { interact, type Surface, type TracedBeam } from "./surface.ts";
import { COMPONENT_SPECS, delaySetting, newComponent, type ComponentType } from "./types.ts";

function surfaces(type: ComponentType): Surface[] {
  const declaration = COMPONENT_SPECS[type].surfaces;
  assert.ok(declaration, `${type} has no surfaces entry`);
  return declaration(newComponent(type, type, 0, 0));
}

const beam = (direction: 1 | -1): TracedBeam => ({ originMm: [-10 * direction, 0, 0], direction: [direction, 0, 0], power: 1 });

describe("surfaces for every Component kind", () => {
  it("has an explicit entry for every kind", () => {
    for (const type of Object.keys(COMPONENT_SPECS) as ComponentType[]) {
      assert.ok(COMPONENT_SPECS[type].surfaces, `${type} has no surfaces entry`);
      for (const surface of type === "beam-splitter" ? [] : surfaces(type)) {
        assert.deepEqual(surface.positionMm, [0, 0, 0], `${type} needs a Reference point offset`);
      }
    }
  });

  it("has no input surface on a laser or a standalone Translation stage", () => {
    assert.deepEqual(surfaces("laser-source"), []);
    assert.deepEqual(surfaces("translation-stage"), []);
  });

  it("lets light pass through transparent and active optics and blocks it at opaque Components", () => {
    for (const type of ["fiber-collimator", "waveplate", "filter", "iris", "paul-trap", "sample", "objective", "aom", "eom", "delay-line"] as ComponentType[]) {
      const [surface] = surfaces(type);
      assert.equal(interact(surface, beam(1))?.outgoing.length, 1, `${type} should pass light`);
    }
    for (const type of ["particle", "time-tagger", "beam-block", "block"] as ComponentType[]) {
      const [surface] = surfaces(type);
      assert.deepEqual(interact(surface, beam(1))?.outgoing, [], `${type} should block light`);
    }
    const cavity = surfaces("cavity")[0];
    assert.deepEqual(interact(cavity, beam(1))?.outgoing.map((branch) => branch.power), [0.5, 0.5]);
  });

  it("uses the drawn apertures for the iris and crystal modulators", () => {
    for (const [type, within, outside] of [
      ["iris", 4.9, 5.1], ["aom", 5.9, 6.1], ["eom", 4.4, 4.6],
    ] as const) {
      const [surface] = surfaces(type);
      assert.ok(interact(surface, { ...beam(1), originMm: [-10, 0, within] }));
      assert.equal(interact(surface, { ...beam(1), originMm: [-10, 0, outside] }), null);
    }
  });

  it("adds the Delay line's minimum path and twice its stage position", () => {
    const component = { ...newComponent("delay-line", "delay", 0, 0), delayMinPathMm: 300, delayStageMm: 18 };
    const surface = COMPONENT_SPECS["delay-line"].surfaces!(component)[0];
    assert.equal(surface.extraPathMm, delaySetting(component).path);
    assert.equal(surface.extraPathMm, 336);
    assert.equal(surface.aperture.kind, "circle");
    if (surface.aperture.kind === "circle") assert.equal(surface.aperture.radiusMm, 12.7);
  });

  it("carries the waveplate's Jones matrix and makes the Faraday isolator one-way", () => {
    const waveplate = surfaces("waveplate")[0];
    assert.equal(waveplate.rule.kind, "pass");
    if (waveplate.rule.kind === "pass") {
      assert.ok(waveplate.rule.jones);
      const product = multiplyJones(adjoint(waveplate.rule.jones), waveplate.rule.jones);
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
        assert.ok(Math.abs(product[row][col].re - IDENTITY_JONES[row][col].re) < 1e-12);
        assert.ok(Math.abs(product[row][col].im - IDENTITY_JONES[row][col].im) < 1e-12);
      }
    }
    const isolator = surfaces("faraday-isolator")[0];
    assert.equal(isolator.rule.kind, "isolator");
    assert.equal(interact(isolator, beam(1))?.outgoing.length, 1);
    assert.deepEqual(interact(isolator, beam(-1))?.outgoing, []);
  });
});
