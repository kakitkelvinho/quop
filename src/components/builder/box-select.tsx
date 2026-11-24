"use client";

import type { RefObject } from "react";

import { useBoxSelect, type ScreenBox } from "@/components/builder/use-box-select";

/**
 * The box being dragged out, drawn over the canvas. Its own component so that
 * each pointer move re-renders only the box, not the whole scene.
 */
export function BoxSelect({
  hostRef,
  enabled,
  plain,
  onClick,
  onBox,
}: {
  hostRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  plain: boolean;
  onClick: () => void;
  onBox: (box: ScreenBox, adding: boolean) => void;
}) {
  const box = useBoxSelect(hostRef, { enabled, plain, onClick, onBox });
  if (!box) return null;
  return (
    <div
      className="builderBoxSelect"
      style={{ left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top }}
    />
  );
}
