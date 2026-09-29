// Running pace (minutes and seconds per kilometre) and speed (km/h), as pure
// functions so the calculator's sums and rounding can be tested without React.

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
