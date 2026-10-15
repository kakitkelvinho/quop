"use client";

// PROTOTYPE, throwaway: wayfinder ticket "How should a panel's title bar and
// snapping look and feel?" (#224), on map #222. Three variants of panel chrome
// and snapping on the real Tabletop, switched with ?panels=A|B|C (dev only):
//   A  Title bar  - a classic bar on top, buttons right, gentle live snap
//   B  Edge grip  - no bar: a grip rail down the left edge, buttons on hover,
//                   strong snap with guide lines, minimises to a pill
//   C  Folder tab - a tab standing on the panel's top edge, snap shown as a
//                   ghost and taken on release, minimises to the tab
// Not production code: no tests, the geometry lives here, not in a module.

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type Variant = "A" | "B" | "C";
const VARIANTS: Variant[] = ["A", "B", "C"];
/** what the switcher cycles: A against C, as asked; ?panels=B still works */
const CYCLE: Variant[] = ["A", "C"];
const NAMES: Record<Variant, string> = { A: "Title bar", B: "Edge grip", C: "Folder tab" };
const SNAP_PX: Record<Variant, number> = { A: 10, B: 24, C: 16 };
const GAP_PX = 8;
const INSET_PX = 12;
/** the toolbars' row: a maximised panel starts below it */
const TOOLBAR_ROW_PX = 64;
const MIN_W = 180;
const MIN_H = 90;
/** how much of a panel must stay on screen sideways, so it can be grabbed */
const KEEP_PX = 90;

type Rect = { x: number; y: number; w: number; h: number | null };
type PanelState = { rect: Rect; min: boolean; max: boolean; z: number };
type Guide = { axis: "x" | "y"; at: number };

// ---- store ------------------------------------------------------------------

const store = {
  variant: null as Variant | null,
  panels: new Map<string, PanelState>(),
  ghost: null as { id: string; rect: Rect } | null,
  guides: [] as Guide[],
  top: 20,
  version: 0,
};
const listeners = new Set<() => void>();
function emit() {
  store.version += 1;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const useStore = () => useSyncExternalStore(subscribe, () => store.version, () => 0);

/** Whole pixels: a panel at x = 14.4 smears or loses its 1 px border at some window sizes. */
function whole(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.round(rect.w),
    h: rect.h === null ? null : Math.round(rect.h),
  };
}

function setPanel(id: string, patch: Partial<PanelState>) {
  const current = store.panels.get(id);
  if (!current && !patch.rect) return;
  if (patch.rect) patch = { ...patch, rect: whole(patch.rect) };
  store.panels.set(id, { min: false, max: false, z: ++store.top, ...current, ...patch } as PanelState);
  emit();
}
function bringToFront(id: string) {
  const current = store.panels.get(id);
  if (current && current.z !== store.top) setPanel(id, { z: ++store.top });
}
export function resetPanels() {
  store.panels.clear();
  store.ghost = null;
  store.guides = [];
  emit();
}

function readVariant(): Variant | null {
  if (process.env.NODE_ENV === "production") return null;
  const value = new URLSearchParams(window.location.search).get("panels")?.toUpperCase();
  return VARIANTS.includes(value as Variant) ? (value as Variant) : null;
}
function setVariant(variant: Variant) {
  const url = new URL(window.location.href);
  url.searchParams.set("panels", variant);
  window.history.replaceState(null, "", url);
  store.variant = variant;
  resetPanels();
}

function useVariant(): Variant | null {
  useStore();
  const [small, setSmall] = useState(false);
  useEffect(() => {
    store.variant = readVariant();
    const query = window.matchMedia("(max-width: 900px), (pointer: coarse)");
    const update = () => setSmall(query.matches);
    update();
    query.addEventListener("change", update);
    emit();
    return () => query.removeEventListener("change", update);
  }, []);
  return small ? null : store.variant;
}

// ---- geometry ---------------------------------------------------------------

function bounds() {
  const workspace = document.querySelector(".builderWorkspace")?.getBoundingClientRect();
  const box = workspace ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  return {
    left: box.left + INSET_PX,
    top: box.top + INSET_PX,
    right: box.right - INSET_PX,
    bottom: box.bottom - INSET_PX,
  };
}

