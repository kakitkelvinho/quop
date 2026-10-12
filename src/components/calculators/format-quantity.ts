// Calculator answers, written for reading at a glance: a few significant
// figures, plain decimals over exponents, and an SI prefix where the unit takes one.

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** From 1e-4 to below 1e9 a value is written out in full; beyond that, as a × 10ⁿ. */
const PLAIN_RANGE = [1e-4, 1e9] as const;

/**
 * `value` to `figures` significant figures. Inside PLAIN_RANGE it is a plain
 * decimal ("0.0318", "1033.2", "299790000"); outside it, "3.18 × 10⁻⁵".
 */
export function formatSignificant(value: number, figures: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const magnitude = Math.abs(value);
  if (magnitude < PLAIN_RANGE[0] || magnitude >= PLAIN_RANGE[1]) {
    const [mantissa, exponent] = value.toExponential(figures - 1).split("e");
    const power = String(Number(exponent))
      .split("")
      .map((character) => SUPERSCRIPT[character])
      .join("");
    return `${mantissa} × 10${power}`;
  }
  const decimals = figures - 1 - Math.floor(Math.log10(magnitude));
  if (decimals >= 0) return value.toFixed(decimals);
  const step = 10 ** -decimals;
  return (Math.round(value / step) * step).toFixed(0);
}

const PREFIXES = [
  { power: -15, symbol: "f" },
  { power: -12, symbol: "p" },
  { power: -9, symbol: "n" },
  { power: -6, symbol: "µ" },
  { power: -3, symbol: "m" },
  { power: 0, symbol: "" },
  { power: 3, symbol: "k" },
  { power: 6, symbol: "M" },
  { power: 9, symbol: "G" },
] as const;

/**
 * `value`, in `unit`, scaled to the SI prefix that puts it between 1 and 1000
 * and written to `figures` significant figures: 1.0e-3 J is "1.00" "mJ".
 */
export function formatPrefixed(value: number, unit: string, figures = 3): { value: string; unit: string } {
  if (!Number.isFinite(value)) return { value: "—", unit };
  if (value === 0) return { value: "0", unit };
  const power = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
  const prefix = PREFIXES.find((entry) => entry.power === power);
  if (!prefix) return { value: formatSignificant(value, figures), unit };
  const scaled = value / 10 ** prefix.power;
  // rounding can carry 999.6 up to 1000: move to the next prefix then
  const written = formatSignificant(scaled, figures);
  const next = PREFIXES.find((entry) => entry.power === power + 3);
  if (Math.abs(Number(written)) >= 1000 && next) {
    return { value: formatSignificant(Number(written) / 1000, figures), unit: `${next.symbol}${unit}` };
  }
  return { value: written, unit: `${prefix.symbol}${unit}` };
}
