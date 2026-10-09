"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Icon, PartIcon, type IconName } from "@/components/builder/builder-icons";
import { useScenePalette } from "@/components/builder/scene-theme";
import { BEAM_COLORS, type ComponentType } from "@/components/builder/types";

/**
 * One line per control. The diagram's numbered marks and the list both read
 * this array, so a number can't point at the wrong line.
 */
const GUIDE = [
  {
    spot: "file",
    title: "File menu",
    text: "Save or open a setup as JSON, export the view as a PNG, load the example, or clear the table.",
  },
  { spot: "add", title: "Add a part", text: "Pick a part from the panel, then click the table to place it." },
  {
    spot: "beam",
    title: "Draw a beam",
    text: "Click parts in the order the light visits them, then press Enter.",
  },
  {
    spot: "connect",
    title: "Connect",
    text: "Join two parts with a fibre or cable: click the part it leaves from, then the part it goes to.",
  },
  {
    spot: "tools",
    title: "Tools",
    text: "Select and move parts, show or hide posts, turn the grid on or off, and undo or redo.",
  },
  {
    spot: "camera",
    title: "Move the camera",
    text: "Drag to pan, scroll or pinch to zoom, and Shift, right or middle drag to orbit.",
  },
  {
    spot: "inspector",
    title: "Inspector",
    text: "Opens when something is selected, with its numbers to edit and buttons to turn, copy or delete it.",
  },
  {
    spot: "view",
    title: "View",
    text: "Switch between isometric and top-down, fit the layout, show labels, or swap day and night.",
  },
  {
    spot: "beams",
    title: "Beams",
    text: "Click a row to select its beam, or use the row’s buttons to move, hide or delete it.",
  },
  {
    spot: "several",
    title: "Select several",
    text: "⌘/Ctrl click a part to add it, ⌘/Ctrl drag a box around several, or ⌘A for every part.",
  },
] as const satisfies readonly { spot: string; title: string; text: string }[];

type Spot = (typeof GUIDE)[number]["spot"];
type Side = "top" | "right" | "bottom" | "left";

function Mark({ spot, side }: { spot: Spot; side: Side }) {
  const number = GUIDE.findIndex((entry) => entry.spot === spot) + 1;
  return <span className={`builderGuide__mark is-${side}`}>{number}</span>;
}

/** A drawn button: the real icon and button styling, with nothing to press. */
function Button({ icon, state, mark }: { icon: IconName; state?: "active" | "dim"; mark?: ReactNode }) {
  return (
    <span className={`builderIconBtn${state === "active" ? " is-active" : state === "dim" ? " is-dim" : ""}`}>
      <Icon name={icon} />
      {mark}
    </span>
  );
}

/** The bench in the miniature, in % of the frame: one beam, and two parts caught in a ⌘ drag box. */
const SCENE_PARTS: { type: ComponentType; label: string; x: number; y: number; selected: boolean }[] = [
  { type: "laser-source", label: "Laser", x: 20, y: 64, selected: true },
  { type: "mirror-mount", label: "Mirror", x: 43, y: 64, selected: true },
  { type: "photodiode", label: "Photodiode", x: 43, y: 34, selected: false },
];

// the frame is 16:10, so its viewBox is 100 wide and 62.5 tall
const BEAM_POINTS = SCENE_PARTS.map((part) => `${part.x},${part.y * 0.625}`).join(" ");

