"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import { Icon } from "@/components/builder/builder-icons";

/**
 * A panel's title bar: a grip, the panel's name and, for a panel that
 * closes, its close button. It replaces the panel's own heading, so the title
 * carries the id the panel is labelled by. Dragging it moves the panel
 * (usePanel's `bar` props).
 */
export function PanelBar({
  title,
  titleId,
  onPointerDown,
  onClose,
}: {
  title: string;
  titleId?: string;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onClose?: () => void;
}) {
  return (
    <div className="builderPanelBar" onPointerDown={onPointerDown}>
      <span className="builderPanelBar__grip">
        <Icon name="grip" size={14} />
      </span>
      <h2 id={titleId} className="builderPanelBar__title">
        {title}
      </h2>
      {onClose ? (
        <span className="builderPanelBar__buttons">
          <button
            type="button"
            className="builderPanelBar__button"
            aria-label={`Close ${title}`}
            title="Close (Esc)"
            onClick={onClose}
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      ) : null}
    </div>
  );
}
