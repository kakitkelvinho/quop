"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { SignIcon } from "@/components/sign-icon";

/** A lower-case i in a circle: what the viewer's gestures do. */
function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 10.5V17.5M12 6.5v1" />
    </svg>
  );
}

/** A mouse with its left button pressed. */
function MouseClickIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 3.4c-3 0-5.4 2.4-5.4 5.4v5.6c0 3.4 2.5 6.2 5.4 6.2s5.4-2.8 5.4-6.2V8.8c0-3-2.4-5.4-5.4-5.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M12 3.9v5.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 5.9h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path d="M8.1 6c0 1.8 1.3 3.1 3.9 3.1" fill="currentColor" opacity="0.22" />
    </svg>
  );
}

/** The window a drag opens, stretching along x or along y. */
function SelectionFrameIcon({ axis }: { axis: "x" | "y" }) {
  const line = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.7,
  } as const;

  return (
    <svg aria-hidden="true" viewBox="0 0 28 24">
      <rect x="10" y="7" width="8" height="10" rx="1.6" {...line} />
      {axis === "x" ? (
        <path d="M2.5 12h6M25.5 12h-6M5.4 9.4l-2.9 2.6 2.9 2.6M22.6 9.4l2.9 2.6-2.9 2.6" {...line} />
      ) : (
        <path d="M14 2.5V6M14 21.5V18M11.4 5.4l2.6-2.9 2.6 2.9M11.4 18.6l2.6 2.9 2.6-2.9" {...line} />
      )}
    </svg>
  );
}

/**
 * A drag as the old gesture row drew it: [Shift +] mouse → the window it
 * opens, along x or along y.
 */
export function DragGesture({ axis, shift = false }: { axis: "x" | "y"; shift?: boolean }) {
  return (
    <>
      {shift ? (
        <>
          <span className="chartInfo__key">Shift</span>
          <span aria-hidden="true">+</span>
        </>
      ) : null}
      <span className="chartInfo__glyph">
        <MouseClickIcon />
      </span>
      <span aria-hidden="true">→</span>
      <span className="chartInfo__glyph chartInfo__glyph--frame">
        <SelectionFrameIcon axis={axis} />
      </span>
    </>
  );
}

/** A toolbar tool, drawn as it is on the toolbar, to point it out. */
export function ToolGesture({ children }: { children: ReactNode }) {
  return <SignIcon>{children}</SignIcon>;
}

/** A line of the bubble: what to do, led by how it looks when there is a picture for it. */
export type ChartHint = { gesture?: ReactNode; text: ReactNode };

/**
 * The last tool on a viewer's toolbar: an i that opens a bubble saying what
 * the pointer does on the plot, a line per gesture, led by the gesture's
 * picture where it has one. The bubble opens above the toolbar, anchored to
 * its right edge, and closes on Esc, a click outside or the i. The toolbar
 * (`.interactiveChart__footer`) is its positioning box.
 */
export function ChartInfo({ title, hints }: { title?: string; hints: ChartHint[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const bubbleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span className="chartInfo" ref={rootRef}>
      <button
        aria-controls={bubbleId}
        aria-expanded={open}
        aria-label={open ? "Hide how to use the plot" : "How to use the plot"}
        className={`interactiveChart__iconButton ${open ? "is-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        title="How to use the plot"
        type="button"
      >
        <SignIcon>
          <InfoIcon />
        </SignIcon>
      </button>
      {open ? (
        <div className="chartInfo__bubble" id={bubbleId} role="note">
          {title ? <p className="chartInfo__title">{title}</p> : null}
          <ul className="chartInfo__list">
            {hints.map((hint, index) => (
              <li className="chartInfo__hint" key={index}>
                <span className="chartInfo__gesture">{hint.gesture}</span>
                <span>{hint.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
