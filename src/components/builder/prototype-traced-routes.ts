// PROTOTYPE (#395), throwaway: lives on branch prototype/traced-beam-display only.
// Splits a trace into routes (laser to an end) so each variant can draw and list them.
import { effectiveBeams } from "./beam-branches.ts";
import { tracePathContains, type TraceResult, type TraceSegment } from "./trace-scene.ts";
import type { Beam, Vec3 } from "./types.ts";

export type Route = {
  key: string;
  laserId: string;
  segments: TraceSegment[];
  path: string[];
  endId: string | null;
  lengthMm: number;
  power: number;
  depth: number;
  splitAtId: string | null;
  saved: Beam | undefined;
};

const near = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1;
const startsWith = (whole: string[], start: string[]) => start.every((id, at) => whole[at] === id);

export function traceRoutes(trace: TraceResult, beams: Beam[]): Route[] {
  const shown = effectiveBeams(beams);
  const matched = new Set(trace.matchedDrawnBeamIds);
  const routes: Route[] = [];
  for (const tree of trace.trees) {
    const segs = tree.segments;
    const children = (s: TraceSegment) => s.toId
      ? segs.filter((o) => o !== s && o.fromId === s.toId && startsWith(o.path, s.path) && near(o.fromMm, s.toMm))
      : [];
    const parent = (s: TraceSegment) => segs.find((p) => p !== s && p.toId === s.fromId && startsWith(s.path, p.path) && near(p.toMm, s.fromMm));
    const treeRoutes: Route[] = [];
    for (const leaf of segs.filter((s) => children(s).length === 0)) {
      const chain = [leaf];
      for (let up = parent(leaf); up && !chain.includes(up); up = parent(up)) chain.unshift(up);
      const saved = shown
        .filter((beam) => matched.has(beam.id) && beam.path[0] === tree.laserId && tracePathContains(leaf.path, beam.path))
        .sort((a, b) => b.path.length - a.path.length)[0];
      let depth = 0;
      let splitAtId: string | null = null;
      let longest = 0;
      for (const earlier of treeRoutes) {
        let common = 0;
        while (common < earlier.path.length && earlier.path[common] === leaf.path[common]) common++;
        if (common > longest) {
          longest = common;
          depth = earlier.depth + 1;
          splitAtId = leaf.path[common - 1] ?? null;
        }
      }
      treeRoutes.push({
        key: `${tree.laserId}:${leaf.path.join(">")}:${treeRoutes.length}`,
        laserId: tree.laserId,
        segments: chain,
        path: leaf.path,
        endId: leaf.toId,
        lengthMm: leaf.pathLengthMm,
        power: leaf.power,
        depth,
        splitAtId,
        saved,
      });
    }
    routes.push(...treeRoutes);
  }
  return routes;
}

/** Runs of a route's segments not already drawn by an earlier route, so a shared trunk is drawn once. */
export type Run = { route: Route; points: Vec3[]; power: number };

/** Runs of a route's segments not already drawn by an earlier route, so a shared trunk is drawn once; a run also breaks where the power changes. */
export function undrawnRuns(routes: Route[]): Run[] {
  const drawn = new Set<TraceSegment>();
  const runs: Run[] = [];
  for (const route of routes) {
    let points: Vec3[] = [];
    let power = -1;
    const flush = () => {
      if (points.length >= 2) runs.push({ route, points, power });
      points = [];
    };
    for (const segment of route.segments) {
      if (drawn.has(segment)) {
        flush();
        continue;
      }
      drawn.add(segment);
      if (segment.power !== power) {
        const last = points.at(-1);
        flush();
        if (last) points.push(last);
        power = segment.power;
      }
      if (points.length === 0) points.push(segment.fromMm);
      points.push(segment.toMm);
    }
    flush();
  }
  return runs;
}

export type Scenario = "saved" | "unsaved" | "handdrawn";

/** Fakes the cases the starter Setup lacks, for display only: the last matched Beam as unsaved light, or as a hand-drawn Beam. */
export function scenarioTrace(trace: TraceResult, beams: Beam[], scenario: Scenario): TraceResult {
  if (scenario !== "handdrawn") return trace;
  const victim = beams.filter((beam) => trace.matchedDrawnBeamIds.includes(beam.id)).at(-1);
  if (!victim) return trace;
  return {
    ...trace,
    matchedDrawnBeamIds: trace.matchedDrawnBeamIds.filter((id) => id !== victim.id),
    checks: [...trace.checks, {
      kind: "path-mismatch", componentId: victim.path.at(-1)!,
      message: `${victim.label || victim.id}: drawn path differs from trace`,
    }],
  };
}

export function scenarioBeams(trace: TraceResult, beams: Beam[], scenario: Scenario): Beam[] {
  if (scenario !== "unsaved") return beams;
  const victim = beams.filter((beam) => trace.matchedDrawnBeamIds.includes(beam.id)).at(-1);
  return victim ? beams.filter((beam) => beam.id !== victim.id) : beams;
}
