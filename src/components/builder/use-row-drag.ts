"use client";

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Reorder the rows of a list by dragging them whole, like a queue: press
 * anywhere on a row, drag, and the rows around it step aside to open a gap
 * where it will land. Alt+↑ / Alt+↓ on a focused row moves it one place.
 *
 * The hook owns the gesture and the look of it, not the edit: `onMove` gets
 * the row's index and the index it should end up at, and says whether the
 * edit was accepted. A refused drop sends the row back home.
 *
 *   const { listClass, rowProps } = useRowDrag({ listRef, count, onMove });
 *   <ol ref={listRef} className={listClass}>
 *     <li {...rowProps(index)}>...</li>
 *
 * Rows are the list element's children. Parts of a row that should keep their
 * own press (its buttons) carry `data-no-drag`; inputs always do. A press that
 * never moves is left alone, so a row's select button still clicks.
 *
 * A mouse or pen starts the drag after a few pixels. A finger must rest on the
 * row for a moment first, so a swipe still scrolls the list; once the row is
 * picked up the page stops scrolling until it is dropped.
 */

const MOUSE_SLOP_PX = 4;
const TOUCH_SLOP_PX = 8;
const TOUCH_HOLD_MS = 250;
const IGNORED = "[data-no-drag], input, select, textarea, a[href]";

export type HeldRow = {
  from: number;
  /** the index the row would land at */
  to: number;
  /** how far the pointer has pulled the row from where it started */
  dy: number;
  /** how far each row it passes steps aside: the row's height plus the gap */
  step: number;
  /** false when `canMove` forbids the drop */
  allowed: boolean;
};

type Press = {
  pointerId: number;
  touch: boolean;
  from: number;
  startY: number;
  startX: number;
  /** each row's rect when the press began, before any row moved */
  rects: DOMRect[];
  step: number;
  active: boolean;
  timer: number | undefined;
  teardown: () => void;
};

export type RowDragOptions = {
  listRef: RefObject<HTMLElement | null>;
  count: number;
  /** whether dropping row `from` at index `to` is allowed; only shapes the look of the drag */
  canMove?: (from: number, to: number) => boolean;
  /** make the move; true when it was accepted */
  onMove: (from: number, to: number, how: "drag" | "keyboard") => boolean;
};

