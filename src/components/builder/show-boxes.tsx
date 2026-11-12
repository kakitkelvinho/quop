"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";

export type BoxSlider = {
  label: string;
  range: readonly [number, number];
  step?: number;
  value: number;
  onBegin?: () => void;
  onChange: (value: number) => void;
};

export type ShowBox = {
  id: string;
  /** the word under the box */
  label: string;
  /** its tooltip and accessible name */
  description: string;
  icon: IconName;
  /** a toggle has a state; a box that only holds a slider has none */
  on?: boolean;
  onToggle?: () => void;
  /** a toggle's slider shows under it while it is on; a plain box's, while pressed */
  slider?: BoxSlider;
};

/** A value as a percentage, for a slider's readout. */
function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

// the keys a slider keeps for itself, away from the row and the table
const SLIDER_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

/** A slider that takes one undo snapshot per gesture, like the inspector's. */
function BoxSliderPop({ slider, id }: { slider: BoxSlider; id: string }) {
  const editing = useRef(false);
  const end = () => {
    editing.current = false;
  };
  const { label, range, step = 0.05, value, onBegin, onChange } = slider;
  return (
    <div className="builderIsland showBoxes__pop" id={id}>
      <input
        className="builderSlider"
        type="range"
        aria-label={label}
        min={range[0]}
        max={range[1]}
        step={step}
        value={value}
        onChange={(event) => {
          if (!editing.current) {
            editing.current = true;
            onBegin?.();
          }
          onChange(Number(event.target.value));
        }}
        onPointerUp={end}
        onKeyUp={end}
        onBlur={end}
        onKeyDown={(event) => {
          if (SLIDER_KEYS.has(event.key)) event.stopPropagation();
        }}
      />
      <span className="builderReadout">{percent(value)}</span>
    </div>
  );
}

/**
 * Show, as boxes: a toolbar of the dock's square buttons that fans out under
 * the eye, each its own island, each name floating under its box. Toggles are
 * pressed in while on. One slider shows at a time, under its box: a plain box
 * (Lighting) pops its own while pressed, and otherwise a toggle that is on
 * (Labels) shows its own. One roving tab stop: Left/Right walk the row,
 * Home/End jump to its ends, Enter or Space presses, Esc closes (a popped
 * slider first). Only those keys are kept off the table; the rest (undo, say)
 * still reach it. `breakAfter` puts a wider gap after that many boxes.
 */
export function ShowBoxes({
  items,
  breakAfter,
  onClose,
}: {
  items: ShowBox[];
  breakAfter?: number;
  onClose: () => void;
}) {
  const [focus, setFocus] = useState(0);
  const [popped, setPopped] = useState<string | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = items.length;

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const move = (to: number) => {
    const next = (to + n) % n;
    setFocus(next);
    refs.current[next]?.focus();
  };

  const press = (item: ShowBox, i: number) => {
    setFocus(i);
    if (item.onToggle) {
      item.onToggle();
      setPopped(null);
    } else {
      setPopped((current) => (current === item.id ? null : item.id));
    }
  };

  // the one slider showing: a popped box's, else the first toggle with a slider that is on
  const sliding = popped ?? items.find((item) => item.onToggle && item.slider && item.on)?.id ?? null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (popped) {
        const at = items.findIndex((item) => item.id === popped);
        setPopped(null);
        refs.current[at]?.focus();
      } else onClose();
      return;
    }
    if (!refs.current.some((node) => node === event.target)) return;
    if (event.key === "Enter" || event.key === " ") {
      // the box clicks itself; the table mustn't also act on the key
      event.stopPropagation();
      return;
    }
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(focus + 1),
      ArrowLeft: () => move(focus - 1),
      Home: () => move(0),
      End: () => move(n - 1),
    };
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    run();
  };

  return (
    <div
      className="showBoxes"
      role="toolbar"
      aria-label="Show"
      aria-orientation="horizontal"
      style={{ "--n": n } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {items.map((item, i) => {
        const open = sliding === item.id && item.slider;
        const popId = `show-box-${item.id}`;
        const toggle = Boolean(item.onToggle);
        const shown = toggle ? Boolean(item.on) : popped === item.id;
        return (
          <div
            key={item.id}
            className={`showBoxes__cell${breakAfter === i ? " is-break" : ""}`}
            style={{ "--i": i } as CSSProperties}
          >
            <div className="builderIsland showBoxes__island">
              <button
                ref={(node) => {
                  refs.current[i] = node;
                }}
                type="button"
                aria-pressed={toggle ? shown : undefined}
                aria-expanded={!toggle && item.slider ? shown : undefined}
                aria-controls={open ? popId : undefined}
                aria-label={item.description}
                className={`builderIconBtn showBoxes__box${shown ? " is-shown" : ""}`}
                tabIndex={i === focus ? 0 : -1}
                title={item.description}
                onFocus={() => setFocus(i)}
                onClick={() => press(item, i)}
              >
                <Icon name={item.icon} off={item.on === false} />
                <span className="showBoxes__name" aria-hidden="true">
                  {item.label}
                </span>
              </button>
            </div>
            {open && item.slider ? <BoxSliderPop slider={item.slider} id={popId} /> : null}
          </div>
        );
      })}
    </div>
  );
}
