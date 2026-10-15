"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { movePanel, wholeRect } from "./panel-geometry.ts";
import {
  bringPanelToFront,
  movePanelTo,
  panelState,
  panelsVersion,
  subscribePanels,
} from "./panel-store.ts";

/** Where panels stay put, as on small and touch screens; the CSS's narrow layout starts here too. */
const PINNED_QUERY = "(max-width: 900px), (pointer: coarse)";

function subscribePinned(listener: () => void) {
  const query = window.matchMedia(PINNED_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/**
 * Whether the Tabletop's panels have title bars and move. Off under 900 px
 * wide and on a coarse pointer, where they behave as they always have; off
 * on the server too, so the first paint is today's.
 */
export function usePanelsMove(): boolean {
  return useSyncExternalStore(
    subscribePinned,
    () => !window.matchMedia(PINNED_QUERY).matches,
    () => false,
  );
}

/** The layer every panel sits in; its box is the workspace's. */
export const PANEL_LAYER_CLASS = "builderPanels";

/**
 * One panel's frame: props for its root (the island) and for its title bar.
 * Pressing anywhere on it brings it to the front; dragging the bar with the
 * left button moves it. A panel first moved is measured where today's CSS
 * put it and kept there in whole pixels, at its own width (or its content's,
 * with `fitWidth`) and, with `keepHeight` for a panel the CSS stretches
 * between the workspace's top and bottom, its height.
 */
export function usePanel(
  id: string,
  { fitWidth = false, keepHeight = false }: { fitWidth?: boolean; keepHeight?: boolean } = {},
) {
  const moves = usePanelsMove();
  useSyncExternalStore(subscribePanels, panelsVersion, panelsVersion);
  const ref = useRef<HTMLElement | null>(null);
  const teardown = useRef<() => void>(() => {});
  const setRef = useCallback((element: HTMLElement | null) => {
    ref.current = element;
  }, []);
  useEffect(() => () => teardown.current(), []);

  const onBarPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const element = ref.current;
      const layer = element?.closest<HTMLElement>(`.${PANEL_LAYER_CLASS}`);
      if (event.button !== 0 || !event.isPrimary || !element || !layer) return;
      // the bar's own buttons keep their press
      if ((event.target as Element).closest("button")) return;
      event.preventDefault();
      const origin = layer.getBoundingClientRect();
      const measure = (panel: Element) => {
        const box = panel.getBoundingClientRect();
        return wholeRect({ x: box.left - origin.left, y: box.top - origin.top, w: box.width, h: box.height });
      };
      // its height as drawn, which a content-sized panel's stored rect doesn't follow
      const drawn = measure(element);
      const start = { ...(panelState(id).rect ?? drawn), h: drawn.h };
      // the others, measured once: none of them moves while this one does
      const others = Array.from(layer.querySelectorAll(".builderPanel"))
        .filter((panel) => panel !== element)
        .map(measure);
      const startX = event.clientX;
      const startY = event.clientY;
      const pointerId = event.pointerId;
      document.body.classList.add("is-movingPanel");

      const onMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        const bounds = { width: layer.clientWidth, height: layer.clientHeight };
        movePanelTo(id, movePanel(start, moveEvent.clientX - startX, moveEvent.clientY - startY, bounds, others));
      };
      const onEnd = (endEvent: PointerEvent) => {
        if (endEvent.pointerId === pointerId) teardown.current();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
      teardown.current = () => {
        document.body.classList.remove("is-movingPanel");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        teardown.current = () => {};
      };
    },
    [id],
  );

  const state = panelState(id);
  const rect = moves ? state.rect : undefined;
  const style: CSSProperties | undefined = !moves
    ? undefined
    : {
        zIndex: state.z,
        ...(rect && {
          position: "absolute",
          left: rect.x,
          top: rect.y,
          right: "auto",
          bottom: "auto",
          width: fitWidth ? undefined : rect.w,
          height: keepHeight ? rect.h : undefined,
        }),
      };

  return {
    moves,
    frame: {
      ref: setRef,
      style,
      onPointerDownCapture: moves ? () => bringPanelToFront(id) : undefined,
    },
    bar: { onPointerDown: onBarPointerDown },
  };
}
