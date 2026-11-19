import { cross, length, normalize, scale, canonical, compose, fromYawDeg, type Quat, type Vec3 } from "./quaternion.ts";
import { traceScene } from "./trace-scene.ts";
import { type BuilderComponent, type BuilderSceneData, delayLineYaw, referencePoint, yawOf } from "./types.ts";

export type AimStatus = { kind: "aimed" | "snapped" | "free" | "waiting"; previousId?: string; reason?: string };

const REDIRECTORS = new Set(["mirror-mount", "beam-splitter"]);
const MAX_PASSES = 8;
const EPS = 1e-8;

export function canAim(component: BuilderComponent): boolean {
  return REDIRECTORS.has(component.type);
}

function minus(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function unitBetween(from: Vec3, to: Vec3): Vec3 | null {
  const delta = minus(to, from);
  return length(delta) < EPS ? null : normalize(delta);
}

function normalFor(dIn: Vec3, dOut: Vec3): Vec3 | null {
  const difference = minus(dOut, dIn);
  return length(difference) < EPS ? null : normalize(difference);
}

export function orientationForNormal(normal: Vec3): Quat {
  const n = normalize(normal);
  if (n[0] < -1 + EPS) return [0, 1, 0, 0];
  return canonical([0, -n[2], n[1], 1 + n[0]]);
}

function foldDirection(dIn: Vec3, fold: 1 | -1): Vec3 {
  const side = cross(dIn, [0, 1, 0]);
  const across = length(side) < EPS ? cross(dIn, [0, 0, 1]) : side;
  return scale(normalize(across), fold);
}

function sameOrientation(a: Quat, b: Quat): boolean {
  return a.every((value, index) => Math.abs(value - b[index]) < 1e-10);
}

function arrivals(scene: BuilderSceneData): Map<string, string> {
  const first = new Map<string, string>();
  for (const tree of traceScene(scene, { settling: true }).trees) {
    for (const segment of tree.segments) {
      if (segment.toId && segment.fromId && !first.has(segment.toId)) first.set(segment.toId, segment.fromId);
    }
  }
  return first;
}

function preceding(scene: BuilderSceneData, reachedFrom: Map<string, string>): Map<string, string> {
  const rank = new Map<string, number>();
  scene.beams.forEach((beam, index) => beam.path.forEach((id) => {
    if (!rank.has(id)) rank.set(id, index);
  }));
  const byTarget = new Map<string, BuilderComponent[]>();
  for (const component of scene.components) {
    if (!canAim(component) || !component.aim) continue;
    const aimers = byTarget.get(component.aim) ?? [];
    aimers.push(component);
    byTarget.set(component.aim, aimers);
  }
  const result = new Map(reachedFrom);
  for (const [id, aimers] of byTarget) {
    aimers.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    result.set(id, aimers[0].id);
  }
  return result;
}

function onePass(scene: BuilderSceneData): { scene: BuilderSceneData; statuses: Map<string, AimStatus>; changed: boolean } {
  const byId = new Map(scene.components.map((component) => [component.id, component]));
  const before = preceding(scene, arrivals(scene));
  const statuses = new Map<string, AimStatus>();
  let changed = false;
  const components = scene.components.map((component) => {
    if (component.type === "delay-line") {
      // It stands across the line from its preceding Component; with none it keeps its orientation (#360).
      const previous = byId.get(before.get(component.id) ?? "");
      const yaw = previous && delayLineYaw(component.position, referencePoint(previous), component.position, yawOf(component));
      if (yaw === undefined) return component;
      const orientation = fromYawDeg(yaw);
      if (sameOrientation(component.orientation, orientation)) return component;
      changed = true;
      return { ...component, orientation };
    }
    if (!canAim(component)) return component;
    if (component.free && !component.aim) {
      statuses.set(component.id, { kind: "free" });
      return component;
    }
    const previousId = before.get(component.id);
    const previous = previousId && byId.get(previousId);
    if (!previous) {
      statuses.set(component.id, { kind: "waiting", reason: "waiting for light or a Component before it" });
      return component;
    }
    const dIn = unitBetween(referencePoint(previous), referencePoint(component));
    if (!dIn) {
      statuses.set(component.id, { kind: "waiting", previousId, reason: "on top of the Component before it" });
      return component;
    }
    const target = component.aim ? byId.get(component.aim) : undefined;
    if (component.aim && !target) {
      statuses.set(component.id, { kind: "waiting", previousId, reason: "aim target is missing" });
      return component;
    }
    const dOut = target ? unitBetween(referencePoint(component), referencePoint(target)) : foldDirection(dIn, component.fold ?? 1);
    const normal = dOut && normalFor(dIn, dOut);
    if (!normal) {
      statuses.set(component.id, { kind: "waiting", previousId, reason: "no reflection points toward the target" });
      return component;
    }
    statuses.set(component.id, { kind: target ? "aimed" : "snapped", previousId });
    // A Beam cube's reflective surface is diagonal to its body axis.
    const orientation = component.type === "beam-splitter"
      ? compose(orientationForNormal(normal), fromYawDeg(-45))
      : orientationForNormal(normal);
    if (sameOrientation(component.orientation, orientation)) return component;
    changed = true;
    return { ...component, orientation };
  });
  return { scene: changed ? { ...scene, components } : scene, statuses, changed };
}

export function settleAims(scene: BuilderSceneData): { scene: BuilderSceneData; statuses: Map<string, AimStatus>; passes: number } {
  let current = scene;
  let statuses = new Map<string, AimStatus>();
  let passes = 0;
  for (; passes < MAX_PASSES; passes++) {
    const next = onePass(current);
    current = next.scene;
    statuses = next.statuses;
    if (!next.changed) return { scene: current, statuses, passes: passes + 1 };
  }
  return { scene: current, statuses, passes };
}

export function flipFold(scene: BuilderSceneData, id: string): BuilderSceneData {
  return { ...scene, components: scene.components.map((component) =>
    component.id === id && canAim(component)
      ? { ...component, aim: undefined, free: undefined, fold: component.fold === -1 ? 1 : -1 }
      : component,
  ) };
}

export function aimAt(scene: BuilderSceneData, id: string, targetId: string): BuilderSceneData {
  if (id === targetId || !scene.components.some((component) => component.id === targetId)) return scene;
  return { ...scene, components: scene.components.map((component) =>
    component.id === id && canAim(component) ? { ...component, aim: targetId, free: undefined } : component,
  ) };
}

/**
 * On placing or releasing `releasedId`: an unaimed Mirror or Beam cube takes as its aim what its
 * reflected light lands on, when either it or that target is the released Component. Others
 * keep their state, so an F flip elsewhere is not undone (#390).
 */
export function catchAims(scene: BuilderSceneData, releasedId: string): BuilderSceneData {
  const byId = new Map(scene.components.map((component) => [component.id, component]));
  const caught = new Map<string, string>();
  for (const tree of traceScene(scene).trees) {
    for (const segment of tree.segments) {
      const from = segment.fromId && byId.get(segment.fromId);
      const target = segment.toId && byId.get(segment.toId);
      const released = from && target && (from.id === releasedId || target.id === releasedId);
      if (released && canAim(from) && !from.aim && !from.free && target.type !== "laser-source" && segment.arm === "reflected" && !caught.has(from.id)) {
        caught.set(from.id, target.id);
      }
    }
  }
  if (!caught.size) return scene;
  return { ...scene, components: scene.components.map((component) =>
    caught.has(component.id) ? { ...component, aim: caught.get(component.id) } : component,
  ) };
}

export function insertIntoAimedPath(scene: BuilderSceneData, insertedId: string): BuilderSceneData {
  const redirected = new Set(traceScene(scene, { settling: true }).trees.flatMap((tree) => tree.segments)
    .filter((segment) => segment.toId === insertedId && segment.arm === "reflected")
    .map((segment) => segment.fromId));
  return { ...scene, components: scene.components.map((component) =>
    redirected.has(component.id) && canAim(component) && component.aim && component.aim !== insertedId
      ? { ...component, aim: insertedId }
      : component,
  ) };
}
