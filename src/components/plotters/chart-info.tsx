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

/**
 * The last tool on a viewer's toolbar: an i that opens a bubble saying, in
 * words, what the pointer does on the plot. It sits in place of a row of
 * gesture glyphs under every chart. The bubble opens above the toolbar,
 * anchored to its right edge, and closes on Esc, a click outside or the i.
 * The toolbar (`.interactiveChart__footer`) is its positioning box.
 */
export function ChartInfo({ hints }: { hints: ReactNode[] }) {
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
              <li key={index}>{hint}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
