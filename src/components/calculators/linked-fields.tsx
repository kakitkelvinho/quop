"use client";

import { useEffect, useId, useRef, useState } from "react";

import { DecimalNote } from "@/components/calculators/decimal-note";
import {
  linkedTexts,
  otherSide,
  type LinkedPair,
  type Quantity,
  type Side,
} from "@/components/calculators/linked-pair";
import { readFlexibleDecimal } from "@/components/calculators/parse-flexible-decimal";

export type LinkedField = {
  label: string;
  quantity: Quantity;
  /** The unit as read, beside the number and in the announcement. */
  unit: string;
  /** A picker in place of the fixed unit: its choices and how to change it. */
  units?: {
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (value: string) => void;
  };
  /** Pace takes `4:30`, which a decimal keypad can't type. */
  inputMode?: "decimal" | "text";
  /** Whether to say how an ambiguous number was read, under the field. */
  decimalNote?: boolean;
};

/** How long typing has to pause before the worked-out field is announced. */
const ANNOUNCE_DELAY_MS = 700;

/**
 * Two fields, one per quantity, linked as in a unit converter: the field
 * typed in last is the source and is kept as typed; the other is worked out
 * from it, or left empty with a dash when the source isn't a value.
 */
export function LinkedFields({
  pair,
  onEdit,
  fields,
}: {
  pair: LinkedPair;
  onEdit: (side: Side, text: string) => void;
  fields: readonly [LinkedField, LinkedField];
}) {
  const id = useId();
  const texts = linkedTexts(pair, [fields[0].quantity, fields[1].quantity]);
  const derived = otherSide(pair.source);
  const derivedField = fields[derived];
  const message = texts[derived]
    ? `${derivedField.label} ${texts[derived]} ${derivedField.unit}`
    : `${derivedField.label}: no value`;

  // Announce the worked-out field once typing pauses, and only after the
  // reader has changed something: not on load, not on every keystroke.
  const [announcement, setAnnouncement] = useState("");
  const touched = useRef(false);

  useEffect(() => {
    if (!touched.current) return;
    const timer = window.setTimeout(() => setAnnouncement(message), ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <div className="linkedFields">
      {fields.map((field, index) => {
        const side = index as Side;
        const inputId = `${id}-${index}`;
        const isSource = side === pair.source;

        return (
          <div className="field linkedField" key={field.label}>
            <label htmlFor={inputId}>{field.label}</label>
            <div className="field__control linkedField__control">
              <input
                id={inputId}
                type="text"
                inputMode={field.inputMode ?? "decimal"}
                autoComplete="off"
                spellCheck={false}
                value={texts[side]}
                placeholder={isSource ? undefined : "—"}
                onChange={(event) => {
                  touched.current = true;
                  onEdit(side, event.target.value);
                }}
              />
              {field.units ? (
                <select
                  className="linkedField__unit"
                  aria-label={`${field.label} unit`}
                  value={field.units.value}
                  onChange={(event) => {
                    touched.current = true;
                    field.units?.onChange(event.target.value);
                  }}
                >
                  {field.units.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="linkedField__unit">{field.unit}</span>
              )}
            </div>
            {isSource && field.decimalNote !== false ? (
              <DecimalNote reading={readFlexibleDecimal(texts[side])} />
            ) : null}
          </div>
        );
      })}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
