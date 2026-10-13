import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FRESH_WATCH,
  QUALITY_SETTINGS,
  RUN_MAX_FRAMES,
  RUN_MIN_FRAMES,
  SLOW_RUNS,
  type FrameWatch,
  endRun,
  watchFrame,
} from "./graphics-quality.ts";

/** Plays runs of frame gaps (one array per orbit or drag) and says whether the view was ever called slow. */
function play(runs: number[][]): boolean {
  let watch: FrameWatch = FRESH_WATCH;
  let slow = false;
  for (const run of runs) {
    for (const gap of run) {
      const next = watchFrame(watch, gap);
      watch = next.watch;
      slow ||= next.slow;
    }
    const ended = endRun(watch);
    watch = ended.watch;
    slow ||= ended.slow;
  }
  return slow;
}

const run = (gap: number, frames = 20) => Array<number>(frames).fill(gap);

describe("watching the frame rate while the view moves", () => {
  it("calls a view slow after runs in a row under 25 fps", () => {
    assert.equal(play(Array.from({ length: SLOW_RUNS }, () => run(60))), true);
    assert.equal(play(Array.from({ length: SLOW_RUNS - 1 }, () => run(60))), false);
  });

  it("catches a view far too slow for smooth motion: a frame a second", () => {
    assert.equal(play([run(1000, 6), run(1000, 6)]), true);
  });

  it("never calls a smooth view slow", () => {
    assert.equal(play(Array.from({ length: 10 }, () => run(16))), false);
  });

  it("ignores a run too short to judge, such as a click", () => {
    assert.equal(play(Array.from({ length: 10 }, () => run(500, RUN_MIN_FRAMES - 1))), false);
  });

  it("needs the slow runs in a row: a smooth one between them starts the count over", () => {
    assert.equal(play([run(60), run(16), run(60)]), false);
  });

  it("goes by the median, so a hitch or two in a smooth run doesn't count", () => {
    const hitchy = [...run(16, 17), 300, 300, 300];
    assert.equal(play([hitchy, hitchy, hitchy]), false);
  });

  it("judges a long orbit as it goes, without waiting for it to end", () => {
    let watch: FrameWatch = FRESH_WATCH;
    let slow = false;
    for (const gap of run(60, RUN_MAX_FRAMES * SLOW_RUNS)) {
      const next = watchFrame(watch, gap);
      watch = next.watch;
      slow ||= next.slow;
    }
    assert.equal(slow, true);
  });
});

describe("QUALITY_SETTINGS", () => {
  it("draws less in Light: no effects, fewer pixels, a smaller shadow map", () => {
    const [full, light] = [QUALITY_SETTINGS.full, QUALITY_SETTINGS.light];
    assert.equal(light.effects, false);
    assert.ok(light.dpr[1] <= 1.5 && light.dpr[1] < full.dpr[1]);
    assert.ok(light.shadowMapSize < full.shadowMapSize);
  });
});
