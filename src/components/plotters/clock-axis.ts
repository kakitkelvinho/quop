// An x axis of clock time: values are seconds from the first reading's
// midnight (see parseClockCell), shown as 11:48, 23:00, 00:00 +1d, ...

const DAY = 24 * 3600;

// tick steps a clock reads well at, in seconds
const STEPS = [
  1, 2, 5, 10, 15, 30,
  60, 120, 300, 600, 900, 1800,
  3600, 7200, 10800, 21600, 43200,
  DAY,
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Writes seconds as a clock time, HH:MM, or HH:MM:SS `withSeconds`, with
 * "+1d", "+2d", ... once past the first midnight.
 */
export function formatClock(seconds: number, withSeconds = false): string {
  const day = Math.floor(seconds / DAY);
  const rest = seconds - day * DAY;
  const hours = Math.floor(rest / 3600);
  const minutes = Math.floor((rest % 3600) / 60);
  const secondsOfMinute = rest % 60;
  // drop fractional seconds' trailing zeros, keep up to milliseconds
  const fraction = (secondsOfMinute % 1).toFixed(3).slice(1).replace(/\.?0+$/, "");
  const secondsText = `${pad(Math.floor(secondsOfMinute))}${fraction}`;
  const time = `${pad(hours)}:${pad(minutes)}${withSeconds ? `:${secondsText}` : ""}`;

  return day > 0 ? `${time} +${day}d` : time;
}

// True when some reading falls between whole minutes.
export function hasSeconds(values: number[]): boolean {
  return values.some((value) => Number.isFinite(value) && value % 60 !== 0);
}

/**
 * Ticks for a clock axis from `min` to `max`: on whole steps of the clock
 * (10 s, 5 min, 1 h, ...), at most about `maxCount` of them.
 */
export function clockTicks(min: number, max: number, maxCount = 8): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [];
  }

  const span = max - min;
  const step =
    STEPS.find((candidate) => span / candidate <= maxCount) ??
    DAY * Math.ceil(span / DAY / maxCount);
  const ticks: number[] = [];

  for (let tick = Math.ceil(min / step) * step; tick <= max; tick += step) {
    ticks.push(tick);
  }

  return ticks;
}
