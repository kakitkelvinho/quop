"use client";

import { useState, type CSSProperties } from "react";

/**
 * Folds a tool's sidebar away and back from the hairline between it and the
 * plot. The hairline is the button: pointed at, a small tab grows out of it
 * where the pointer is, an arrow inside, and a click anywhere along the line
 * folds the sidebar. Folded, the tab stays out on the line, the way back.
 * It sits in the sidebar (`.visualizerSidebar`), which places it.
 */
export function SidebarFold({
  collapsed,
  onToggle,
  label = "data panel",
}: {
  collapsed: boolean;
  onToggle: () => void;
  label?: string;
}) {
  const [tabY, setTabY] = useState<number | null>(null);
  const action = `${collapsed ? "Show" : "Hide"} the ${label}`;

  return (
    <button
      aria-expanded={!collapsed}
      aria-label={action}
      className={`sidebarFold${collapsed ? " is-collapsed" : ""}`}
      onClick={onToggle}
      onPointerLeave={() => setTabY(null)}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") {
          setTabY(event.clientY - event.currentTarget.getBoundingClientRect().top);
        }
      }}
      style={tabY === null ? undefined : { "--fold-tab-y": `${tabY}px` } as CSSProperties}
      title={action}
      type="button"
    >
      <span aria-hidden="true" className="sidebarFold__tab">
        <svg viewBox="0 0 24 24">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </span>
    </button>
  );
}