export function useRowDrag({ listRef, count, canMove, onMove }: RowDragOptions) {
  const [held, setHeld] = useState<HeldRow | null>(null);
  const [returning, setReturning] = useState<number | null>(null);
  const heldRef = useRef<HeldRow | null>(null);
  const press = useRef<Press | null>(null);

  // the window listeners below outlive a render, so they read the latest props from here
  const latest = useRef({ count, canMove, onMove });
  useEffect(() => {
    latest.current = { count, canMove, onMove };
  });

  const show = useCallback((next: HeldRow | null) => {
    heldRef.current = next;
    setHeld(next);
  }, []);

  useEffect(() => () => press.current?.teardown(), []);

  const begin = (event: ReactPointerEvent<HTMLElement>, from: number) => {
    if (event.button !== 0 || !event.isPrimary || press.current) return;
    if ((event.target as Element).closest(IGNORED)) return;
    const rows = Array.from(listRef.current?.children ?? []);
    const rects = rows.map((row) => row.getBoundingClientRect());
    if (rects.length < 2 || !rects[from]) return;
    const gap =
      from > 0 ? rects[from].top - rects[from - 1].bottom : rects[1].top - rects[0].bottom;
    const current: Press = {
      pointerId: event.pointerId,
      touch: event.pointerType === "touch",
      from,
      startY: event.clientY,
      startX: event.clientX,
      rects,
      step: rects[from].height + gap,
      active: false,
      timer: undefined,
      teardown: () => {},
    };
    press.current = current;
    setReturning(null);

    // Only a held finger blocks scrolling, and only once the row is up.
    const blockScroll = (touchEvent: TouchEvent) => {
      if (current.active && touchEvent.cancelable) touchEvent.preventDefault();
    };
    const noMenu = (menuEvent: Event) => menuEvent.preventDefault();

    // The click that ends a drag must not also press the row's select button.
    // It follows the pointerup at once, so the guard only lives that long.
    const swallowClick = (clickEvent: MouseEvent) => {
      clickEvent.stopPropagation();
      clickEvent.preventDefault();
    };

    const stop = (dropped: boolean) => {
      current.teardown();
      press.current = null;
      if (!current.active) return;
      window.setTimeout(() => window.removeEventListener("click", swallowClick, true), 0);
      const drop = heldRef.current;
      show(null);
      if (!dropped || !drop || drop.to === drop.from) return;
      if (!latest.current.onMove(drop.from, drop.to, "drag")) setReturning(drop.from);
    };

    const pickUp = () => {
      window.clearTimeout(current.timer);
      current.active = true;
      show({ from, to: from, dy: 0, step: current.step, allowed: true });
      if (current.touch) navigator.vibrate?.(8);
      window.addEventListener("click", swallowClick, true);
    };

    const onMovePointer = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== current.pointerId) return;
      const dx = moveEvent.clientX - current.startX;
      const rawDy = moveEvent.clientY - current.startY;
      if (!current.active) {
        const slop = current.touch ? TOUCH_SLOP_PX : MOUSE_SLOP_PX;
        if (Math.hypot(dx, rawDy) < slop) return;
        // a finger that moves before it has rested is scrolling
        if (current.touch) return stop(false);
        pickUp();
      }
      // keep the row between the first row's top and the last row's bottom
      const mine = current.rects[from];
      const first = current.rects[0];
      const last = current.rects[current.rects.length - 1];
      const dy = Math.min(Math.max(rawDy, first.top - mine.top), last.bottom - mine.bottom);
      // A row is passed once the lifted row's leading edge crosses its middle.
      const top = mine.top + dy;
      const bottom = mine.bottom + dy;
      const to = current.rects.filter((rect, at) => {
        const middle = rect.top + rect.height / 2;
        return at < from ? middle < top : at > from && middle < bottom;
      }).length;
      const allowed = to === from || (latest.current.canMove?.(from, to) ?? true);
      show({ from, to, dy, step: current.step, allowed });
    };
    const onEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId === current.pointerId) stop(endEvent.type === "pointerup");
    };
    // Esc cancels the drag; the scene's Esc chain would otherwise deselect the beam too.
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape" || !current.active) return;
      keyEvent.stopPropagation();
      stop(false);
    };

    window.addEventListener("pointermove", onMovePointer);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("touchmove", blockScroll, { passive: false });
    window.addEventListener("contextmenu", noMenu);
    current.teardown = () => {
      window.clearTimeout(current.timer);
      window.removeEventListener("pointermove", onMovePointer);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("touchmove", blockScroll);
      window.removeEventListener("contextmenu", noMenu);
    };
    if (current.touch) current.timer = window.setTimeout(pickUp, TOUCH_HOLD_MS);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>, from: number) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if ((event.target as Element).closest("input, select, textarea")) return;
    event.preventDefault();
    event.stopPropagation();
    onMove(from, from + (event.key === "ArrowUp" ? -1 : 1), "keyboard");
  };

  const rowProps = (index: number) => {
    const lifted = held?.from === index;
    let shift = 0;
    if (held?.allowed && !lifted) {
      if (held.to > held.from && index > held.from && index <= held.to) shift = -held.step;
      if (held.to < held.from && index >= held.to && index < held.from) shift = held.step;
    }
    const classes = [
      "is-reorderable",
      lifted && "is-dragging",
      lifted && !held.allowed && "is-refused",
      held && !lifted && "is-making-room",
      returning === index && "is-returning",
    ];
    const style: CSSProperties | undefined = lifted
      ? { transform: `translateY(${held.dy}px)` }
      : shift
        ? { transform: `translateY(${shift}px)` }
        : undefined;
    return {
      className: classes.filter(Boolean).join(" "),
      style,
      title: "Drag to reorder, or Alt+↑ / Alt+↓",
      "aria-keyshortcuts": "Alt+ArrowUp Alt+ArrowDown",
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => begin(event, index),
      onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => onKeyDown(event, index),
    };
  };

  return { held, listClass: held ? "is-reordering" : "", rowProps };
}
