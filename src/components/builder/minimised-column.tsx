"use client";

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";
import {
  type TabletopPanel,
  type TabletopPanelId,
  minimiseAll,
  minimisedIn,
  minimisedPanels,
  restoreLabel,
  restorePanel,
  selectionReopensInspector,
  showingPanels,
} from "@/components/builder/minimised-panels";
import { panelState, panelsVersion, subscribePanels } from "@/components/builder/panel-store";
import { useBubbleDismiss } from "@/components/builder/use-bubble-dismiss";

/*
 * Where panels move, a minimised panel leaves the table (minimised-panels.ts).
 * Here: the column its icon waits in, the View island's panels menu, and the
 * Inspector opening again on a new selection.
 */

function usePanelStore() {
  useSyncExternalStore(subscribePanels, panelsVersion, panelsVersion);
}

/** Each panel's glyph: the brief and the JSON panel are text, as the .md button is. */
const GLYPHS: Record<TabletopPanelId, IconName | string> = {
  inspector: "inspector",
  parts: "add",
  brief: ".md",
  json: "{ }",
  beams: "beams",
  frames: "frame",
  groups: "groups",
};

const TEXT_GLYPHS = new Set([".md", "{ }"]);

function Glyph({ id }: { id: TabletopPanelId }) {
  const glyph = GLYPHS[id];
  return TEXT_GLYPHS.has(glyph) ? (
    <span className="builderMinimised__text" aria-hidden="true">
      {glyph}
    </span>
  ) : (
    <Icon name={glyph as IconName} />
  );
}

/** After a restore, the keyboard carries on in the panel: its bar's first button. */
function focusPanel(id: string) {
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-panel="${id}"] .builderPanelBar button`)?.focus();
  });
}

/**
 * The minimised panels, bottom left: an icon each, in the accent colour, its
 * name sliding out on hover or keyboard focus. Nothing while none is
 * minimised. Beside the parts panel (or the brief or JSON in its place) while
 * that is showing.
 */
export function MinimisedColumn({ panels, besideParts }: { panels: TabletopPanel[]; besideParts: boolean }) {
  usePanelStore();
  const minimised = minimisedPanels(panels, minimisedIn(true));
  const ids = minimised.map((panel) => panel.id).join(" ");
  const columnRef = useRef<HTMLDivElement>(null);
  // none on the first render: panels kept minimised from last time don't take the focus
  const seen = useRef<string[] | null>(null);
  // a panel minimised from its own bar would take the focus with it: it lands on the panel's icon
  useLayoutEffect(() => {
    const now = ids ? ids.split(" ") : [];
    const before = seen.current;
    const added = before ? now.filter((id) => !before.includes(id)) : [];
    seen.current = now;
    const active = document.activeElement;
    const lost = !active || active === document.body || Boolean(active.closest(".builderPanel.is-minimised"));
    if (added.length === 1 && lost) {
      columnRef.current?.querySelector<HTMLElement>(`[data-restores="${added[0]}"]`)?.focus();
    }
  }, [ids]);

  if (!minimised.length) return null;
  return (
    <div
      ref={columnRef}
      className={`builderIsland builderMinimised${besideParts ? " is-besideParts" : ""}`}
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Minimised panels"
      data-guide="minimised"
    >
      {minimised.map((panel) => (
        <button
          key={panel.id}
          type="button"
          className="builderIconBtn builderMinimised__button"
          aria-label={restoreLabel(panel)}
          data-restores={panel.id}
          onClick={(event) => {
            const hadFocus = document.activeElement === event.currentTarget;
            restorePanel(panel.id);
            if (hadFocus) focusPanel(panel.id);
          }}
        >
          <Glyph id={panel.id} />
          <span className="builderMinimised__label" aria-hidden="true">
            {panel.title}
            {panel.subtitle ? <span className="builderMinimised__sub">{panel.subtitle}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * The View island's panels button: a menu, upward, to minimise every panel
 * showing or to put them all back (⌥0 does that directly).
 */
export function PanelsMenu({ panels, onReset }: { panels: TabletopPanel[]; onReset: () => void }) {
  usePanelStore();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useBubbleDismiss(open, close);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isMinimised = minimisedIn(true);
  const anyShowing = showingPanels(panels, isMinimised).length > 0;
  const pick = (action: () => void) => () => {
    action();
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="builderMenu builderPanelsMenu" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={`builderIconBtn${open ? " is-active" : ""}`}
        aria-label="Panels"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Panels"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="resetPanels" />
      </button>
      {open ? (
        <div className="builderMenu__list" role="menu" aria-label="Panels">
          <button
            type="button"
            role="menuitem"
            disabled={!anyShowing}
            onClick={pick(() => minimiseAll(panels, isMinimised))}
          >
            Minimise all
          </button>
          <button type="button" role="menuitem" onClick={pick(onReset)}>
            Reset panels <span className="builderReadout">⌥0</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A minimised Inspector opens again, in front, when something new is
 * selected or a draft starts (minimised-panels.ts's selectionKey). Only where
 * panels move: elsewhere nothing is ever minimised.
 */
export function useInspectorReopens(selection: string, moves: boolean) {
  const previous = useRef(selection);
  // before paint, so the new selection's Inspector never flashes hidden
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = selection;
    if (moves && selectionReopensInspector(before, selection) && panelState("inspector").minimised) {
      restorePanel("inspector");
    }
  }, [selection, moves]);
}
