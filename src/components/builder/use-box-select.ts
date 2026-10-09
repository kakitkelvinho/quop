"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { CLICK_SLOP_PX } from "@/components/builder/builder-canvas";

/** A box on screen, px. */
export type ScreenBox = { left: number; top: number; right: number; bottom: number };

/**
 * Ctrl/⌘ + left press on the canvas: a click, or, once it travels, a box
 * dragged out. The press is taken in the capture phase on the canvas host and
 * stopped there. The host is an ancestor of the element the camera controls
 * and the canvas's own pointer events listen on, so neither sees it: a
 * modified press never orbits or drags a part. Returns the box being drawn,
 * relative to the host.
 */
export function useBoxSelect(
  hostRef: RefObject<HTMLElement | null>,
  {
    enabled,
    onClick,
    onBox,
  }: {
    enabled: boolean;
    onClick: () => void;
    /** the box let go of, in client px, and whether Shift was held then */
    onBox: (box: ScreenBox, adding: boolean) => void;
  },
): ScreenBox | null {
  const [drawn, setDrawn] = useState<ScreenBox | null>(null);
  // read at press time, not dependencies: re-binding mid-drag would drop it
  const latest = useRef({ enabled, onClick, onBox });
  useLayoutEffect(() => {
    latest.current = { enabled, onClick, onBox };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let release: (() => void) | null = null;

    const onPointerDown = (down: PointerEvent) => {
      const modified = down.ctrlKey || down.metaKey;
      if (!latest.current.enabled || !modified || down.button !== 0 || down.pointerType === "touch") return;
      down.stopPropagation();
      // no text selection while the box is drawn; the focus still leaves a field, as on any click
      down.preventDefault();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      release?.();

      let travelled = false;
      const boxTo = (event: PointerEvent): ScreenBox => ({
        left: Math.min(down.clientX, event.clientX),
        top: Math.min(down.clientY, event.clientY),
        right: Math.max(down.clientX, event.clientX),
        bottom: Math.max(down.clientY, event.clientY),
      });
      const track = (event: PointerEvent) => {
        travelled ||= Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > CLICK_SLOP_PX;
      };

      const onMove = (event: PointerEvent) => {
        if (event.pointerId !== down.pointerId) return;
        track(event);
        if (!travelled) return;
        const origin = host.getBoundingClientRect();
        const box = boxTo(event);
        setDrawn({
          left: box.left - origin.left,
          top: box.top - origin.top,
          right: box.right - origin.left,
          bottom: box.bottom - origin.top,
        });
      };
      const onUp = (event: PointerEvent) => {
        if (event.pointerId !== down.pointerId) return;
        track(event);
        end();
        if (travelled) latest.current.onBox(boxTo(event), event.shiftKey);
        else latest.current.onClick();
      };
      const end = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", end);
        setDrawn(null);
        release = null;
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", end);
      release = end;
    };

    host.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      host.removeEventListener("pointerdown", onPointerDown, true);
      release?.();
    };
  }, [hostRef]);

  return drawn;
}
