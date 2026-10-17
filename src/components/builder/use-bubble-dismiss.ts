"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
 * Close a toolbar bubble on a pointer-down outside it, or on Esc. A part of it
 * drawn elsewhere (in a portal) counts as inside when its element is in `also`.
 */
export function useBubbleDismiss<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  close: () => void,
  also?: RefObject<HTMLElement | null>,
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !also?.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, also]);
  return ref;
}
