"use client";

import { useEffect, useRef, useState } from "react";

import type { ModeHint } from "@/components/builder/group-mode";
import { tracedViewHref } from "@/components/builder/traced-flag";
import type { TraceResult } from "@/components/builder/trace-scene";

type Mode = { label: string; hints: ModeHint[] } | null;

/** The checks cell: a tick, or a count that opens the list of what didn't pass. */
function ChecksCell({ trace, onSelectComponent }: { trace: TraceResult; onSelectComponent: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cellRef = useRef<HTMLSpanElement>(null);
  const count = trace.checks.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Esc closes the list before it reaches the Tabletop, which would also end a mode or clear the selection
      event.stopPropagation();
      setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!cellRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  if (count === 0) {
    return (
      <span className="builderBar__cell">
        ✓<span className="builderBar__wide">&nbsp;Light reaches every stop</span>
      </span>
    );
  }
  return (
    <span ref={cellRef} className="builderBar__cell builderBar__checks">
      <button type="button" className="builderBar__press" aria-expanded={open} aria-controls="builder-bar-checks" onClick={() => setOpen(!open)}>
        ⚠ {count}
        <span className="builderBar__wide">&nbsp;check{count === 1 ? "" : "s"}</span>
      </button>
      {open ? (
        <span id="builder-bar-checks" className="builderBar__checkList" role="list" aria-label="Traced light checks">
          {trace.checks.map((check) => (
            <span role="listitem" key={`${check.kind}-${check.componentId}-${check.message}`}>
              <button
                type="button"
                onClick={() => {
                  onSelectComponent(check.componentId);
                  setOpen(false);
                }}
              >
                {check.message}
              </button>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** Leaves for the other view. The address is read when pressed, so it carries settings the page set since it opened. */
function ViewSwitch({ traced }: { traced: boolean }) {
  const label = traced ? "Legacy view" : "Switch to traced Beams";
  return (
    <a
      className={`builderBar__cell builderBar__link${traced ? "" : " is-strong"}`}
      href={tracedViewHref(window.location.href, !traced)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        window.location.assign(tracedViewHref(window.location.href, !traced));
      }}
    >
      {label}
    </a>
  );
}

/**
 * One strip along the Tabletop's bottom edge: the mode, the trace's checks,
 * the upgrade notice, the last status message and the view switch. It stays
 * in the legacy view, so the way back to traced Beams is always on screen.
 */
export function StatusBar({
  mode,
  status,
  trace,
  handDrawnAfterUpgrade,
  onSelectComponent,
}: {
  mode: Mode;
  status: string | null;
  /** null in the legacy (drawn) view */
  trace: TraceResult | null;
  handDrawnAfterUpgrade: number;
  onSelectComponent: (id: string) => void;
}) {
  return (
    <div className="builderBar" data-guide="status-bar">
      <span className="builderBar__mode" aria-label="Mode">
        {mode ? (
          <>
            <b>{mode.label}</b>
            {mode.hints.map(([key, action]) => (
              <span key={`${key} ${action}`}>
                <kbd>{key}</kbd> {action}
              </span>
            ))}
          </>
        ) : (
          <span className="builderBar__quiet">Select</span>
        )}
      </span>
      {trace ? (
        <>
          <ChecksCell trace={trace} onSelectComponent={onSelectComponent} />
          {handDrawnAfterUpgrade > 0 ? (
            <span className="builderBar__cell builderBar__wide">
              Upgraded · {handDrawnAfterUpgrade} Beam{handDrawnAfterUpgrade === 1 ? "" : "s"} kept hand-drawn
            </span>
          ) : null}
        </>
      ) : (
        <span className="builderBar__cell">
          Legacy view<span className="builderBar__wide">: drawn Beams, not traced</span>
        </span>
      )}
      <p className="builderBar__status" role="status" aria-live="polite">
        {status}
      </p>
      <ViewSwitch traced={trace !== null} />
    </div>
  );
}
