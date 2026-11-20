import { tracePathContains, type TraceCheck, type TraceResult, type TraceSegment } from "./trace-scene.ts";
import { referencePoint, type Beam, type BuilderComponent } from "./types.ts";

export type LightRoute = {
  id: string;
  laserId: string;
  segments: TraceSegment[];
  path: string[];
  endId: string | null;
  lengthMm: number;
  power: number;
  beam: Beam | null;
  checks: TraceCheck[];
};

function onRoute(routeId: string, segmentId: string): boolean {
  return routeId === segmentId || routeId.startsWith(`${segmentId}/`);
}

export function traceRoutes(trace: TraceResult, beams: Beam[]): LightRoute[] {
  const matched = new Set(trace.matchedDrawnBeamIds);
  const routes: LightRoute[] = trace.trees.flatMap((tree) => {
    const rootId = encodeURIComponent(tree.laserId);
    const ids = [...new Set(tree.segments.map((segment) => segment.routeId ?? rootId))];
    const leaves = ids.filter((id) => !ids.some((other) => other !== id && other.startsWith(`${id}/`)));
    return leaves.map((id) => {
      const segments = tree.segments.filter((segment) => onRoute(id, segment.routeId ?? rootId));
      const last = segments.at(-1)!;
      return {
        id, laserId: tree.laserId, segments, path: last.path, endId: last.toId,
        lengthMm: last.pathLengthMm, power: last.power, beam: null,
        checks: trace.checks.filter((check) => check.routeId && onRoute(id, check.routeId)),
      };
    });
  });
  const used = new Set<string>();
  for (const sourceFirst of [true, false]) {
    for (const route of routes) {
      if (route.beam) continue;
      const beam = beams
        .filter((entry) => matched.has(entry.id) && (sourceFirst || !used.has(entry.id))
          && (!sourceFirst || entry.path[0] === route.laserId)
          && tracePathContains(route.path, entry.path))
        .sort((a, b) => b.path.length - a.path.length)[0];
      if (!beam) continue;
      route.beam = beam;
      used.add(beam.id);
    }
  }
  return routes;
}

export type TracedDistanceLeg = {
  fromId: string;
  toId: string;
  fromMm: TraceSegment["fromMm"];
  toMm: TraceSegment["toMm"];
  lengthMm: number;
};

export function tracedDistanceLegs(routes: LightRoute[], components: BuilderComponent[]): TracedDistanceLeg[] {
  const points = new Map(components.map((component) => [component.id, referencePoint(component)]));
  const seen = new Set<string>();
  const legs: TracedDistanceLeg[] = [];
  for (const route of routes) {
    for (const segment of route.segments) {
      if (!segment.fromId || !segment.toId || segment.fromId === segment.toId) continue;
      const fromMm = points.get(segment.fromId);
      const toMm = points.get(segment.toId);
      if (!fromMm || !toMm) continue;
      const key = [segment.fromId, segment.toId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      legs.push({
        fromId: segment.fromId, toId: segment.toId,
        fromMm, toMm,
        lengthMm: Math.hypot(...toMm.map((value, index) => value - fromMm[index])),
      });
    }
  }
  return legs;
}

export function looseTraceChecks(trace: TraceResult, routes: LightRoute[]): TraceCheck[] {
  return trace.checks.filter((check) => !routes.some((route) => route.checks.includes(check)));
}
