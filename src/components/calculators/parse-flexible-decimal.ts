export type FlexibleDecimal = {
  value: number;
  /** How an ambiguous input was read, for showing next to the field. */
  note: string | null;
};

type Mantissa = {
  digits: string;
  note: "grouping" | "decimal" | null;
};

// An integer written with one grouping separator: 1,000,000 or 1.000.000.
function groupedInteger(text: string, separator: string) {
  const groups = text.split(separator);
  const [head, ...rest] = groups;

  if (!/^\d{1,3}$/.test(head) || rest.some((group) => !/^\d{3}$/.test(group))) {
    return null;
  }

  return groups.join("");
}

function readMantissa(text: string): Mantissa | null {
  const commas = text.split(",").length - 1;
  const dots = text.split(".").length - 1;

  if (commas === 0 && dots === 0) {
    return /^\d+$/.test(text) ? { digits: text, note: null } : null;
  }

  // Both present: the last one is the decimal mark, the other groups.
  if (commas > 0 && dots > 0) {
    const decimalMark = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const groupMark = decimalMark === "," ? "." : ",";

    if ((decimalMark === "," ? commas : dots) !== 1) {
      return null;
    }

    const [integerText, fraction] = text.split(decimalMark);
    const integer = groupedInteger(integerText, groupMark);

    if (integer === null || !/^\d+$/.test(fraction)) {
      return null;
    }

    return { digits: `${integer}.${fraction}`, note: null };
  }

  const separator = commas > 0 ? "," : ".";

  // One separator, repeated: it groups.
  if (commas > 1 || dots > 1) {
    const integer = groupedInteger(text, separator);
    return integer === null ? null : { digits: integer, note: null };
  }

  const [integer, fraction] = text.split(separator);

  if (!/^\d*$/.test(integer) || !/^\d+$/.test(fraction)) {
    return null;
  }

  // A lone separator before exactly three digits could be either. A comma
  // after a non-zero integer part groups (1,064 is 1064); a dot stays a
  // decimal point (1.064), since that is how numbers are written in physics.
  const ambiguous = fraction.length === 3 && /^[1-9]\d{0,2}$/.test(integer);

  if (ambiguous && separator === ",") {
    return { digits: `${integer}${fraction}`, note: "grouping" };
  }

  return {
    digits: `${integer || "0"}.${fraction}`,
    note: ambiguous ? "decimal" : null,
  };
}

/**
 * Reads a number typed with either a decimal comma or a decimal point, with
 * optional grouping (1,000,000 / 1.000.000 / 1 000 000) and an exponent (1e6).
 * Returns null when the text isn't a finite number.
 */
export function readFlexibleDecimal(value: string): FlexibleDecimal | null {
  const compact = value.replace(/\s+/g, "");
  const match = /^([+-]?)([\d.,]+)(?:[eE]([+-]?\d+))?$/.exec(compact);

  if (!match) {
    return null;
  }

  const [, sign, mantissaText, exponent] = match;
  const mantissa = readMantissa(mantissaText);

  if (!mantissa) {
    return null;
  }

  const numeric = Number(`${sign}${mantissa.digits}${exponent ? `e${exponent}` : ""}`);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  const note =
    mantissa.note === "grouping"
      ? `Read as ${numeric} (comma as thousands separator).`
      : mantissa.note === "decimal"
        ? `Read as ${numeric} (dot as decimal point).`
        : null;

  return { value: numeric, note };
}

export function parseFlexibleDecimal(value: string) {
  return readFlexibleDecimal(value)?.value ?? null;
}
