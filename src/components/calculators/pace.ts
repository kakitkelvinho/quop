// Running pace (minutes and seconds per kilometre) and speed (km/h), as pure
// functions so the calculator's sums and rounding can be tested without React.

import { parseFlexibleDecimal } from "./parse-flexible-decimal.ts";

export type Pace = { minutes: number; seconds: number };

/** Speed in km/h for a pace, or null unless the pace is above zero. */
export function paceToSpeed(minutes: number, seconds: number): number | null {
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0) {
    return null;
  }

  const minutesPerKm = minutes + seconds / 60;
  return minutesPerKm > 0 ? 60 / minutesPerKm : null;
}

/**
 * Pace for a speed in km/h, rounded to the whole second, or null unless the
 * speed is above zero. A pace that rounds to 60 seconds carries a minute.
 */
export function speedToPace(kmPerHour: number): Pace | null {
  if (!Number.isFinite(kmPerHour) || kmPerHour <= 0) {
    return null;
  }

  const totalSeconds = Math.round((60 / kmPerHour) * 60);
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
}

/** Speed to two decimals, without trailing zeros: 13.33, 12.5, 12. */
export function formatSpeed(kmPerHour: number): string {
  return String(Number(kmPerHour.toFixed(2)));
}

/** A pace as written on a watch: 4:30, 5:05. */
export function formatPace(pace: Pace): string {
  return `${pace.minutes}:${String(pace.seconds).padStart(2, "0")}`;
}

/**
 * Speed in km/h for a pace as typed, `m:ss` (4:30) or decimal minutes (4.5,
 * or 4,5), or null unless it is a pace above zero. In `m:ss` the seconds stay
 * under 60, as on a watch.
 */
export function parsePace(text: string): number | null {
  const clock = /^\s*(\d+)\s*:\s*(\d{1,2}(?:[.,]\d+)?)\s*$/.exec(text);

  if (clock) {
    const seconds = Number(clock[2].replace(",", "."));
    return seconds < 60 ? paceToSpeed(Number(clock[1]), seconds) : null;
  }

  if (text.includes(":")) {
    return null;
  }

  const minutes = parseFlexibleDecimal(text);
  return minutes === null ? null : paceToSpeed(minutes, 0);
}
