"use client";

// PROTOTYPE (prototype/status-row-fade): the Show wheel as a square plate, to
// compare against the half ring. Same items, same keys, straight sliders.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Icon } from "@/components/builder/builder-icons";
import { percent, type DialRange } from "@/components/builder/rim-dial";
import type { WheelItem } from "@/components/builder/show-wheel";

export type PlateSlider = {
  id: string;
  label: string;
  range: DialRange;
  step?: number;
  value: number;
  disabled?: boolean;
  /** the tooltip while disabled: what turns the slider on */
  disabledHint?: string;
  onBegin?: () => void;
  onChange: (value: number) => void;
};

/** A slider that takes one undo snapshot per gesture, like the inspector's. */
function PlateSliderRow({ slider }: { slider: PlateSlider }) {
  const editing = useRef(false);
  const end = () => {
    editing.current = false;
  };
  const { label, range, step = 0.05, value, disabled, disabledHint, onBegin, onChange } = slider;
  return (
    <label className={`showPlate__slider${disabled ? " is-disabled" : ""}`} title={disabled ? disabledHint : undefined}>
      <span className="showPlate__sliderHead">
        <span>{label}</span>
        <span className="builderReadout">{percent(value)}</span>
      </span>
      <input
        className="builderSlider"
        type="range"
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
        // the table's own keys (nudging, undo) stay out of the plate
        onKeyDown={(event) => {
          if (event.key !== "Escape") event.stopPropagation();
        }}
      />
    </label>
  );
}

/**
 * The Show plate: a square sign that drops from the eye, one row per item
 * (pictogram, name, a state square), a hairline, then the sliders. A menu of
 * checkbox items with one roving tab stop: Up/Down walk the rows, Home/End
 * jump to the ends, Enter or Space toggles, Esc closes. `breakAfter` puts a
 * hairline after that many rows.
 */
export function ShowPlate({
  items,
  sliders,
  breakAfter,
  onClose,
}: {
  items: WheelItem[];
  sliders: PlateSlider[];
  breakAfter?: number;
  onClose: () => void;
}) {
  const [focus, setFocus] = useState(0);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = items.length;

  useEffect(() => {
    rowRefs.current[0]?.focus();
  }, []);

  const move = (to: number) => {
    const next = (to + n) % n;
    setFocus(next);
    rowRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const onRow = rowRefs.current.some((node) => node === event.target);
    if (!onRow && event.key !== "Escape") return;
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(focus + 1),
      ArrowUp: () => move(focus - 1),
      Home: () => move(0),
      End: () => move(n - 1),
      Escape: onClose,
    };
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    run();
  };

  return (
    <div className="showPlate" onKeyDown={onKeyDown}>
      <div role="menu" aria-label="Show" className="showPlate__rows">
        {items.map((item, i) => (
          <div key={item.id} className="showPlate__rowWrap">
            {breakAfter === i ? <hr className="showPlate__rule" /> : null}
            <button
              ref={(node) => {
                rowRefs.current[i] = node;
              }}
              type="button"
              role="menuitemcheckbox"
              aria-checked={item.on}
              className={`showPlate__row${item.on ? " is-on" : ""}`}
              tabIndex={i === focus ? 0 : -1}
              title={item.description}
              onFocus={() => setFocus(i)}
              onClick={() => {
                setFocus(i);
                item.onToggle();
              }}
              onKeyDown={(event) => {
                // a button would also click on Enter/Space: toggle once, and keep the table out
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  item.onToggle();
                }
              }}
            >
              <span className="showPlate__icon">
                <Icon name={item.on ? item.icon : (item.iconOff ?? item.icon)} size={18} />
              </span>
              <span className="showPlate__name">{item.label}</span>
              <span className="showPlate__state" aria-hidden="true">
                {item.on ? <Icon name="check" size={12} /> : null}
              </span>
            </button>
          </div>
        ))}
      </div>
      {sliders.length ? (
        <div className="showPlate__sliders">
          <hr className="showPlate__rule" />
          {sliders.map((slider) => (
            <PlateSliderRow key={slider.id} slider={slider} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
