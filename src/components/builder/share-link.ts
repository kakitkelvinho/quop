// A setup carried whole in a link's hash, `#s=<blob>`: the setup's file text,
// minified and lz-compressed into URL-safe characters. The hash never reaches
// a server, so the static site needs no backend to share a setup. A link is
// read back through the same check as a pasted or opened file.

import LZString from "lz-string";

import { checkSceneText } from "./scene-text.ts";
import { DEFAULT_SCENE, parseScene, serializeScene, type BuilderSceneData } from "./types.ts";

/** Past this many characters a link may be cut short by some mail and chat apps. */
export const SHARE_URL_SAFE_LENGTH = 8000;

const HASH = /^#s=(.+)$/;

/** A setup as a link's hash, `#s=<blob>`. */
export function sceneToHash(scene: BuilderSceneData): string {
  return `#s=${LZString.compressToEncodedURIComponent(serializeScene(scene, { minified: true }))}`;
}

/** Whether a hash is a share link's, readable or not. */
export function isShareHash(hash: string): boolean {
  return HASH.test(hash);
}

/** The setup a link's hash carries, or null for no `#s=`, a broken blob or text that isn't a setup. */
export function hashToScene(hash: string): BuilderSceneData | null {
  const blob = HASH.exec(hash)?.[1];
  if (!blob) return null;
  try {
    const text = LZString.decompressFromEncodedURIComponent(blob);
    if (!text) return null;
    const check = checkSceneText(text);
    return check.ok ? check.scene : null;
  } catch {
    return null;
  }
}

let example: string | undefined;

/**
 * Whether a table holds something a shared setup would lose: any part or
 * frame, unless it is just the untouched example.
 */
export function hasWork(scene: BuilderSceneData): boolean {
  if (scene.components.length === 0 && scene.frames.length === 0) return false;
  example ??= serializeScene(parseScene(DEFAULT_SCENE)!);
  return serializeScene(scene) !== example;
}
