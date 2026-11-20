import { tracePathContains, type TraceCheck, type TraceResult, type TraceSegment } from "./trace-scene.ts";
import type { Beam } from "./types.ts";

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
  return trace.trees.flatMap((tree) => {
    const rootId = encodeURIComponent(tree.laserId);
    const ids = [...new Set(tree.segments.map((segment) => segment.routeId ?? rootId))];
    const leaves = ids.filter((id) => !ids.some((other) => other !== id && other.startsWith(`${id}/`)));
    return leaves.map((id) => {
      const segments = tree.segments.filter((segment) => onRoute(id, segment.routeId ?? rootId));
      const last = segments.at(-1)!;
      const beam = beams
        .filter((entry) => matched.has(entry.id) && entry.path[0] === tree.laserId && tracePathContains(last.path, entry.path))
        .sort((a, b) => b.path.length - a.path.length)[0] ?? null;
      return {
        id, laserId: tree.laserId, segments, path: last.path, endId: last.toId,
        lengthMm: last.pathLengthMm, power: last.power, beam,
        checks: trace.checks.filter((check) => check.routeId && onRoute(id, check.routeId)),
      };
    });
  });
}

export function looseTraceChecks(trace: TraceResult, routes: LightRoute[]): TraceCheck[] {
  return trace.checks.filter((check) => !routes.some((route) => route.checks.includes(check)));
}
