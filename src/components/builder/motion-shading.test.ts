import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AO_FADE_IN_MS, motionShade } from "./motion-shading.ts";

const still = { cameraMoving: false, dragging: false };

describe("motionShade", () => {
  it("drops the occlusion while the view moves or a part is dragged", () => {
    assert.equal(motionShade({ ...still, cameraMoving: true }, 1, 16).occlusion, false);
    assert.equal(motionShade({ ...still, dragging: true }, 1, 16).occlusion, false);
  });

  it("starts the fade over when motion resumes mid-fade", () => {
    assert.equal(motionShade({ ...still, cameraMoving: true }, 0.5, 16).occlusionFade, 0);
  });

  it("fades the occlusion back in over a few frames, even after a long rest", () => {
    let fade = 0;
    let frames = 0;
    for (;;) {
      const shade = motionShade(still, fade, 5000);
      fade = shade.occlusionFade;
      frames++;
      if (!shade.fading) break;
    }
    assert.equal(fade, 1);
    assert.equal(frames, Math.ceil(AO_FADE_IN_MS / (1000 / 60)));
  });

  it("leaves a still view exactly as before: full occlusion", () => {
    assert.deepEqual(motionShade(still, 1, 16), { occlusion: true, occlusionFade: 1, fading: false });
  });
});