function heightOf(id: string, rect: Rect): number {
  if (rect.h !== null) return rect.h;
  return document.querySelector(`[data-proto-panel="${id}"]`)?.getBoundingClientRect().height ?? 200;
}

/** Snap a moving panel's edges to the workspace's and to other panels' edges. */
function snap(id: string, rect: Rect, threshold: number): { rect: Rect; guides: Guide[] } {
  const b = bounds();
  const h = heightOf(id, rect);
  const xs: number[] = [b.left, b.right - rect.w];
  const ys: number[] = [b.top, b.bottom - h];
  for (const [other, state] of store.panels) {
    if (other === id) continue;
    const o = state.rect;
    const oh = heightOf(other, o);
    xs.push(o.x + o.w + GAP_PX, o.x - rect.w - GAP_PX, o.x, o.x + o.w - rect.w);
    ys.push(o.y + oh + GAP_PX, o.y - h - GAP_PX, o.y, o.y + oh - h);
  }
  const nearest = (value: number, options: number[]) => {
    let best: number | null = null;
    for (const option of options) {
      if (Math.abs(option - value) <= threshold && (best === null || Math.abs(option - value) < Math.abs(best - value))) best = option;
    }
    return best;
  };
  const x = nearest(rect.x, xs);
  const y = nearest(rect.y, ys);
  const guides: Guide[] = [];
  if (x !== null) guides.push({ axis: "x", at: x });
  if (y !== null) guides.push({ axis: "y", at: y });
  return { rect: { ...rect, x: x ?? rect.x, y: y ?? rect.y }, guides };
}

/** Keep the grab strip inside the workspace, whatever the window does. */
function clamp(rect: Rect, tabRoom: number): Rect {
  const b = bounds();
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, b.left - rect.w + KEEP_PX), b.right - KEEP_PX),
    y: Math.min(Math.max(rect.y, b.top + tabRoom), b.bottom - 32),
  };
}

// ---- the panel --------------------------------------------------------------

