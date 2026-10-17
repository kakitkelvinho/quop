"use client";

/*
 * PROTOTYPE, throwaway: where should a minimised panel go?
 * Today a minimised panel collapses to its title bar in place, still in the way.
 * Here it leaves the table and lives in a tray instead. Variants, via ?variant=
 * on /builder/tabletop (wide screens only, where panels move):
 *   A        Dock: a new island bottom centre, one icon per panel, macOS-style dots
 *   B        Chips: nothing until a panel is minimised; then its icon, in a thin column
 *            bottom left, the lists stepping right of it
 *   C        Rail: no new island; panel icons join the + island top left
 *   current  Today: collapse to the title bar in place
 * A tray button: closed → open, minimised → restore, open behind → front, open in front → minimise.
 */

import { type ReactNode, useSyncExternalStore } from "react";

import {
  allPanels,
  bringPanelToFront,
  panelState,
  panelsVersion,
  setPanelView,
  subscribePanels,
} from "@/components/builder/panel-store";

export const TRAY_VARIANTS = [
  { key: "A", name: "Dock" },
  { key: "B", name: "Minimised chips" },
  { key: "C", name: "Rail in + island" },
  { key: "current", name: "Today" },
];

export type TrayPanel = {
  id: string;
  title: string;
  /** e.g. what the Inspector holds */
  subtitle?: string;
  count?: number;
  /** there is something to show: a selection, a beam, ... */
  available: boolean;
  /** mounted (the Inspector and the lists are open whenever available) */
  open: boolean;
  /** opens a panel that closes (brief, JSON, parts) */
  onOpen?: () => void;
  /** reached from elsewhere (parts from +): the tray shows it only while minimised */
  launcher?: false;
};

function usePanelStore() {
  useSyncExternalStore(subscribePanels, panelsVersion, panelsVersion);
}

function isFront(id: string) {
  const z = panelState(id).z ?? 0;
  let top = 0;
  for (const state of allPanels().values()) top = Math.max(top, state.z ?? 0);
  return z > 0 && z === top;
}

function press(panel: TrayPanel) {
  const { minimised } = panelState(panel.id);
  if (!panel.open) {
    panel.onOpen?.();
    setPanelView(panel.id, "restored");
    bringPanelToFront(panel.id);
  } else if (minimised) {
    setPanelView(panel.id, "restored");
    bringPanelToFront(panel.id);
  } else if (isFront(panel.id)) {
    setPanelView(panel.id, "minimised");
  } else {
    bringPanelToFront(panel.id);
  }
}

function status(panel: TrayPanel): "closed" | "minimised" | "open" {
  if (!panel.open) return "closed";
  return panelState(panel.id).minimised ? "minimised" : "open";
}

const GLYPHS: Record<string, ReactNode> = {
  inspector: (
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4" />
  ),
  beams: <path d="M3 17 10 8l4 6 7-9" />,
  frames: <rect x="4" y="6" width="16" height="12" rx="1.5" strokeDasharray="3 2.5" />,
  groups: (
    <>
      <rect x="3.5" y="3.5" width="8" height="8" rx="1.5" />
      <rect x="12.5" y="12.5" width="8" height="8" rx="1.5" />
      <path d="M11.5 7.5h3a2 2 0 0 1 2 2v3" />
    </>
  ),
  parts: <path d="M12 5v14M5 12h14" />,
};

const TEXT_GLYPHS: Record<string, string> = { brief: ".md", json: "{ }" };

function Glyph({ id }: { id: string }) {
  if (TEXT_GLYPHS[id]) return <span className="ptTray__text">{TEXT_GLYPHS[id]}</span>;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[id]}
    </svg>
  );
}

function tip(panel: TrayPanel) {
  if (!panel.available) return `${panel.title}: ${panel.id === "inspector" ? "select something first" : "nothing yet"}`;
  const s = status(panel);
  const what = panel.subtitle ? `${panel.title}: ${panel.subtitle}` : panel.title;
  return `${what} (${s === "closed" ? "open" : s === "minimised" ? "restore" : "front / minimise"})`;
}

