import type { Hdu, HeaderCard, HeaderValue } from "@fits-js/core";

export type ShownValue = { kind: "text"; text: string } | { kind: "notRecorded"; raw: string };

export type HeaderChip = { label: string; value: ShownValue; hint: string };

export type HeaderRow =
  | { kind: "card"; keyword: string; value: ShownValue; comment: string; card: string }
  | { kind: "text"; keyword: string; text: string; card: string };

export type HeaderSection = { title: string; rows: readonly HeaderRow[] };

export type FitsHeaderInfo = { chips: readonly HeaderChip[]; sections: readonly HeaderSection[] };

type ChipSpec = {
  keywords: readonly string[];
  label: string;
  unit?: string;
  format: (values: readonly HeaderValue[]) => string;
};

const single = ([value]: readonly HeaderValue[]) => formatValue(value);

const CHIP_REGISTRY: readonly ChipSpec[] = [
  { keywords: ["EXPOSURE"], label: "Exposure", unit: "s", format: single },
  { keywords: ["GAIN"], label: "Gain", format: single },
  { keywords: ["EMREALGN"], label: "EM gain", format: single },
  { keywords: ["HBIN", "VBIN"], label: "Binning", format: (values) => values.map(formatValue).join("×") },
  { keywords: ["ACQMODE"], label: "Acquisition", format: single },
  { keywords: ["READMODE"], label: "Readout", format: single },
  { keywords: ["TRIGGER"], label: "Trigger", format: single },
  { keywords: ["TEMP"], label: "Temperature", unit: "°C", format: single },
  { keywords: ["SUBRECT"], label: "Subimage", format: single },
];

export function sentinel(value: HeaderValue) {
  return value === -999 || value === "";
}

export function formatValue(value: HeaderValue) {
  if (value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "T" : "F";
  }

  if (typeof value === "object") {
    return `(${value.real}, ${value.imag})`;
  }

  return String(value);
}

function rawValue(value: HeaderValue) {
  return typeof value === "string" ? `'${value}'` : formatValue(value);
}

export function headerChips(cards: readonly HeaderCard[]): HeaderChip[] {
  const byKeyword = new Map<string, HeaderCard>();

  for (const card of cards) {
    if (!card.commentary && !byKeyword.has(card.keyword)) {
      byKeyword.set(card.keyword, card);
    }
  }

  return CHIP_REGISTRY.flatMap((spec): HeaderChip[] => {
    const found = spec.keywords.flatMap((keyword) => byKeyword.get(keyword) ?? []);

    if (found.length < spec.keywords.length) {
      return [];
    }

    const values = found.map((card) => card.value);
    const hint = `${spec.keywords.join("×")}: ${found.map((card) => card.comment ?? "").join(", ")}`;

    if (values.some(sentinel)) {
      const raw = values.map(rawValue).join("×");
      return [{ label: spec.label, value: { kind: "notRecorded", raw }, hint: `${hint} (raw value ${raw})` }];
    }

    const text = spec.unit ? `${spec.format(values)} ${spec.unit}` : spec.format(values);
    return [{ label: spec.label, value: { kind: "text", text }, hint }];
  });
}

export function headerRows(cards: readonly HeaderCard[]): HeaderRow[] {
  return cards.flatMap((card): HeaderRow[] => {
    if (!card.commentary) {
      const value: ShownValue = sentinel(card.value)
        ? { kind: "notRecorded", raw: rawValue(card.value) }
        : { kind: "text", text: formatValue(card.value) };
      return [{ kind: "card", keyword: card.keyword, value, comment: card.comment ?? "", card: card.raw }];
    }

    const text = card.raw.slice(8).trim();
    return card.keyword === "" && text === "" ? [] : [{ kind: "text", keyword: card.keyword, text, card: card.raw }];
  });
}

function searchText(row: HeaderRow) {
  if (row.kind === "text") {
    return `${row.keyword} ${row.text}`;
  }

  const value = row.value.kind === "text" ? row.value.text : `not recorded ${row.value.raw}`;
  return `${row.keyword} ${value} ${row.comment}`;
}

export function rowMatches(row: HeaderRow, query: string) {
  return searchText(row).toLowerCase().includes(query.trim().toLowerCase());
}

type HeaderHdu = Pick<Hdu, "index" | "type" | "name"> & { header: { cards: readonly HeaderCard[] } };

export function headerSections(hdus: readonly HeaderHdu[], plotted: HeaderHdu): HeaderSection[] {
  const rows = headerRows(plotted.header.cards);

  if (plotted.type === "primary") {
    return [{ title: "Primary header", rows }];
  }

  const name = plotted.name ? ` (${plotted.name})` : "";
  const primary = hdus.find((hdu) => hdu.type === "primary");

  return [
    { title: `Image extension ${plotted.index}${name}`, rows },
    ...(primary ? [{ title: "Primary header", rows: headerRows(primary.header.cards) }] : []),
  ];
}
