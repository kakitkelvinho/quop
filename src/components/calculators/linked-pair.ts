// Two linked fields, as in a unit converter: one per quantity, and typing in
// either rewrites the other. Pure, so the linking can be tested without React.
//
// Each field reads its text into a value both fields share (photon energy in
// joules, a time in seconds, a speed in km/h) and writes that value back out
// in its own quantity and unit. The field typed in last is the source: its
// text is kept exactly as typed, and the other field is worked out from it.

import { formatSignificant } from "./format-quantity.ts";
import { formatPace, formatSpeed, parsePace, speedToPace } from "./pace.ts";
import { parseFlexibleDecimal } from "./parse-flexible-decimal.ts";

export type Side = 0 | 1;

/** One field's quantity: its text to the shared value, or null, and back. */
export type Quantity = {
  read: (text: string) => number | null;
  write: (value: number) => string;
};

export type LinkedQuantities = readonly [Quantity, Quantity];

/** Which field is the source, and the text typed in it. */
export type LinkedPair = { source: Side; text: string };

export const otherSide = (side: Side): Side => (side === 0 ? 1 : 0);

/** Typing in a field makes it the source, with its text as typed. */
export function editField(side: Side, text: string): LinkedPair {
  return { source: side, text };
}

/**
 * Both fields' text: the source as typed, the other worked out from it, or
 * empty when the source doesn't read as a value.
 */
export function linkedTexts(pair: LinkedPair, quantities: LinkedQuantities): [string, string] {
  const value = quantities[pair.source].read(pair.text);
  const derived = value === null || !Number.isFinite(value) ? "" : quantities[otherSide(pair.source)].write(value);
  return pair.source === 0 ? [pair.text, derived] : [derived, pair.text];
}

/**
 * A field's unit changed from `before` to `after`. The physical quantity
 * stays: the source's number is re-expressed in the new unit (1 cm becomes
 * 10000 µm) and it stays the source. A worked-out field needs nothing here,
 * since it is written from the source in whatever unit it now has. Text that
 * doesn't read as a value is left as typed.
 */
export function changeUnit(pair: LinkedPair, side: Side, before: Quantity, after: Quantity): LinkedPair {
  if (side !== pair.source) return pair;
  const value = before.read(pair.text);
  if (value === null || !Number.isFinite(value)) return pair;
  return { source: side, text: trimZeros(after.write(value)) };
}

/** "10000.0" to "10000": a re-expressed number keeps no padding it wasn't typed with. */
function trimZeros(text: string) {
  return /^-?\d+\.\d+$/.test(text) ? text.replace(/\.?0+$/, "") : text;
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "⁻": "-",
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

/**
 * A number as typed, with either decimal mark, or as a field writes a large
 * or small one ("3.18 × 10⁻⁵"), so a worked-out value can be edited in place.
 */
export function readNumber(text: string): number | null {
  const normalized = text.replace(/\s*[×x]\s*10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*$/, (_, power: string) => {
    return `e${[...power].map((character) => SUPERSCRIPT_DIGITS[character]).join("")}`;
  });
  return parseFlexibleDecimal(normalized);
}

// Energy and wavelength: both are written as the photon's energy in joules.
const ELECTRON_VOLT = 1.602176634e-19;
const PLANCK_TIMES_C = 6.62607015e-34 * 299_792_458;

export const energyQuantity: Quantity = {
  read: (text) => {
    const electronVolts = readNumber(text);
    return electronVolts !== null && electronVolts > 0 ? electronVolts * ELECTRON_VOLT : null;
  },
  write: (joules) => formatSignificant(joules / ELECTRON_VOLT, 5),
};

export const wavelengthQuantity: Quantity = {
  read: (text) => {
    const nanometres = readNumber(text);
    return nanometres !== null && nanometres > 0 ? PLANCK_TIMES_C / (nanometres * 1e-9) : null;
  },
  write: (joules) => formatSignificant(PLANCK_TIMES_C / joules / 1e-9, 5),
};

// Light travel: both are written as a time in seconds.
export type TimeUnit = "fs" | "ps" | "ns" | "us" | "ms" | "s";
export type DistanceUnit = "nm" | "um" | "mm" | "cm" | "m";

export const SPEED_OF_LIGHT = 299_792_458;

export const TIME_UNITS: Record<TimeUnit, number> = {
  fs: 1e-15,
  ps: 1e-12,
  ns: 1e-9,
  us: 1e-6,
  ms: 1e-3,
  s: 1,
};

export const DISTANCE_UNITS: Record<DistanceUnit, number> = {
  nm: 1e-9,
  um: 1e-6,
  mm: 1e-3,
  cm: 1e-2,
  m: 1,
};

/** The units as written for reading: "um" and "us" are typed for ease, shown as µm and µs. */
export const unitLabel = (unit: string) => unit.replace(/^u/, "µ");

export function timeQuantity(unit: TimeUnit): Quantity {
  return {
    read: (text) => {
      const time = readNumber(text);
      return time !== null && time >= 0 ? time * TIME_UNITS[unit] : null;
    },
    write: (seconds) => formatSignificant(seconds / TIME_UNITS[unit], 6),
  };
}

export function distanceQuantity(unit: DistanceUnit): Quantity {
  return {
    read: (text) => {
      const distance = readNumber(text);
      return distance !== null && distance >= 0 ? (distance * DISTANCE_UNITS[unit]) / SPEED_OF_LIGHT : null;
    },
    write: (seconds) => formatSignificant((seconds * SPEED_OF_LIGHT) / DISTANCE_UNITS[unit], 6),
  };
}

// Pace: both are written as a speed in km/h.
export const paceQuantity: Quantity = {
  read: parsePace,
  write: (kmPerHour) => {
    const pace = speedToPace(kmPerHour);
    return pace === null ? "" : formatPace(pace);
  },
};

export const speedQuantity: Quantity = {
  read: (text) => {
    const kmPerHour = parseFlexibleDecimal(text);
    return kmPerHour !== null && kmPerHour > 0 ? kmPerHour : null;
  },
  write: formatSpeed,
};
