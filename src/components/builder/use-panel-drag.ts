"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { maximisedRect, movePanel, wholeRect } from "./panel-geometry.ts";
import {
  bringPanelToFront,
  movePanelTo,
  panelState,
  panelsVersion,
  setPanelView,
  subscribePanels,
  workspaceBounds,
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
 *
 * Its bar also minimises it (collapsed to the bar, in place, at its width)
 * and maximises it (filling the workspace below the toolbars), each undoing
 * the other; a maximised panel doesn't move.
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
      if (panelState(id).maximised) return;
      // the bar's own buttons keep their press
      if ((event.target as Element).closest("button")) return;
      event.preventDefault();
      const origin = layer.getBoundingClientRect();
      const measure = (panel: Element) => {
        const box = panel.getBoundingClientRect();
        return wholeRect({ x: box.left - origin.left, y: box.top - origin.top, w: box.width, h: box.height });
      };
      // it snaps by its height as drawn (a content-sized or minimised panel's
      // stored height isn't that), but keeps the stored one to restore to
      const drawn = measure(element);
      const kept = panelState(id).rect ?? drawn;
      const start = { ...kept, h: drawn.h };
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
        const moved = movePanel(start, moveEvent.clientX - startX, moveEvent.clientY - startY, bounds, others);
        movePanelTo(id, { ...moved, h: kept.h });
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

  // minimising pins the panel where it is drawn, so collapsing keeps its place and width
  const pinHere = useCallback(() => {
    const element = ref.current;
    const layer = element?.closest<HTMLElement>(`.${PANEL_LAYER_CLASS}`);
    if (!element || !layer || panelState(id).rect) return;
    const box = element.getBoundingClientRect();
    const origin = layer.getBoundingClientRect();
    movePanelTo(id, wholeRect({ x: box.left - origin.left, y: box.top - origin.top, w: box.width, h: box.height }));
  }, [id]);
  const toggleMinimised = useCallback(() => {
    const { minimised } = panelState(id);
    if (!minimised) pinHere();
    setPanelView(id, minimised ? "restored" : "minimised");
  }, [id, pinHere]);
  const toggleMaximised = useCallback(() => {
    const { maximised } = panelState(id);
    setPanelView(id, maximised ? "restored" : "maximised");
    if (!maximised) bringPanelToFront(id);
  }, [id]);

  const state = panelState(id);
  const bounds = workspaceBounds();
  const maximised = moves && Boolean(state.maximised) && bounds !== null;
  const minimised = moves && Boolean(state.minimised);
  const rect = !moves ? undefined : maximised ? maximisedRect(bounds!) : state.rect;
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
          // a minimised list keeps the width it had; its rows no longer set it
          width: fitWidth && !maximised && !minimised ? undefined : rect.w,
          height: maximised || (keepHeight && !minimised) ? rect.h : undefined,
        }),
      };

  return {
    moves,
    minimised,
    maximised,
    /** the panel's own class, for its look while minimised or maximised */
    className: !moves ? "" : ` builderPanel${minimised ? " is-minimised" : ""}${maximised ? " is-maximised" : ""}`,
    frame: {
      ref: setRef,
      style,
      onPointerDownCapture: moves ? () => bringPanelToFront(id) : undefined,
    },
    bar: {
      onPointerDown: onBarPointerDown,
      minimised,
      maximised,
      onToggleMinimised: toggleMinimised,
      onToggleMaximised: toggleMaximised,
    },
  };
}
