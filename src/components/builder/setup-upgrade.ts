import { settleAims } from "./aim-settling.ts";
import { traceScene } from "./trace-scene.ts";
import { type BuilderSceneData, wasUpgraded } from "./types.ts";

export function upgradeNotice(scene: BuilderSceneData): string | null {
  if (!wasUpgraded(scene) || scene.beams.length === 0) return null;
  const settled = settleAims(scene).scene;
  const matched = traceScene(settled).matchedDrawnBeamIds.length;
  return matched === scene.beams.length ? null
    : `This file was upgraded. ${scene.beams.length - matched} drawn Beam${scene.beams.length - matched === 1 ? "" : "s"} differ from traced light and remain on the table.`;
}
