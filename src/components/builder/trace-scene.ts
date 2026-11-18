import { add, dot, length, rotate, scale, type Vec3 } from "./quaternion.ts";
import { applyRule, intersect, placeSurface, type Surface, type TracedBeam } from "./surface.ts";
import {
  AIMED_DETECTORS, COMPONENT_SPECS, componentRadius, fieldValue, referencePoint,
  type BuilderComponent, type BuilderSceneData,
} from "./types.ts";

export type TraceSegment = {
  fromMm: Vec3;
  toMm: Vec3;
  fromId: string | null;
  toId: string | null;
  path: string[];
  power: number;
  pathLengthMm: number;
};

export type BeamTree = { laserId: string; segments: TraceSegment[] };

export type TraceCheck = {
  kind: "blocked" | "missed-aperture" | "wrong-height" | "waiting-for-light" | "segment-limit" | "path-mismatch";
  componentId: string;
  message: string;
};

export type TraceResult = { trees: BeamTree[]; checks: TraceCheck[]; matchedDrawnBeamIds: string[] };

export type TraceOptions = { maxSegmentsPerLaser?: number; maxBounces?: number };

type LocatedSurface = { component: BuilderComponent; surface: Surface };
type TraceState = {
  beam: TracedBeam;
  fromId: string;
  path: string[];
  pathLengthMm: number;
  bounces: number;
  depth: number;
};

const OPEN_BEAM_MM = 500;
const HIT_EPSILON_MM = 1e-7;

function placedSurfaces(components: BuilderComponent[]): LocatedSurface[] {
  return components.flatMap((component) => {
    const pose = { positionMm: referencePoint(component), orientation: component.orientation };
    return (COMPONENT_SPECS[component.type].surfaces?.(component) ?? []).map((surface) => ({
      component, surface: placeSurface(surface, pose),
    }));
  });
}

function nearestHit(surfaces: LocatedSurface[], beam: TracedBeam): { located: LocatedSurface; hitMm: Vec3; distanceMm: number } | null {
  let nearest: { located: LocatedSurface; hitMm: Vec3; distanceMm: number } | null = null;
  for (const located of surfaces) {
    const hitMm = intersect(located.surface, beam);
    if (!hitMm) continue;
    const distanceMm = length(add(hitMm, scale(beam.originMm, -1)));
    if (!nearest || distanceMm < nearest.distanceMm - HIT_EPSILON_MM) nearest = { located, hitMm, distanceMm };
  }
  return nearest;
}

function missedAperture(surfaces: LocatedSurface[], beam: TracedBeam, beforeMm: number): BuilderComponent | null {
  let missed: { component: BuilderComponent; distanceMm: number } | null = null;
  for (const { component, surface } of surfaces) {
    const along = dot(beam.direction, surface.normal);
    if (Math.abs(along) < 1e-12) continue;
    const delta = add(surface.positionMm, scale(beam.originMm, -1));
    const distanceMm = dot(delta, surface.normal) / along;
    if (distanceMm <= HIT_EPSILON_MM || distanceMm >= beforeMm || intersect(surface, beam)) continue;
    const point = add(beam.originMm, scale(beam.direction, distanceMm));
    const gap = length(add(point, scale(surface.positionMm, -1)));
    if (gap > componentRadius(component) || (missed && missed.distanceMm <= distanceMm)) continue;
    missed = { component, distanceMm };
  }
  return missed?.component ?? null;
}

function checkKey(check: TraceCheck): string {
  return `${check.kind}:${check.componentId}`;
}

function pathContains(actual: string[], expected: string[]): boolean {
  if (expected.length === 0) return true;
  for (let start = 0; start <= actual.length - expected.length; start++) {
    if (expected.every((id, index) => actual[start + index] === id)) return true;
  }
  return false;
}

function wrongHeight(segments: TraceSegment[], fromId: string, target: BuilderComponent, surfaces: LocatedSurface[]): boolean {
  const targetSurface = surfaces.find((located) => located.component.id === target.id)?.surface;
  if (!targetSurface) return false;
  const aperture = targetSurface.aperture;
  const tolerance = aperture.kind === "circle" ? aperture.radiusMm : aperture.heightMm / 2;
  for (const segment of segments.filter((candidate) => candidate.fromId === fromId)) {
    const direction = add(segment.toMm, scale(segment.fromMm, -1));
    const flatLengthSquared = direction[0] ** 2 + direction[2] ** 2;
    if (flatLengthSquared < 1e-12) continue;
    const offset = add(target.position, scale(segment.fromMm, -1));
    const t = (offset[0] * direction[0] + offset[2] * direction[2]) / flatLengthSquared;
    if (t < 0) continue;
    const x = segment.fromMm[0] + direction[0] * t;
    const z = segment.fromMm[2] + direction[2] * t;
    const flatGap = Math.hypot(x - target.position[0], z - target.position[2]);
    const y = segment.fromMm[1] + direction[1] * t;
    if (flatGap <= tolerance && Math.abs(y - target.position[1]) > tolerance) return true;
  }
  return false;
}

