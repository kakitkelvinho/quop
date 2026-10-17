"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";
import type { PanelEdge } from "@/components/builder/panel-geometry";

/**
 * A panel's title bar: a grip, the panel's name, and its buttons: minimise,
 * maximise and, for a panel that closes, close. It replaces the panel's own
 * heading, so the title carries the id the panel is labelled by. Dragging it
 * moves the panel and double-clicking it minimises or restores it (usePanel's
 * `bar` props).
 */
export function PanelBar({
  title,
  titleId,
  subtitle,
  onPointerDown,
  minimised,
  maximised,
  onToggleMinimised,
  onToggleMaximised,
  onClose,
}: {
  title: string;
  titleId?: string;
  /** shown after the title while minimised, e.g. what the Inspector has selected */
  subtitle?: string;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  minimised: boolean;
  maximised: boolean;
  onToggleMinimised: () => void;
  onToggleMaximised: () => void;
  onClose?: () => void;
}) {
  return (
    <div
      className="builderPanelBar"
      onPointerDown={onPointerDown}
      onDoubleClick={(event) => {
        if (!(event.target as Element).closest("button")) onToggleMinimised();
      }}
    >
      <span className="builderPanelBar__grip">
        <Icon name="grip" size={14} />
      </span>
      <h2 id={titleId} className="builderPanelBar__title">
        {title}
        {minimised && subtitle ? `: ${subtitle}` : null}
      </h2>
      <span className="builderPanelBar__buttons">
        <BarButton
          icon={minimised ? "restore" : "minimise"}
          label={`${minimised ? "Restore" : "Minimise"} ${title}`}
          onClick={onToggleMinimised}
        />
        <BarButton
          icon={maximised ? "restore" : "maximise"}
          label={`${maximised ? "Restore" : "Maximise"} ${title}`}
          onClick={onToggleMaximised}
        />
        {onClose ? <BarButton icon="close" label={`Close ${title}`} title="Close (Esc)" onClick={onClose} /> : null}
      </span>
    </div>
  );
}

function BarButton({
  icon,
  label,
  title = label,
  onClick,
}: {
  icon: IconName;
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="builderPanelBar__button" aria-label={label} title={title} onClick={onClick}>
      <Icon name={icon} size={14} />
    </button>
  );
}

/**
 * A panel's resize handles: its right edge, its bottom edge and the corner
 * between them, each with its cursor (usePanel's `resize` props). Only a
 * pointer resizes; they are not in the tab order.
 */
export function PanelResize({
  onPointerDown,
}: {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, edge: PanelEdge) => void;
}) {
  return (
    <>
      {(["e", "s", "se"] as const).map((edge) => (
        <span
          key={edge}
          className={`builderPanelResize builderPanelResize--${edge}`}
          aria-hidden="true"
          onPointerDown={(event) => onPointerDown(event, edge)}
        />
      ))}
    </>
  );
}
