"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { type PanelEdge, maximisedRect, movePanel, resizePanel, wholeRect } from "./panel-geometry.ts";
import { readSavedPanels, savePanels } from "./panel-memory.ts";
import {
  allPanels,
  bringPanelToFront,
  movePanelTo,
  panelState,
  panelsVersion,
  resizePanelTo,
  restorePanels,
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

/** How long the panels stay still before their arrangement is saved, ms: a drag is saved once, at its end. */
const SAVE_DELAY_MS = 250;

/**
 * Bring back the panels' arrangement this browser kept, before the first
 * paint, and keep it as it changes. The layer's resize watch then pulls any
 * panel saved in a larger window back in reach.
 */
export function useRememberedPanels() {
  useLayoutEffect(() => {
    const saved = readSavedPanels();
    if (saved.size) restorePanels(saved);
    let timer: number | undefined;
    const stop = subscribePanels(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => savePanels(allPanels()), SAVE_DELAY_MS);
    });
    return () => {
      stop();
      // leaving mid-wait still saves
      if (timer !== undefined) {
        window.clearTimeout(timer);
        savePanels(allPanels());
      }
    };
  }, []);
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
 * Its bar also minimises it (it leaves the table, and waits in the
 * minimised column until restored: minimised-column.tsx) and maximises it
 * (filling the workspace below the toolbars), each undoing the other; a
 * maximised panel doesn't move. A panel that closes, with `opensRestored`,
 * opens again on the table even if it was minimised when it closed.
 *
 * Its right edge, bottom edge and corner resize it (`resize` props, for
 * PanelResize), except while minimised or maximised. Until then a moved
 * panel's height follows its content, capped at the workspace's bottom; once
 * resized it keeps its size.
 */
export function usePanel(
  id: string,
  {
    fitWidth = false,
    keepHeight = false,
    opensRestored = false,
  }: { fitWidth?: boolean; keepHeight?: boolean; opensRestored?: boolean } = {},
) {
  const moves = usePanelsMove();
  useSyncExternalStore(subscribePanels, panelsVersion, panelsVersion);
  const ref = useRef<HTMLElement | null>(null);
  const teardown = useRef<() => void>(() => {});
  const setRef = useCallback((element: HTMLElement | null) => {
    ref.current = element;
  }, []);
  useEffect(() => () => teardown.current(), []);
  // opened from its button, a closing panel shows, rather than waiting hidden in the column
  useLayoutEffect(() => {
    if (opensRestored && panelState(id).minimised) setPanelView(id, "restored");
  }, [id, opensRestored]);

  // one gesture for both: dragging the bar moves the panel, an edge or the corner resizes it
  const startGesture = useCallback(
    (event: ReactPointerEvent<HTMLElement>, gesture: "move" | PanelEdge) => {
      const element = ref.current;
      const layer = element?.closest<HTMLElement>(`.${PANEL_LAYER_CLASS}`);
      if (event.button !== 0 || !event.isPrimary || !element || !layer) return;
      const { maximised, minimised } = panelState(id);
      if (maximised || (gesture !== "move" && minimised)) return;
      // the bar's own buttons keep their press
      if ((event.target as Element).closest("button")) return;
      event.preventDefault();
      event.stopPropagation();
      const origin = layer.getBoundingClientRect();
      const measure = (panel: Element) => {
        const box = panel.getBoundingClientRect();
        return wholeRect({ x: box.left - origin.left, y: box.top - origin.top, w: box.width, h: box.height });
      };
      // it snaps and resizes from its size as drawn (a content-sized or
      // minimised panel's stored height isn't that); a move keeps the stored
      // height to restore to
      const drawn = measure(element);
      const kept = panelState(id).rect ?? drawn;
      const start = { ...kept, w: drawn.w, h: drawn.h };
      // the others on the table, measured once: none of them moves while this one does
      const others = Array.from(layer.querySelectorAll(".builderPanel:not(.is-minimised)"))
        .filter((panel) => panel !== element)
        .map(measure);
      const startX = event.clientX;
      const startY = event.clientY;
      const pointerId = event.pointerId;
      document.body.dataset.panelGesture = gesture;

      const onMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        const bounds = { width: layer.clientWidth, height: layer.clientHeight };
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (gesture === "move") {
          const moved = movePanel(start, dx, dy, bounds, others);
          movePanelTo(id, { ...moved, w: kept.w, h: kept.h });
        } else {
          resizePanelTo(id, resizePanel(start, gesture, dx, dy, bounds));
        }
      };
      const onEnd = (endEvent: PointerEvent) => {
        if (endEvent.pointerId === pointerId) teardown.current();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
      teardown.current = () => {
        delete document.body.dataset.panelGesture;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        teardown.current = () => {};
      };
    },
    [id],
  );

  // a minimised panel is hidden, so it keeps its place as it is: moved, or where the CSS puts it
  const toggleMinimised = useCallback(() => {
    const { minimised } = panelState(id);
    setPanelView(id, minimised ? "restored" : "minimised");
  }, [id]);
  const toggleMaximised = useCallback(() => {
    const { maximised } = panelState(id);
    setPanelView(id, maximised ? "restored" : "maximised");
    if (!maximised) bringPanelToFront(id);
  }, [id]);

  const state = panelState(id);
  const bounds = workspaceBounds();
  const maximised = moves && Boolean(state.maximised) && bounds !== null;
  const minimised = moves && Boolean(state.minimised);
  const sized = moves && Boolean(state.sized) && !maximised;
  const rect = !moves ? undefined : maximised ? maximisedRect(bounds!) : state.rect;
  // a panel whose box is set: maximised, resized by hand, or stretched by the CSS
  const fixed = maximised || (!minimised && (sized || keepHeight));
  const style: CSSProperties | undefined = !moves
    ? undefined
    : ({
        zIndex: state.z,
        ...(rect && {
          position: "absolute",
          left: rect.x,
          top: rect.y,
          right: "auto",
          bottom: "auto",
          width: fitWidth && !maximised && !sized ? undefined : rect.w,
          height: fixed ? rect.h : undefined,
          maxHeight: fixed ? "none" : undefined,
          // content-sized, it may grow no further than the workspace's bottom (CSS takes the smaller of this and its own cap)
          "--panel-room": !fixed && bounds ? `${Math.max(0, Math.floor(bounds.height - rect.y))}px` : undefined,
        }),
      } as CSSProperties);

  return {
    moves,
    minimised,
    maximised,
    /** the panel's own class, for its look while minimised, maximised or resized */
    className: !moves
      ? ""
      : ` builderPanel${minimised ? " is-minimised" : ""}${maximised ? " is-maximised" : ""}${sized ? " is-sized" : ""}`,
    frame: {
      ref: setRef,
      style,
      "data-panel": id,
      onPointerDownCapture: moves ? () => bringPanelToFront(id) : undefined,
    },
    bar: {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => startGesture(event, "move"),
      minimised,
      maximised,
      onToggleMinimised: toggleMinimised,
      onToggleMaximised: toggleMaximised,
    },
    /** none while it can't be resized: minimised, maximised, or where panels stay put */
    resize:
      moves && !minimised && !maximised
        ? { onPointerDown: (event: ReactPointerEvent<HTMLElement>, edge: PanelEdge) => startGesture(event, edge) }
        : null,
  };
}