/** A miniature of the builder: its islands where they float, over a bench in the scene's own sweep. */
function Diagram() {
  const { backdrop } = useScenePalette();
  return (
    <div className="builderGuide__diagram" aria-hidden="true">
      <div
        className="builderGuide__frame"
        style={{
          background: `radial-gradient(120% 110% at 50% 45%, ${backdrop[0]}, ${backdrop[1]} 58%, ${backdrop[2]})`,
        }}
      >
        <svg className="builderGuide__beam" viewBox="0 0 100 62.5" preserveAspectRatio="none">
          <polyline className="builderGuide__halo" points={BEAM_POINTS} stroke={BEAM_COLORS[0]} />
          <polyline points={BEAM_POINTS} stroke={BEAM_COLORS[0]} />
        </svg>
        <span className="builderGuide__box">
          <span className="builderGuide__cursor">
            <Icon name="select" />
          </span>
          <Mark spot="several" side="right" />
        </span>
        {SCENE_PARTS.map((part) => (
          <span
            key={part.type}
            className={`builderGuide__part${part.selected ? " is-selected" : ""}`}
            style={{ left: `${part.x}%`, top: `${part.y}%` }}
          >
            <span className="builderGuide__label">{part.label}</span>
            <PartIcon type={part.type} />
          </span>
        ))}

        <div className="builderIsland builderGuide__file">
          <span className="builderGuide__back">
            <Icon name="back" />
            QUOP
          </span>
          <span className="builderIsland__sep" />
          <span className="builderGuide__menu">
            Experiment builder
            <Icon name="chevron" />
            <Mark spot="file" side="bottom" />
          </span>
        </div>

        <div className="builderIsland builderGuide__add">
          <Button icon="add" mark={<Mark spot="add" side="bottom" />} />
          <Button icon="beam" mark={<Mark spot="beam" side="bottom" />} />
          <Button icon="connect" mark={<Mark spot="connect" side="bottom" />} />
        </div>

        <div className="builderIsland builderGuide__tools">
          <Button icon="select" state="active" />
          <Button icon="posts" state="active" />
          <Button icon="grid" />
          <span className="builderIsland__sep" />
          <Button icon="undo" />
          <Button icon="redo" state="dim" />
          <Mark spot="tools" side="bottom" />
        </div>

        <p className="builderGuide__hint">
          <span>
            <kbd>⇧</kbd> drag rotate · drag pan · scroll zoom
          </span>
          <span>or middle / right drag to rotate</span>
          <span>
            <kbd>⌘</kbd> drag or click to select several
          </span>
          <Mark spot="camera" side="left" />
        </p>

        <div className="builderIsland builderGuide__inspector">
          <span className="builderGuide__inspectorTitle">2 parts selected</span>
          <span className="builderGuide__field">
            Height <span className="builderReadout">100 mm</span>
          </span>
          <span className="builderGuide__actions">
            <Button icon="rotateLeft" />
            <Button icon="rotateRight" />
            <Button icon="duplicate" />
            <Button icon="trash" />
          </span>
          <Mark spot="inspector" side="left" />
        </div>

        <div className="builderIsland builderGuide__beams">
          {[
            { name: "Probe", mm: 412, color: BEAM_COLORS[0] },
            { name: "Pump", mm: 655, color: BEAM_COLORS[1] },
          ].map((beam) => (
            <span key={beam.name} className="builderGuide__beamRow">
              <span className="builderBeamRow__dot" style={{ background: beam.color }} />
              <span className="builderGuide__beamName">{beam.name}</span>
              <span className="builderReadout">{beam.mm} mm</span>
              <Button icon="up" />
              <Button icon="down" />
              <Button icon="eye" />
              <Button icon="trash" />
            </span>
          ))}
          <Mark spot="beams" side="right" />
        </div>

        <div className="builderIsland builderGuide__view">
          <span className="builderSegment">
            <Button icon="iso" state="active" />
            <Button icon="top" />
          </span>
          <Button icon="fit" />
          <span className="builderIsland__sep" />
          <Button icon="labels" state="active" />
          <Button icon="theme" />
          <span className="builderIsland__sep" />
          <Button icon="info" state="active" />
          <Mark spot="view" side="top" />
        </div>
      </div>
    </div>
  );
}

/**
 * The quick guide: a modal over the builder, opened only from its button.
 * Esc, the close button or a click on the backdrop closes it, and focus goes
 * back to whatever opened it.
 */
export default function QuickGuide({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [opener] = useState(() => document.activeElement);
  const pressedBackdrop = useRef(false);

  const close = useCallback(() => {
    dialogRef.current?.close();
    if (opener instanceof HTMLElement) opener.focus();
    onClose();
  }, [opener, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    // The scene reads keys on window: Esc would deselect behind the guide, and
    // arrows, R or Delete would edit the selection. Chromium's own Esc close
    // fired no close event, so Esc takes the same path as the close button.
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [close]);

  return (
    <dialog
      ref={dialogRef}
      className="builderGuide"
      aria-labelledby="builder-guide-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      // the backdrop is the dialog itself; a press that starts in the guide
      // and ends outside it is a text selection, not a dismissal
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) close();
      }}
    >
      <div className="builderGuide__body">
        <header className="builderGuide__head">
          <h2 id="builder-guide-title" className="builderGuide__title">
            Quick guide
          </h2>
          <p className="builderGuide__lead">
            What each part of the builder does. Hover any button to see its name and shortcut.
          </p>
        </header>
        <Diagram />
        <ol className="builderGuide__list" role="list">
          {GUIDE.map((entry, index) => (
            <li key={entry.spot}>
              <span className="builderGuide__mark" aria-hidden="true">
                {index + 1}
              </span>
              <p>
                <strong>{entry.title}.</strong> {entry.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
      <button
        type="button"
        className="builderHud__close"
        aria-label="Close guide"
        title="Close (Esc)"
        onClick={close}
      >
        <Icon name="close" size={16} />
      </button>
    </dialog>
  );
}
