"use client";

// PROTOTYPE (prototype/status-row-fade): the Show wheel as boxes. An island of
// square toggles drops from the eye, the dock's own buttons, each name floating
// under its box; a slim island under it holds the two sliders.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";
import { percent, type DialRange } from "@/components/builder/rim-dial";
import type { WheelItem } from "@/components/builder/show-wheel";

export type BoxSlider = {
  id: string;
  label: string;
  icon: IconName;
  range: DialRange;
  step?: number;
  value: number;
  disabled?: boolean;
  /** the tooltip while disabled: what turns the slider on */
  disabledHint?: string;
  onBegin?: () => void;
  onChange: (value: number) => void;
};

/** the word under a box, where the full name is too long for one */
const SHORT: Record<string, string> = { distances: "Lengths", "light-graphics": "Simple" };

/** A slider that takes one undo snapshot per gesture, like the inspector's. */
function BoxSliderRow({ slider }: { slider: BoxSlider }) {
  const editing = useRef(false);
  const end = () => {
    editing.current = false;
  };
  const { label, icon, range, step = 0.05, value, disabled, disabledHint, onBegin, onChange } = slider;
  return (
    <label
      className={`showBoxes__slider${disabled ? " is-disabled" : ""}`}
      title={disabled ? `${label}: ${disabledHint}` : label}
    >
      <Icon name={icon} size={16} />
      <input
        className="builderSlider"
        type="range"
        aria-label={label}
        min={range[0]}
        max={range[1]}
        step={step}
        value={value}
        disabled={disabled}
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
        // the table's own keys (nudging, undo) stay out
        onKeyDown={(event) => {
          if (event.key !== "Escape") event.stopPropagation();
        }}
      />
      <span className="builderReadout">{percent(value)}</span>
    </label>
  );
}

/**
 * A menu of checkbox boxes with one roving tab stop: the arrows walk the row,
 * Home/End jump to its ends, Enter or Space toggles, Esc closes. `breakAfter`
 * puts the island's hairline after that many boxes.
 */
export function ShowBoxes({
  items,
  sliders,
  breakAfter,
  onClose,
}: {
  items: WheelItem[];
  sliders: BoxSlider[];
  breakAfter?: number;
  onClose: () => void;
}) {
  const [focus, setFocus] = useState(0);
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

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const onBox = refs.current.some((node) => node === event.target);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (!onBox) return;
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(focus + 1),
      ArrowDown: () => move(focus + 1),
      ArrowLeft: () => move(focus - 1),
      ArrowUp: () => move(focus - 1),
      Home: () => move(0),
      End: () => move(n - 1),
    };
    const run = keys[event.key];
    // Enter and Space click the box themselves; keep them, and the rest, off the table
    event.stopPropagation();
    if (!run) return;
    event.preventDefault();
    run();
  };

  return (
    <div className="showBoxes" onKeyDown={onKeyDown}>
      <div className="builderIsland showBoxes__row" role="menu" aria-label="Show" aria-orientation="horizontal">
        {items.map((item, i) => (
          <div key={item.id} className="showBoxes__cell">
            {breakAfter === i ? <span className="builderIsland__sep showBoxes__sep" aria-hidden="true" /> : null}
            <button
              ref={(node) => {
                refs.current[i] = node;
              }}
              type="button"
              role="menuitemcheckbox"
              aria-checked={item.on}
              aria-label={item.label}
              className={`builderIconBtn showBoxes__box${item.on ? " is-shown" : ""}`}
              tabIndex={i === focus ? 0 : -1}
              title={item.description}
              onFocus={() => setFocus(i)}
              onClick={() => {
                setFocus(i);
                item.onToggle();
              }}
            >
              <Icon name={item.on ? item.icon : (item.iconOff ?? item.icon)} />
              <span className="showBoxes__name" aria-hidden="true">
                {SHORT[item.id] ?? item.label}
              </span>
            </button>
          </div>
        ))}
      </div>
      {sliders.length ? (
        <div className="builderIsland showBoxes__sliders">
          {sliders.map((slider) => (
            <BoxSliderRow key={slider.id} slider={slider} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
