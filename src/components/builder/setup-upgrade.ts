import { settleAims } from "./aim-settling.ts";
import { traceScene } from "./trace-scene.ts";
import { type BuilderSceneData, wasUpgraded } from "./types.ts";

export function upgradeNoticeText(different: number): string {
  return `This file was upgraded. ${different} drawn Beam${different === 1 ? "" : "s"} ${different === 1 ? "differs" : "differ"} from traced light and ${different === 1 ? "remains" : "remain"} on the table. Select ${different === 1 ? "it" : "them"} in the Beams box and check the traced Beam checks in the status bar.`;
}

export function upgradeNotice(scene: BuilderSceneData): string | null {
  if (!wasUpgraded(scene) || scene.beams.length === 0) return null;
  const settled = settleAims(scene).scene;
  const matched = traceScene(settled).matchedDrawnBeamIds.length;
  const different = scene.beams.length - matched;
  return different === 0 ? null : upgradeNoticeText(different);
}
