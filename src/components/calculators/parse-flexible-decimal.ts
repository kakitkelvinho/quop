"use client";

export function parseFlexibleDecimal(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const compact = trimmed.replace(/\s+/g, "");
  const commaIndex = compact.lastIndexOf(",");
  const dotIndex = compact.lastIndexOf(".");
  const decimalIndex = Math.max(commaIndex, dotIndex);

  if (decimalIndex === -1) {
    const integerOnly = compact.replace(/[,.]/g, "");

    if (!/^[+-]?\d+$/.test(integerOnly)) {
      return null;
    }

    const numeric = Number(integerOnly);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const integerPart = compact.slice(0, decimalIndex).replace(/[,.]/g, "");
  const fractionPart = compact.slice(decimalIndex + 1).replace(/[,.]/g, "");
  const normalized = `${integerPart || "0"}.${fractionPart}`;

  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}