export function traceScene(scene: BuilderSceneData, options: TraceOptions = {}): TraceResult {
  const maxSegments = options.maxSegmentsPerLaser ?? 256;
  const maxBounces = options.maxBounces ?? 32;
  if (!(Number.isInteger(maxSegments) && maxSegments > 0 && Number.isInteger(maxBounces) && maxBounces >= 0)) {
    throw new Error("trace limits must be non-negative integers, with a positive segment cap");
  }
  const surfaces = placedSurfaces(scene.components);
  const checks = new Map<string, TraceCheck>();
  const reached = new Set<string>();
  const addCheck = (check: TraceCheck) => checks.set(checkKey(check), check);
  const trees: BeamTree[] = [];

  for (const laser of scene.components.filter((component) => component.type === "laser-source")) {
    const start = referencePoint(laser);
    const states: TraceState[] = [{
      beam: { originMm: start, direction: rotate(laser.orientation, [1, 0, 0]), power: 1 },
      fromId: laser.id, path: [laser.id], pathLengthMm: fieldValue(laser, "internalPathMm"), bounces: 0, depth: 0,
    }];
    const segments: TraceSegment[] = [];

    while (states.length > 0 && segments.length < maxSegments) {
      const state = states.pop()!;
      const hit = nearestHit(surfaces, state.beam);
      const distanceMm = hit?.distanceMm ?? OPEN_BEAM_MM;
      const missed = missedAperture(surfaces, state.beam, distanceMm);
      if (missed) addCheck({ kind: "missed-aperture", componentId: missed.id, message: `${missed.label || missed.id}: missed aperture` });
      const toMm = hit?.hitMm ?? add(state.beam.originMm, scale(state.beam.direction, OPEN_BEAM_MM));
      const toId = hit?.located.component.id ?? null;
      const path = toId && toId !== state.path.at(-1) ? [...state.path, toId] : state.path;
      const pathLengthMm = state.pathLengthMm + distanceMm + (hit?.located.surface.extraPathMm ?? 0);
      segments.push({ fromMm: state.beam.originMm, toMm, fromId: state.fromId, toId, path, power: state.beam.power, pathLengthMm });
      if (!hit) continue;
      reached.add(toId!);
      const { component, surface } = hit.located;
      if (surface.rule.kind === "block" && !AIMED_DETECTORS.has(component.type) || surface.rule.kind === "isolator" && dot(state.beam.direction, surface.normal) <= 0) {
        addCheck({ kind: "blocked", componentId: component.id, message: `Blocked by ${component.label || component.id}` });
      }
      if (state.depth >= 64) continue;
      const outgoing = applyRule(surface.rule, surface.normal, state.beam, hit.hitMm, surface.positionMm);
      for (let index = outgoing.length - 1; index >= 0; index--) {
        const next = outgoing[index];
        const reflected = surface.rule.kind === "reflect" || surface.rule.kind === "split" && index === 1;
        if (state.bounces + Number(reflected) > maxBounces) continue;
        states.push({ beam: next, fromId: component.id, path, pathLengthMm, bounces: state.bounces + Number(reflected), depth: state.depth + 1 });
      }
    }
    if (states.length > 0) addCheck({ kind: "segment-limit", componentId: laser.id, message: `${laser.label || laser.id}: trace limit reached` });
    trees.push({ laserId: laser.id, segments });
  }

  const allSegments = trees.flatMap((tree) => tree.segments);
  const matchedDrawnBeamIds: string[] = [];
  for (const drawn of scene.beams) {
    if (allSegments.some((segment) => pathContains(segment.path, drawn.path))) {
      matchedDrawnBeamIds.push(drawn.id);
      continue;
    }
    const parts = drawn.path.map((id) => scene.components.find((component) => component.id === id));
    const wrong = parts.some((target, index) => index > 0 && target && parts[index - 1] && wrongHeight(allSegments, parts[index - 1]!.id, target, surfaces));
    const component = parts.slice(1).find((part) => part && !reached.has(part.id)) ?? parts.at(-1);
    if (component) addCheck({
      kind: wrong ? "wrong-height" : "path-mismatch", componentId: component.id,
      message: wrong ? `${drawn.label || drawn.id}: Beam at wrong height` : `${drawn.label || drawn.id}: drawn path differs from trace`,
    });
  }

  for (const component of scene.components) {
    if ((component.type === "mirror-mount" || component.type === "beam-splitter") && !reached.has(component.id)) {
      addCheck({ kind: "waiting-for-light", componentId: component.id, message: `${component.label || component.id}: waiting for light` });
    }
  }
  return { trees, checks: [...checks.values()], matchedDrawnBeamIds };
}
