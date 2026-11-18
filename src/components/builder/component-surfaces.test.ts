import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";

import { BEAM_CUBE_EDGE_MM } from "./model-dimensions.ts";
import { dot, fromYawDeg, length, type Vec3 } from "./quaternion.ts";
import { interact, placeSurface, type Surface, type TracedBeam } from "./surface.ts";
import { COMPONENT_SPECS, newComponent, referencePoint, type ComponentType } from "./types.ts";

const opticalKinds: ComponentType[] = [
  "mirror-mount", "beam-splitter", "lens", "photodiode", "camera", "spectrometer", "single-photon-detector",
];

function surfaces(type: ComponentType): Surface[] {
  const component = newComponent(type, type, 100, 200);
  const declared = COMPONENT_SPECS[type].surfaces;
  assert.ok(declared, `${type} has no surfaces`);
  return declared(component);
}

function atCentre(surface: Surface): TracedBeam {
  const [x, y, z] = surface.positionMm;
  return { originMm: [x - 50, y, z], direction: [1, 0, 0], power: 1 };
}

function offsetBeam(surface: Surface): TracedBeam {
  const beam = atCentre(surface);
  const outside = surface.aperture.kind === "circle"
    ? surface.aperture.radiusMm + 1
    : surface.aperture.heightMm / 2 + 1;
  return { ...beam, originMm: [beam.originMm[0], beam.originMm[1] + outside, beam.originMm[2]] };
}

describe("Component surfaces", () => {
  for (const type of opticalKinds) {
    it(`${type} meets a centre Beam and misses one outside its aperture`, () => {
      for (const surface of surfaces(type)) {
        const centre = interact(surface, atCentre(surface));
        assert.ok(centre, `${type} centre missed`);
        assert.equal(interact(surface, offsetBeam(surface)), null, `${type} accepted a Beam outside its aperture`);
      }
    });
  }

  it("places each surface relative to its Component Reference point", () => {
    for (const type of opticalKinds) {
      const component = newComponent(type, type, 100, 200);
      const point = referencePoint(component);
      for (const surface of surfaces(type)) {
        const placed = placeSurface(surface, { positionMm: point, orientation: component.orientation });
        assert.deepEqual(placed.positionMm, [
          point[0] + surface.positionMm[0],
          point[1] + surface.positionMm[1],
          point[2] + surface.positionMm[2],
        ]);
      }
      if (type !== "beam-splitter") assert.deepEqual(surfaces(type)[0].positionMm, [0, 0, 0]);
    }
    assert.deepEqual(surfaces("beam-splitter").map((surface) => surface.positionMm), [
      [-BEAM_CUBE_EDGE_MM / 2, 0, 0], [BEAM_CUBE_EDGE_MM / 2, 0, 0], [0, 0, 0],
    ]);
  });

  it("reflects at a mirror and splits a Beam cube into transmitted and reflected branches", () => {
    const mirror = interact(surfaces("mirror-mount")[0], atCentre(surfaces("mirror-mount")[0]));
    assert.deepEqual(mirror?.outgoing.map((beam) => beam.direction), [[-1, 0, 0]]);
    const cube = surfaces("beam-splitter")[2];
    const split = interact(cube, atCentre(cube));
    assert.ok(split);
    assert.deepEqual(split.outgoing[0].direction, [1, 0, 0]);
    assert.ok(length([
      split.outgoing[1].direction[0],
      split.outgoing[1].direction[1],
      split.outgoing[1].direction[2] - 1,
    ]) < 1e-12);
    assert.deepEqual(split?.outgoing.map((beam) => beam.power), [0.5, 0.5]);
  });

  it("focuses an off-axis Beam according to the Lens field and passes one through its centre", () => {
    const lens = newComponent("lens", "lens", 0, 0);
    lens.focalLength = 50;
    const surface = COMPONENT_SPECS.lens.surfaces!(lens)[0];
    const centre = interact(surface, atCentre(surface));
    assert.deepEqual(centre?.outgoing[0].direction, [1, 0, 0]);
    const offset = interact(surface, { originMm: [-50, 5, 0], direction: [1, 0, 0], power: 1 });
    assert.ok(offset);
    assert.ok(offset.outgoing[0].direction[1] < 0);
    assert.ok(Math.abs(offset.outgoing[0].direction[1] / offset.outgoing[0].direction[0] + 5 / 50) < 1e-12);
  });

  it("uses a reversible thin Lens rule for paraxial Beams", () => {
    fc.assert(fc.property(
      fc.double({ min: -10, max: 10, noNaN: true }),
      fc.double({ min: 20, max: 2000, noNaN: true }),
      (heightMm, focalLengthMm) => {
        const surface = COMPONENT_SPECS.lens.surfaces!({ ...newComponent("lens", "lens", 0, 0), focalLength: focalLengthMm })[0];
        const incoming: TracedBeam = { originMm: [-10, heightMm, 0], direction: [1, 0, 0], power: 1 };
        const forward = interact(surface, incoming);
        assert.ok(forward);
        const outgoing = forward.outgoing[0];
        assert.ok(Math.abs(outgoing.direction[1] / outgoing.direction[0] + heightMm / focalLengthMm) < 1e-12);
        const reversed: TracedBeam = {
          originMm: [outgoing.direction[0] * 10, heightMm + outgoing.direction[1] * 10, 0],
          direction: [-outgoing.direction[0], -outgoing.direction[1], 0], power: 1,
        };
        const back = interact(surface, reversed);
        assert.ok(back);
        assert.ok(Math.abs(back.outgoing[0].direction[0] + 1) < 1e-12);
        assert.ok(Math.abs(back.outgoing[0].direction[1]) < 1e-12);
      },
    ));
  });

  it("absorbs a Beam at every detector Reference point", () => {
    for (const type of opticalKinds.slice(3)) {
      const surface = surfaces(type)[0];
      assert.deepEqual(interact(surface, atCentre(surface))?.outgoing, []);
    }
  });

  it("obeys the reflection and power laws for rotated mirrors and cubes", () => {
    fc.assert(fc.property(fc.double({ min: -180, max: 180, noNaN: true }), (yaw) => {
      const orientation = fromYawDeg(yaw);
      for (const type of ["mirror-mount", "beam-splitter"] as const) {
        const local = surfaces(type)[type === "mirror-mount" ? 0 : 2];
        const placed = placeSurface(local, { positionMm: [0, 0, 0], orientation });
        const normal = placed.normal;
        const direction: Vec3 = normal;
        const beam: TracedBeam = { originMm: [-normal[0] * 30, -normal[1] * 30, -normal[2] * 30], direction, power: 1 };
        const hit = interact(placed, beam);
        assert.ok(hit);
        assert.ok(Math.abs(hit.outgoing.reduce((sum, branch) => sum + branch.power, 0) - 1) < 1e-12);
        for (const branch of hit.outgoing) assert.ok(Math.abs(length(branch.direction) - 1) < 1e-12);
        if (type === "mirror-mount") assert.ok(Math.abs(dot(hit.outgoing[0].direction, normal) + 1) < 1e-12);
      }
    }));
  });
});
