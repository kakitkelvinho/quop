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

/** The pointer gestures a hint can lead with, each drawn as a pictogram. */
export type Gesture =
  | "zoom-x"
  | "zoom-y"
  | "scroll"
  | "reset"
  | "point"
  | "box"
  | "click"
  | "turn"
  | "move";

// a mouse with its wheel, for the scroll gestures
const MOUSE =
  "M12 3c-3 0-5.5 2.4-5.5 5.4v7.2c0 3 2.5 5.4 5.5 5.4s5.5-2.4 5.5-5.4V8.4C17.5 5.4 15 3 12 3ZM12 7v3";

const GESTURE_PATHS: Record<Gesture, ReactNode> = {
  // a span between two edges, stretched along x / along y
  "zoom-x": <path d="M6 5v14M18 5v14M2 12h20M5 9l-3 3 3 3M19 9l3 3-3 3" />,
  "zoom-y": <path d="M5 6h14M5 18h14M12 2v20M9 5l3-3 3 3M9 19l3 3 3-3" />,
  scroll: <path d={MOUSE} />,
  // a turn back to the start
  reset: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 3.5V8h4.5" />,
  // cross hairs on a point
  point: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
    </>
  ),
  box: <rect height="12" strokeDasharray="3 2" width="16" x="4" y="6" />,
  // the pointer's arrow
  click: <path d="M6 3l12 7.5-5.2 1.3L10 17.5Z" />,
  // round and round, as the surface turns
  turn: <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 2.5v4.2h-4.2M6 21.5v-4.2h4.2" />,
  // four ways
  move: <path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />,
};

export type ChartHint = { gesture: Gesture; text: ReactNode };

/**
 * The last tool on a viewer's toolbar: an i that opens a bubble saying what
 * the pointer does on the plot, a line per gesture, each led by its
 * pictogram. The bubble opens above the toolbar, anchored to its right
 * edge, and closes on Esc, a click outside or the i. The toolbar
 * (`.interactiveChart__footer`) is its positioning box.
 */
export function ChartInfo({ hints }: { hints: ChartHint[] }) {
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
          <ul className="chartInfo__list">
            {hints.map((hint, index) => (
              <li className="chartInfo__hint" key={index}>
                <SignIcon>
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    {GESTURE_PATHS[hint.gesture]}
                  </svg>
                </SignIcon>
                <span>{hint.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