export function ProtoPanel({
  id,
  title,
  subtitle,
  onClose,
  children,
}: {
  id: string;
  title: string;
  /** shown on a minimised panel, e.g. what the Inspector has selected */
  subtitle?: string;
  /** Brief and JSON close; the rest only minimise */
  onClose?: () => void;
  children: ReactNode;
}) {
  const variant = useVariant();
  const probe = useRef<HTMLDivElement>(null);
  const state = store.panels.get(id);

  // first sight: measure where today's CSS puts it, then take over from there
  useLayoutEffect(() => {
    if (!variant || state) return;
    const element = probe.current?.firstElementChild;
    if (!element) return;
    const box = element.getBoundingClientRect();
    if (box.width === 0) return;
    setPanel(id, { rect: { x: box.left, y: box.top, w: box.width, h: null } });
  });

  const drag = useCallback(
    (event: React.PointerEvent, mode: "move" | "e" | "s" | "se") => {
      if (event.button !== 0 || !variant) return;
      const current = store.panels.get(id);
      if (!current || current.max) return;
      event.preventDefault();
      event.stopPropagation();
      bringToFront(id);
      const start = { px: event.clientX, py: event.clientY, rect: current.rect, h: heightOf(id, current.rect) };
      const tabRoom = variant === "C" ? 26 : 0;
      const move = (e: PointerEvent) => {
        const dx = e.clientX - start.px;
        const dy = e.clientY - start.py;
        if (mode === "move") {
          const raw = clamp({ ...start.rect, x: start.rect.x + dx, y: start.rect.y + dy }, tabRoom);
          const snapped = snap(id, raw, SNAP_PX[variant]);
          if (variant === "C") {
            store.ghost = snapped.guides.length ? { id, rect: clamp(snapped.rect, tabRoom) } : null;
            setPanel(id, { rect: raw });
          } else {
            store.guides = variant === "B" ? snapped.guides : [];
            setPanel(id, { rect: clamp(snapped.rect, tabRoom) });
          }
        } else {
          setPanel(id, {
            rect: {
              ...start.rect,
              w: mode === "s" ? start.rect.w : Math.max(MIN_W, start.rect.w + dx),
              h: mode === "e" ? start.rect.h : Math.max(MIN_H, start.h + dy),
            },
          });
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (store.ghost?.id === id) setPanel(id, { rect: store.ghost.rect });
        store.ghost = null;
        store.guides = [];
        emit();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [id, variant],
  );

  if (!variant) return <>{children}</>;
  if (!state) {
    return (
      <div ref={probe} style={{ display: "contents" }}>
        {children}
      </div>
    );
  }

  const b = bounds();
  const rect = state.max
    ? whole({ x: b.left, y: b.top + TOOLBAR_ROW_PX - INSET_PX, w: b.right - b.left, h: b.bottom - b.top - TOOLBAR_ROW_PX + INSET_PX })
    : state.rect;
  const toggleMin = () => setPanel(id, { min: !state.min, max: false });
  const toggleMax = () => setPanel(id, { max: !state.max, min: false });
  const label = state.min && subtitle ? `${title}: ${subtitle}` : title;

  const buttons = (
    <span className="protoPanel__buttons">
      <button type="button" aria-label={state.min ? `Restore ${title}` : `Minimise ${title}`} title={state.min ? "Restore" : "Minimise"} onClick={toggleMin}>
        {state.min ? "▢" : "–"}
      </button>
      <button type="button" aria-label={state.max ? `Restore ${title}` : `Maximise ${title}`} title={state.max ? "Restore" : "Maximise"} onClick={toggleMax}>
        {state.max ? "❐" : "□"}
      </button>
      {onClose ? (
        <button type="button" aria-label={`Close ${title}`} title="Close" onClick={onClose}>
          ×
        </button>
      ) : null}
    </span>
  );

  return (
    <div
      data-proto-panel={id}
      className={`protoPanel protoPanel--${variant}${state.min ? " is-min" : ""}${state.max ? " is-max" : ""}`}
      style={{
        left: rect.x,
        top: rect.y,
        width: variant === "B" && state.min ? undefined : rect.w,
        height: state.min ? undefined : (rect.h ?? undefined),
        maxHeight: state.min ? undefined : Math.floor(b.bottom - rect.y),
        zIndex: state.z,
      }}
      onPointerDownCapture={() => bringToFront(id)}
    >
      {variant === "A" ? (
        <div className="protoPanel__bar" onPointerDown={(e) => drag(e, "move")} onDoubleClick={toggleMin}>
          <span className="protoPanel__grip" aria-hidden>⋮⋮</span>
          <span className="protoPanel__title">{label}</span>
          {buttons}
        </div>
      ) : variant === "B" ? (
        <>
          <div className="protoPanel__rail" onPointerDown={(e) => drag(e, "move")} onDoubleClick={toggleMin} title={`Drag ${title}`}>
            <span aria-hidden>⠿</span>
            {state.min ? <span className="protoPanel__title">{label}</span> : null}
          </div>
          {buttons}
        </>
      ) : (
        <div className="protoPanel__tab" onPointerDown={(e) => drag(e, "move")} onDoubleClick={toggleMin}>
          <span className="protoPanel__title">{label}</span>
          {buttons}
        </div>
      )}
      <div className="protoPanel__body" hidden={state.min}>
        {children}
      </div>
      {!state.min && !state.max ? (
        <>
          <span className="protoPanel__resize protoPanel__resize--e" onPointerDown={(e) => drag(e, "e")} />
          <span className="protoPanel__resize protoPanel__resize--s" onPointerDown={(e) => drag(e, "s")} />
          <span className="protoPanel__resize protoPanel__resize--se" onPointerDown={(e) => drag(e, "se")} />
        </>
      ) : null}
    </div>
  );
}

// ---- overlays and the switcher -----------------------------------------------

export function PanelsPrototypeBar() {
  const variant = useVariant();

  // panels slide back in when the window shrinks; ⌥0 resets them
  useEffect(() => {
    if (!variant) return;
    const onResize = () => {
      for (const [id, state] of store.panels) {
        store.panels.set(id, { ...state, rect: clamp(state.rect, variant === "C" ? 26 : 0) });
      }
      emit();
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      if (event.altKey && event.code === "Digit0") {
        event.preventDefault();
        resetPanels();
      } else if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        const index = Math.max(0, CYCLE.indexOf(variant)) + (event.key === "ArrowRight" ? 1 : -1);
        setVariant(CYCLE[(index + CYCLE.length) % CYCLE.length]);
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [variant]);

  if (process.env.NODE_ENV === "production" || !variant) return null;
  const step = (by: number) => {
    const index = Math.max(0, CYCLE.indexOf(variant)) + by;
    setVariant(CYCLE[(index + CYCLE.length) % CYCLE.length]);
  };
  const ghost = store.ghost;
  const ghostH = ghost ? heightOf(ghost.id, ghost.rect) : 0;

  return (
    <>
      <style>{PROTOTYPE_CSS}</style>
      {store.guides.map((guide, index) => (
        <span
          key={index}
          className="protoGuide"
          style={guide.axis === "x" ? { left: guide.at, top: 0, bottom: 0, width: 0 } : { top: guide.at, left: 0, right: 0, height: 0 }}
        />
      ))}
      {ghost ? (
        <span className="protoGhost" style={{ left: ghost.rect.x, top: ghost.rect.y, width: ghost.rect.w, height: ghostH }} />
      ) : null}
      <div className="protoBar" role="toolbar" aria-label="Prototype switcher">
        <button type="button" onClick={() => step(-1)} aria-label="Previous variant">‹</button>
        <span>
          <b>{variant}</b> {NAMES[variant]}
        </span>
        <button type="button" onClick={() => step(1)} aria-label="Next variant">›</button>
        <span className="protoBar__sep" />
        <button type="button" onClick={resetPanels} title="Reset panels (⌥0)">
          Reset panels <kbd>⌥0</kbd>
        </button>
      </div>
    </>
  );
}

const PROTOTYPE_CSS = `
/* toolbars always stay above the panels */
.builderWorkspace .builderIsland:not(.protoPanel__body > .builderIsland) { z-index: 9000 !important; }

.protoPanel {
  position: fixed;
  display: flex;
  flex-direction: column;
  min-width: ${MIN_W}px;
}
/* the panel scrolls inside its own border, so a short window never cuts its edge off */
.protoPanel__body { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.protoPanel__body[hidden] { display: none; }
.protoPanel__body > .builderIsland {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  max-height: 100% !important;
  min-height: 0;
  overflow: auto !important;
  margin: 0 !important;
  flex: 0 1 auto;
  animation: none !important;
}
.protoPanel.is-max .protoPanel__body > .builderIsland,
.protoPanel[style*=" height"] .protoPanel__body > .builderIsland,
.protoPanel[style^="height"] .protoPanel__body > .builderIsland { flex: 1 1 auto; }
.protoPanel__title { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.protoPanel__buttons { display: inline-flex; gap: 2px; margin-left: auto; }
.protoPanel__buttons button {
  width: 1.4rem; height: 1.4rem; border: 0; border-radius: 0.35rem;
  background: transparent; color: var(--muted); font-size: 0.85rem; line-height: 1; cursor: pointer;
}
.protoPanel__buttons button:hover { background: var(--accent-soft); color: var(--accent-strong); }
.protoPanel__resize { position: absolute; z-index: 2; }
.protoPanel__resize--e { top: 8px; bottom: 8px; right: -4px; width: 8px; cursor: ew-resize; }
.protoPanel__resize--s { left: 8px; right: 8px; bottom: -4px; height: 8px; cursor: ns-resize; }
.protoPanel__resize--se { right: -5px; bottom: -5px; width: 14px; height: 14px; cursor: nwse-resize; }

/* A: a classic title bar welded to the panel's top */
.protoPanel--A .protoPanel__bar {
  display: flex; align-items: center; gap: 0.4rem; height: 1.9rem; padding: 0 0.3rem 0 0.5rem;
  border: 1px solid var(--border); border-bottom: 0; border-radius: 0.75rem 0.75rem 0 0;
  background: var(--surface-strong, var(--surface)); color: var(--foreground); cursor: grab; user-select: none;
}
.protoPanel--A .protoPanel__grip { color: var(--muted); font-size: 0.7rem; }
.protoPanel--A .protoPanel__body > .builderIsland { border-top-left-radius: 0 !important; border-top-right-radius: 0 !important; }
.protoPanel--A.is-min .protoPanel__bar { border-bottom: 1px solid var(--border); border-radius: 0.75rem; }

/* B: no bar; a grip rail down the left edge, buttons float in on hover */
.protoPanel--B { flex-direction: row; }
.protoPanel--B .protoPanel__rail {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem;
  width: 0.9rem; margin-right: -0.9rem; z-index: 1; color: var(--muted); cursor: grab; user-select: none;
  border-radius: 0.75rem 0 0 0.75rem; font-size: 0.8rem;
}
.protoPanel--B .protoPanel__rail:hover { background: var(--accent-soft); color: var(--accent-strong); }
.protoPanel--B .protoPanel__body > .builderIsland { padding-left: 1.1rem !important; }
.protoPanel--B > .protoPanel__buttons {
  position: absolute; top: -0.7rem; right: 0.6rem; z-index: 3; padding: 2px; border-radius: 999px;
  background: var(--surface-strong, var(--surface)); border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  opacity: 0; transition: opacity 120ms;
}
.protoPanel--B:hover > .protoPanel__buttons, .protoPanel--B:focus-within > .protoPanel__buttons { opacity: 1; }
.protoPanel--B.is-min { min-width: 0; }
.protoPanel--B.is-min .protoPanel__rail {
  flex-direction: row; width: auto; margin: 0; padding: 0.35rem 0.8rem; border-radius: 999px;
  border: 1px solid var(--border); background: var(--surface-strong, var(--surface)); color: var(--foreground);
}
.protoPanel--B.is-min > .protoPanel__buttons { top: -0.8rem; right: -0.6rem; }

/* C: a folder tab standing on the panel's top edge */
.protoPanel--C .protoPanel__tab {
  position: absolute; bottom: 100%; left: 0.9rem; display: flex; align-items: center; gap: 0.35rem;
  height: 1.6rem; max-width: calc(100% - 1.8rem); padding: 0 0.25rem 0 0.7rem;
  border: 1px solid var(--border); border-bottom: 0; border-radius: 0.6rem 0.6rem 0 0;
  background: var(--surface-strong, var(--surface)); color: var(--foreground); cursor: grab; user-select: none;
}
.protoPanel--C.is-min { min-width: 0; }
.protoPanel--C.is-min .protoPanel__tab { position: static; border-bottom: 1px solid var(--border); border-radius: 0.6rem; max-width: none; }

.protoGuide { position: fixed; z-index: 9500; border: 0 dashed var(--accent); pointer-events: none; }
.protoGuide[style*="width: 0"] { border-left-width: 1.5px; }
.protoGuide[style*="height: 0"] { border-top-width: 1.5px; }
.protoGhost { position: fixed; z-index: 9400; border: 2px dashed var(--accent); border-radius: 0.8rem; background: var(--accent-soft); pointer-events: none; }

.protoBar {
  position: fixed; z-index: 10000; left: 50%; bottom: 1rem; transform: translateX(-50%);
  display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.7rem; border-radius: 999px;
  background: #111; color: #fff; font: 600 0.8rem/1 var(--font-sans); box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}
.protoBar button { border: 0; background: none; color: inherit; font: inherit; cursor: pointer; padding: 0.2rem 0.35rem; }
.protoBar button:hover { color: #ffd99d; }
.protoBar kbd { font: 600 0.7rem var(--font-mono); opacity: 0.7; }
.protoBar__sep { width: 1px; height: 1rem; background: rgba(255,255,255,0.3); }
`;
