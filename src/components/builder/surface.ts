/**
 * Surfaces: the places on a Component where light can meet it (ADR 0002, #359).
 * Pure: no React, no three.js, and every function returns new values, so the
 * trace can be rerun on every frame of a drag, cached, or moved off the main thread.
 *
 * A Surface lives in its Component's frame; `placeSurface` carries it to the Table.
 * Millimetres throughout, and `power` is a fraction of the laser's output.
 */

import { add, cross, dot, length, normalize, type Quat, rotate, scale, type Vec3 } from "./quaternion.ts";
import type { Jones } from "./jones.ts";

export type Aperture =
  | { kind: "circle"; radiusMm: number }
  // widthAxis lies in the surface's plane; the height runs along normal × widthAxis.
  | { kind: "rect"; widthMm: number; heightMm: number; widthAxis: Vec3 };

export type SurfaceRule =
  | { kind: "block" }
  | { kind: "pass"; jones?: Jones }
  | { kind: "reflect" }
  | { kind: "isolator"; jones: Jones }
  | { kind: "thin-lens"; focalLengthMm: number }
  // R and T are power fractions; R + T = 1 when lossless, less when the surface absorbs.
  | { kind: "split"; reflectance: number; transmittance: number };

export type Surface = {
  positionMm: Vec3;
  /** Unit length. Which way it points is no matter: every rule reads it only as a line. */
  normal: Vec3;
  aperture: Aperture;
  rule: SurfaceRule;
  extraPathMm?: number;
};

/** One traced beam at one point: where it starts, which way it goes (unit), and how much of the laser's power it carries. */
export type TracedBeam = {
  originMm: Vec3;
  direction: Vec3;
  power: number;
};

export type Pose = { positionMm: Vec3; orientation: Quat };

export type Hit = { hitMm: Vec3; outgoing: TracedBeam[] };

// A beam that starts on a surface must not hit that surface again at t = 0.
const MIN_TRAVEL_MM = 1e-9;
const PARALLEL = 1e-12;
const UNIT_TOLERANCE = 1e-9;

function subtract(a: Vec3, b: Vec3): Vec3 {
  return add(a, scale(b, -1));
}

/** Checks what the types can't say: unit normal, an in-plane unit widthAxis, positive sizes, powers in [0, 1]. */
export function makeSurface(surface: Surface): Surface {
  const { normal, aperture, rule } = surface;
  if (Math.abs(length(normal) - 1) > UNIT_TOLERANCE) throw new Error("surface normal must have unit length");
  if (aperture.kind === "circle") {
    if (!(aperture.radiusMm > 0)) throw new Error("aperture radius must be positive");
  } else {
    if (!(aperture.widthMm > 0 && aperture.heightMm > 0)) throw new Error("aperture sides must be positive");
    if (Math.abs(length(aperture.widthAxis) - 1) > UNIT_TOLERANCE) throw new Error("widthAxis must have unit length");
    if (Math.abs(dot(aperture.widthAxis, normal)) > UNIT_TOLERANCE) throw new Error("widthAxis must lie in the surface's plane");
  }
  if (rule.kind === "split") {
    const { reflectance: r, transmittance: t } = rule;
    if (!(r >= 0 && t >= 0 && r + t <= 1 + UNIT_TOLERANCE)) throw new Error("split needs R, T ≥ 0 and R + T ≤ 1");
  }
  if (rule.kind === "thin-lens" && !(rule.focalLengthMm > 0 && Number.isFinite(rule.focalLengthMm))) {
    throw new Error("thin lens needs a finite positive focal length");
  }
  if (surface.extraPathMm !== undefined && !(surface.extraPathMm >= 0 && Number.isFinite(surface.extraPathMm))) {
    throw new Error("extra path must be finite and non-negative");
  }
  return surface;
}

/** The surface where its Component stands: its position and axes turned by the orientation, then moved. */
export function placeSurface(surface: Surface, pose: Pose): Surface {
  const { aperture } = surface;
  return {
    ...surface,
    positionMm: add(pose.positionMm, rotate(pose.orientation, surface.positionMm)),
    normal: rotate(pose.orientation, surface.normal),
    aperture:
      aperture.kind === "rect" ? { ...aperture, widthAxis: rotate(pose.orientation, aperture.widthAxis) } : aperture,
  };
}

function withinAperture(surface: Surface, hitMm: Vec3): boolean {
  const local = subtract(hitMm, surface.positionMm);
  const { aperture } = surface;
  if (aperture.kind === "circle") return length(local) <= aperture.radiusMm;
  const heightAxis = cross(surface.normal, aperture.widthAxis);
  return Math.abs(dot(local, aperture.widthAxis)) <= aperture.widthMm / 2 && Math.abs(dot(local, heightAxis)) <= aperture.heightMm / 2;
}

/** Where the beam first meets the surface's aperture, or null if it misses, grazes parallel, or points away. */
export function intersect(surface: Surface, beam: TracedBeam): Vec3 | null {
  const along = dot(beam.direction, surface.normal);
  if (Math.abs(along) < PARALLEL) return null;
  const t = dot(subtract(surface.positionMm, beam.originMm), surface.normal) / along;
  if (t <= MIN_TRAVEL_MM) return null;
  const hitMm = add(beam.originMm, scale(beam.direction, t));
  return withinAperture(surface, hitMm) ? hitMm : null;
}

/** d − 2(d·n)n. Even in n, so the side the beam arrives from doesn't matter. */
export function reflectDirection(direction: Vec3, normal: Vec3): Vec3 {
  return normalize(add(direction, scale(normal, -2 * dot(direction, normal))));
}

/** What a rule does to one beam arriving at `hitMm`: zero, one or two beams leave from there. */
export function applyRule(rule: SurfaceRule, normal: Vec3, beam: TracedBeam, hitMm: Vec3, centreMm: Vec3 = hitMm): TracedBeam[] {
  const leaving = (direction: Vec3, fraction: number): TracedBeam => ({
    originMm: hitMm,
    direction,
    power: beam.power * fraction,
  });
  switch (rule.kind) {
    case "block":
      return [];
    case "pass":
      return [leaving(beam.direction, 1)];
    case "isolator":
      return dot(beam.direction, normal) > 0 ? [leaving(beam.direction, 1)] : [];
    case "reflect":
      return [leaving(reflectDirection(beam.direction, normal), 1)];
    case "thin-lens": {
      const displacement = subtract(hitMm, centreMm);
      const bend = Math.abs(dot(beam.direction, normal)) / rule.focalLengthMm;
      return [leaving(normalize(add(beam.direction, scale(displacement, -bend))), 1)];
    }
    case "split": {
      // A branch with no power isn't a beam; dropping it keeps "two outgoing" meaning two.
      const branches = [
        { direction: beam.direction, fraction: rule.transmittance },
        { direction: reflectDirection(beam.direction, normal), fraction: rule.reflectance },
      ];
      return branches.filter((b) => b.fraction > 0).map((b) => leaving(b.direction, b.fraction));
    }
  }
}

/** The beam meets the surface: null if it misses the aperture, otherwise where and what leaves. */
export function interact(surface: Surface, beam: TracedBeam): Hit | null {
  const hitMm = intersect(surface, beam);
  if (hitMm === null) return null;
  return { hitMm, outgoing: applyRule(surface.rule, surface.normal, beam, hitMm, surface.positionMm) };
}

/** The same light travelling the other way along the same line. */
export function reverse(beam: TracedBeam): TracedBeam {
  return { ...beam, direction: scale(beam.direction, -1) };
}
