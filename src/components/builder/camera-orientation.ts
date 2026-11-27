// The camera's turn, handed from the canvas to the HUD. The gizmo lives in the
// HUD's own DOM, outside the canvas's React tree, so the canvas publishes the
// turn here and the gizmo subscribes.

import type { Quaternion } from "./axis-arrows.ts";

const listeners = new Set<() => void>();
let current: Quaternion = [0, 0, 0, 1];

export function publishCameraOrientation(next: Quaternion): void {
  if (next.every((value, index) => value === current[index])) return;
  current = next;
  for (const listener of listeners) listener();
}

export function subscribeCameraOrientation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const cameraOrientation = (): Quaternion => current;
