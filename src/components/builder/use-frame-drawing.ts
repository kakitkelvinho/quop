"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import { CLICK_SLOP_PX } from "@/components/builder/builder-canvas";
import type { Corner } from "@/components/builder/types";

/** A second click this soon after the first, in the same place, makes a double-click. */
const DOUBLE_CLICK_MS = 500;

type Press = { x: number; y: number; at: number };

/**
 * Left presses on the canvas while a frame is drawn, as table points. A
 * press that doesn't travel is a click, and a second click soon after in the
 * same place is the end of a double-click. While `rectangles` is on, a press
 * that travels drags out a rectangle instead: the press is then taken in the
 * capture phase on the canvas host and stopped there, as in useBoxSelect, so
 * the camera doesn't pan. Once there are corners, a press is left alone to
 * pan the view. Either way, `onClick` gets the table point under the pointer,
 * whatever part or frame is drawn there.
 */
export function useFrameDrawing(
  hostRef: RefObject<HTMLElement | null>,
  options: {
    active: boolean;
    rectangles: boolean;
    tableAt: (clientX: number, clientY: number) => Corner | null;
    /** the pointer over the table, or null when it leaves the canvas */
    onHover: (point: Corner | null, event: PointerEvent) => void;
    /** true when the click finished the drawing */
    onClick: (point: Corner, event: PointerEvent, second: boolean) => boolean;
    onRectangle: (from: Corner, to: Corner, event: PointerEvent, done: boolean) => void;
  },
): void {
  // read at event time, not dependencies: re-binding mid-press would drop it
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let lastClick: Press | null = null;
    // the click that finished a drawing, whose double-click's second press is swallowed
    let finishing: Press | null = null;
    let release: (() => void) | null = null;

    const soonAfter = (press: Press | null, event: PointerEvent) =>
      press !== null &&
      event.timeStamp - press.at <= DOUBLE_CLICK_MS &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) <= CLICK_SLOP_PX;

    const onPointerDown = (down: PointerEvent) => {
      if (down.button !== 0 || !down.isPrimary) return;
      const { active, rectangles, tableAt } = latest.current;
      if (!active) {
        // the rest of the double-click whose first click closed the outline would deselect the new frame
        if (soonAfter(finishing, down)) {
          down.stopPropagation();
          down.preventDefault();
        }
        finishing = null;
        return;
      }
      const from = tableAt(down.clientX, down.clientY);
      if (!from) return;
      if (rectangles) {
        down.stopPropagation();
        // no text selection while a rectangle is dragged out
        down.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }
      release?.();
      const second = soonAfter(lastClick, down);
      let travelled = false;

      const onMove = (event: PointerEvent) => {
        if (event.pointerId !== down.pointerId) return;
        travelled ||= Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > CLICK_SLOP_PX;
        const to = tableAt(event.clientX, event.clientY);
        if (travelled && rectangles && to) latest.current.onRectangle(from, to, event, false);
      };
      const onUp = (event: PointerEvent) => {
        if (event.pointerId !== down.pointerId) return;
        end();
        const to = tableAt(event.clientX, event.clientY) ?? from;
        if (travelled) {
          lastClick = null;
          if (rectangles) latest.current.onRectangle(from, to, event, true);
          return;
        }
        const press = { x: event.clientX, y: event.clientY, at: event.timeStamp };
        lastClick = second ? null : press;
        if (latest.current.onClick(to, event, second)) finishing = press;
      };
      const end = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", end);
        release = null;
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", end);
      release = end;
    };

    const onHover = (event: PointerEvent) => {
      if (!latest.current.active) return;
      latest.current.onHover(latest.current.tableAt(event.clientX, event.clientY), event);
    };
    const onLeave = (event: PointerEvent) => {
      if (latest.current.active) latest.current.onHover(null, event);
    };

    host.addEventListener("pointerdown", onPointerDown, true);
    host.addEventListener("pointermove", onHover);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointerdown", onPointerDown, true);
      host.removeEventListener("pointermove", onHover);
      host.removeEventListener("pointerleave", onLeave);
      release?.();
    };
  }, [hostRef]);
}