function TrayButton({ panel, vertical = false }: { panel: TrayPanel; vertical?: boolean }) {
  const s = status(panel);
  return (
    <button
      type="button"
      className={`builderIconBtn ptTray__btn is-${s}${vertical ? " is-vertical" : ""}`}
      aria-label={tip(panel)}
      title={tip(panel)}
      disabled={!panel.available}
      onClick={() => press(panel)}
    >
      <Glyph id={panel.id} />
      {panel.count ? <span className="ptTray__count">{panel.count}</span> : null}
      <span className="ptTray__dot" />
    </button>
  );
}

/** A: its own island, bottom centre; every panel always has an icon. */
export function PanelDock({ panels }: { panels: TrayPanel[] }) {
  usePanelStore();
  const shown = panels.filter((p) => p.launcher !== false || status(p) === "minimised");
  return (
    <div className="builderIsland ptDock" role="toolbar" aria-label="Panels">
      {shown.map((panel) => (
        <TrayButton key={panel.id} panel={panel} />
      ))}
    </div>
  );
}

/** B: only minimised panels, as labelled chips; nothing when none are. */
export function PanelChips({ panels, besideParts }: { panels: TrayPanel[]; besideParts: boolean }) {
  usePanelStore();
  const minimised = panels.filter((p) => status(p) === "minimised");
  if (!minimised.length) return null;
  return (
    <div
      className={`builderIsland ptChips${besideParts ? " is-besideParts" : ""}`}
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Minimised panels"
    >
      {minimised.map((panel) => (
        <button
          key={panel.id}
          type="button"
          className="builderIconBtn ptChip"
          aria-label={`Restore ${panel.title}`}
          title={`Restore ${panel.title}${panel.subtitle ? `: ${panel.subtitle}` : ""}`}
          onClick={() => press(panel)}
        >
          <Glyph id={panel.id} />
        </button>
      ))}
    </div>
  );
}

/** C: inside the + island, after a separator: no new island. */
export function PanelRail({ panels }: { panels: TrayPanel[] }) {
  usePanelStore();
  const shown = panels.filter((p) => p.launcher !== false || status(p) === "minimised");
  return (
    <>
      <span className="builderIsland__sep" />
      {shown.map((panel) => (
        <TrayButton key={panel.id} panel={panel} />
      ))}
    </>
  );
}

/** The prototype's look; a minimised panel leaves the table in every tray variant. */
export function TrayStyles() {
  return (
    <style>{`
.builderPanels.is-trayed .builderPanel.is-minimised { display: none !important; }
.ptDock {
  left: 50%; bottom: 0.9rem; translate: -50% 0; z-index: 6;
}
/* B: a column bottom left, beside the parts panel while it is open; the lists step right of it */
.ptChips {
  left: 0.9rem; bottom: 0.9rem; z-index: 6;
  flex-direction: column; align-items: stretch;
}
.ptChips.is-besideParts { left: calc(0.9rem + clamp(16rem, 25vw, 24rem) + 0.6rem); }
.builderPanels.is-on:has(~ .ptChips) .builderHud__lists { padding-left: calc(0.9rem + 2.6rem + 0.4rem); }
.builderPanels.is-on:has(~ .ptChips) .builderHud__lists.is-besideParts {
  padding-left: calc(0.9rem + clamp(16rem, 25vw, 24rem) + 0.6rem + 2.6rem + 0.4rem);
}
.ptTray__btn { position: relative; }
.ptTray__btn:disabled { opacity: 0.3; cursor: default; }
.ptTray__btn.is-open { color: var(--foreground); }
.ptTray__dot {
  position: absolute; left: 50%; bottom: 0.08rem; translate: -50% 0;
  width: 0.28rem; height: 0.28rem; border-radius: 999px; background: transparent;
}
.ptTray__btn.is-open .ptTray__dot { background: var(--accent); }
.ptTray__btn.is-minimised .ptTray__dot { background: transparent; box-shadow: inset 0 0 0 1.2px var(--accent); }
.ptTray__btn.is-minimised { color: var(--accent); }
.ptTray__text { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; }
.ptTray__count {
  position: absolute; top: 0.05rem; right: 0.05rem; min-width: 0.85rem; height: 0.85rem; padding: 0 0.15rem;
  border-radius: 999px; background: var(--muted); color: var(--surface);
  font: 700 0.55rem/0.85rem var(--font-mono); text-align: center;
}
.ptChips { gap: 0.2rem; animation: builderSlide 180ms ease; }
.ptChip { color: var(--accent); }
`}</style>
  );
}
