"use client";

// PROTOTYPE (prototype/status-row-fade): the Show wheel as boxes. A row of the
// dock's square buttons fans out under the eye, each its own island, each name
// floating under its box. A box with a slider (Labels: their size; Lighting:
// the brightness) pops that slider out under itself when pressed.

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";
import { percent, type DialRange } from "@/components/builder/rim-dial";

export type BoxSlider = {
  label: string;
  range: DialRange;
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
  /** drawn instead of `icon` while the item is off */
  iconOff?: IconName;
  /** a toggle has a state; a box that only holds a slider has none */
  on?: boolean;
  onToggle?: () => void;
  /** popped out under the box when it is pressed (and, for a toggle, turned on) */
  slider?: BoxSlider;
};

/** A slider that takes one undo snapshot per gesture, like the inspector's. */
function BoxSliderPop({ slider, id }: { slider: BoxSlider; id: string }) {
  const editing = useRef(false);
  const end = () => {
    editing.current = false;
  };
  const { label, range, step = 0.05, value, onBegin, onChange } = slider;
  return (
    <div className="builderIsland showBoxes__pop" id={id} role="group" aria-label={label}>
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
      />
      <span className="builderReadout">{percent(value)}</span>
    </div>
  );
}

/**
 * A menu of boxes with one roving tab stop: the arrows walk the row, Home/End
 * jump to its ends, Enter or Space presses, Esc closes (an open slider first).
 * `breakAfter` puts a wider gap after that many boxes.
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
      // a toggle with a slider shows it once turned on, and hides it once turned off
      const turningOn = !item.on;
      item.onToggle();
      setPopped(item.slider && turningOn ? item.id : null);
    } else {
      setPopped((current) => (current === item.id ? null : item.id));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // keep every key off the table while the row is open
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (popped) {
        const at = items.findIndex((item) => item.id === popped);
        setPopped(null);
        refs.current[at]?.focus();
      } else onClose();
      return;
    }
    if (!refs.current.some((node) => node === event.target)) return;
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(focus + 1),
      ArrowLeft: () => move(focus - 1),
      Home: () => move(0),
      End: () => move(n - 1),
    };
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    run();
  };

  return (
    <div
      className="showBoxes"
      role="menu"
      aria-label="Show"
      aria-orientation="horizontal"
      style={{ "--n": n } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {items.map((item, i) => {
        const open = popped === item.id && item.slider;
        const shown = item.on ?? popped === item.id;
        const popId = `show-box-${item.id}`;
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
                role={item.onToggle ? "menuitemcheckbox" : "menuitem"}
                aria-checked={item.onToggle ? Boolean(item.on) : undefined}
                aria-expanded={!item.onToggle && item.slider ? Boolean(open) : undefined}
                aria-controls={open ? popId : undefined}
                aria-label={item.description}
                className={`builderIconBtn showBoxes__box${shown ? " is-shown" : ""}`}
                tabIndex={i === focus ? 0 : -1}
                title={item.description}
                onFocus={() => setFocus(i)}
                onClick={() => press(item, i)}
              >
                <Icon name={item.on === false ? (item.iconOff ?? item.icon) : item.icon} />
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
