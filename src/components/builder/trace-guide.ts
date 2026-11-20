import { beamForTracePath } from "./beam-branches.ts";
import type { TraceResult } from "./trace-scene.ts";
import type { Beam, Vec3 } from "./types.ts";

export type TraceGuideGeometry = { positions: Float32Array; opacity: Float32Array; laserIds: string[] };

const FADE_MM = 40;
const STEPS = 4;
const GUIDE_OPACITY = 0.72;

export function traceGuideGeometry(trace: TraceResult, beams: Beam[]): TraceGuideGeometry {
  const positions: number[] = [];
  const opacity: number[] = [];
  const laserIds: string[] = [];

  function stub(point: Vec3, direction: Vec3, length: number, laserId: string) {
    for (let step = 0; step < STEPS; step++) {
      for (const fraction of [step / STEPS, (step + 1) / STEPS]) {
        positions.push(
          point[0] + direction[0] * length * fraction,
          point[1] + direction[1] * length * fraction + 2,
          point[2] + direction[2] * length * fraction,
        );
        opacity.push(GUIDE_OPACITY * (1 - fraction));
        laserIds.push(laserId);
      }
    }
  }

  for (const tree of trace.trees) {
    for (const segment of tree.segments) {
      if (beamForTracePath(beams, segment.path, segment.toId === null)?.hidden) continue;
      const delta: Vec3 = [
        segment.toMm[0] - segment.fromMm[0],
        segment.toMm[1] - segment.fromMm[1],
        segment.toMm[2] - segment.fromMm[2],
      ];
      const length = Math.hypot(...delta);
      if (length <= 0) continue;
      const direction: Vec3 = delta.map((value) => value / length) as Vec3;
      const fade = Math.min(FADE_MM, length / 2);
      stub(segment.fromMm, direction, fade, tree.laserId);
      if (segment.toId) stub(segment.toMm, direction.map((value) => -value) as Vec3, fade, tree.laserId);
    }
  }
  return { positions: new Float32Array(positions), opacity: new Float32Array(opacity), laserIds };
}
