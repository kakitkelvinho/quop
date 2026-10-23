"use client";

// PROTOTYPE (wayfinder #282): three X/Y series pickers for the generic CSV
// plotter, switched by ?variant= on /plotters/generic-csv-plotter/ in dev.
// Throwaway: the winner is rebuilt properly, the rest stay on the
// prototype/xy-picker branch. Not for main.

import { useState } from "react";

import styles from "./xy-picker.prototype.module.css";

export const XY_PICKER_VARIANTS = [
  { key: "A", name: "X as root, Y beneath" },
  { key: "B", name: "Outdent in place" },
  { key: "C", name: "Plot … against …" },
];

export const ROW_NUMBER = -1;

export type XYPickerProps = {
  headers: string[];
  layout: "columns" | "rows";
  xIndex: number;
  yIndexes: number[];
  onX: (index: number) => void;
  onYToggle: (index: number, checked: boolean) => void;
  onYSet: (indexes: number[]) => void;
};

export function XYPicker({ variant, ...props }: XYPickerProps & { variant: string }) {
  if (variant === "B") return <VariantB {...props} />;
  if (variant === "C") return <VariantC {...props} />;
  return <VariantA {...props} />;
}

// a list longer than this gets a filter and All / None
const MANY = 12;
// and draws at most this many rows, the rest found by filtering
const SHOWN = 60;

function useSeriesFilter(headers: string[], candidates: number[]) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? candidates.filter((index) => headers[index].toLowerCase().includes(needle))
    : candidates;
  return {
    many: candidates.length > MANY,
    query,
    setQuery,
    matches,
    shown: matches.slice(0, SHOWN),
    hidden: Math.max(0, matches.length - SHOWN),
  };
}

function SeriesTools({
  filter,
  selected,
  total,
  noun,
  onAll,
  onNone,
}: {
  filter: ReturnType<typeof useSeriesFilter>;
  selected: number;
  total: number;
  noun: string;
  onAll: () => void;
  onNone: () => void;
}) {
  if (!filter.many) return null;
  return (
    <div className={styles.tools}>
      <div className={`field__control ${styles.filter}`}>
        <input
          aria-label={`Filter ${noun}`}
          onChange={(event) => filter.setQuery(event.target.value)}
          placeholder={`Filter ${total} ${noun}`}
          type="search"
          value={filter.query}
        />
      </div>
      <span className={styles.count}>
        {selected} of {total}
      </span>
      <button className={styles.quiet} onClick={onAll} type="button">
        All{filter.query ? " shown" : ""}
      </button>
      <button className={styles.quiet} onClick={onNone} type="button">
        None
      </button>
    </div>
  );
}

function MoreNote({ hidden }: { hidden: number }) {
  return hidden ? <p className={styles.more}>and {hidden} more: filter to find them</p> : null;
}

function nameOf(headers: string[], index: number) {
  return index === ROW_NUMBER ? "Row number" : headers[index];
}

/* A: the user's sketch as a tree. X is the root, flush left: one field you
   pick from, like a unit picker. Every Y hangs beneath it, indented on a
   hairline spine, so the indent itself says "plotted against the line above". */
function VariantA(p: XYPickerProps) {
  const candidates = p.headers.map((_, i) => i).filter((i) => i !== p.xIndex);
  const filter = useSeriesFilter(p.headers, candidates);
  const noun = p.layout === "columns" ? "columns" : "series";

  return (
    <div className={styles.a}>
      <div className={styles.aRoot}>
        <span className={styles.axis}>x</span>
        <select
          aria-label="x axis"
          className={styles.select}
          onChange={(event) => p.onX(Number(event.target.value))}
          value={p.xIndex}
        >
          <option value={ROW_NUMBER}>Row number</option>
          {p.headers.map((header, index) => (
            <option key={`${header}-${index}`} value={index}>
              {header}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.aBranch}>
        <span className={styles.axis}>y</span>
        <SeriesTools
          filter={filter}
          noun={noun}
          onAll={() => p.onYSet([...new Set([...p.yIndexes, ...filter.matches])].sort((a, b) => a - b))}
          onNone={() => p.onYSet([])}
          selected={p.yIndexes.length}
          total={candidates.length}
        />
        <ul className={styles.spine}>
          {filter.shown.map((index) => (
            <li key={`${p.headers[index]}-${index}`}>
              <label className={styles.check}>
                <input
                  checked={p.yIndexes.includes(index)}
                  onChange={(event) => p.onYToggle(index, event.target.checked)}
                  type="checkbox"
                />
                <span>{p.headers[index]}</span>
              </label>
            </li>
          ))}
        </ul>
        <MoreNote hidden={filter.hidden} />
      </div>
    </div>
  );
}

/* B: the file's own order, and each name's position is its role. The X row
   steps out to the margin; every other row sits one indent in, its Y box in
   the indent. Pointing at a row shows the dot that makes it X. */
function VariantB(p: XYPickerProps) {
  const all = [ROW_NUMBER, ...p.headers.map((_, i) => i)];
  const filter = useSeriesFilter(
    p.headers,
    p.headers.map((_, i) => i).filter((i) => i !== p.xIndex),
  );
  // filtered, the X row and Row number stay, in the file's order
  const shown = filter.many
    ? [...new Set([ROW_NUMBER, p.xIndex, ...filter.shown])].sort((a, b) => a - b)
    : all;

  return (
    <div className={styles.b}>
      <div className={styles.bLegend} aria-hidden="true">
        <span>x</span>
        <span>y</span>
      </div>
      <SeriesTools
        filter={filter}
        noun={p.layout === "columns" ? "columns" : "series"}
        onAll={() => p.onYSet([...new Set([...p.yIndexes, ...filter.matches])].sort((a, b) => a - b))}
        onNone={() => p.onYSet([])}
        selected={p.yIndexes.length}
        total={p.headers.length - (p.xIndex === ROW_NUMBER ? 0 : 1)}
      />
      <div className={styles.bRows} role="group" aria-label="x and y">
        {shown.map((index) => {
          const isX = index === p.xIndex;
          return (
            <div
              className={`${styles.bRow} ${isX ? styles.bRowX : ""} ${!isX && index === ROW_NUMBER ? styles.bRowIdle : ""}`}
              key={index}
            >
              <input
                aria-label={`${nameOf(p.headers, index)} as x`}
                checked={isX}
                className={styles.bRadio}
                name="xy-picker-b-x"
                onChange={() => p.onX(index)}
                type="radio"
              />
              {isX || index === ROW_NUMBER ? (
                <span className={styles.bName}>{nameOf(p.headers, index)}</span>
              ) : (
                <label className={styles.check}>
                  <input
                    checked={p.yIndexes.includes(index)}
                    onChange={(event) => p.onYToggle(index, event.target.checked)}
                    type="checkbox"
                  />
                  <span>{p.headers[index]}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
      <MoreNote hidden={filter.hidden} />
    </div>
  );
}

/* C: the role is said in words. "Plot [y] [y] [+] against [x]": the Ys are
   chips you take off, the + opens a filtered list of the rest. */
function VariantC(p: XYPickerProps) {
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rest = p.headers.map((_, i) => i).filter((i) => i !== p.xIndex && !p.yIndexes.includes(i));
  const filter = useSeriesFilter(p.headers, rest);
  const chips = expanded ? p.yIndexes : p.yIndexes.slice(0, 8);

  return (
    <div className={styles.c}>
      <p className={styles.cSentence}>
        <span className={styles.cWord}>Plot</span>
        {chips.map((index) => (
          <span className={styles.chip} key={index}>
            {p.headers[index]}
            <button
              aria-label={`Remove ${p.headers[index]}`}
              className={styles.chipOff}
              onClick={() => p.onYToggle(index, false)}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </span>
        ))}
        {p.yIndexes.length > chips.length ? (
          <button className={styles.quiet} onClick={() => setExpanded(true)} type="button">
            and {p.yIndexes.length - chips.length} more
          </button>
        ) : null}
        {rest.length ? (
          <button
            aria-expanded={adding}
            className={`${styles.chip} ${styles.chipAdd}`}
            onClick={() => setAdding((open) => !open)}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </button>
        ) : null}
        <span className={styles.cWord}>against</span>
        <select
          aria-label="x axis"
          className={styles.select}
          onChange={(event) => p.onX(Number(event.target.value))}
          value={p.xIndex}
        >
          <option value={ROW_NUMBER}>Row number</option>
          {p.headers.map((header, index) => (
            <option key={`${header}-${index}`} value={index}>
              {header}
            </option>
          ))}
        </select>
      </p>
      {adding ? (
        <div className={styles.cMenu}>
          {rest.length > 6 ? (
            <div className={`field__control ${styles.filter}`}>
              <input
                aria-label="Filter"
                autoFocus
                onChange={(event) => filter.setQuery(event.target.value)}
                placeholder={`Filter ${rest.length}`}
                type="search"
                value={filter.query}
              />
            </div>
          ) : null}
          <ul>
            {filter.shown.map((index) => (
              <li key={index}>
                <button className={styles.cOption} onClick={() => p.onYToggle(index, true)} type="button">
                  {p.headers[index]}
                </button>
              </li>
            ))}
          </ul>
          <MoreNote hidden={filter.hidden} />
          {filter.matches.length > 1 ? (
            <button
              className={styles.quiet}
              onClick={() => p.onYSet([...new Set([...p.yIndexes, ...filter.matches])].sort((a, b) => a - b))}
              type="button"
            >
              Add all {filter.matches.length}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* Sample files to try each variant on. Synthetic look-alikes only: the
   user's lab file stays out of the repo. */
function headerlessCsv() {
  const rows: string[] = [];
  for (let i = 0; i < 400; i += 1) {
    const t = 21.3 + Math.sin(i / 60) * 0.4;
    const rh = 46 + Math.cos(i / 80) * 3;
    rows.push(
      [i + 1, t.toFixed(1), (9.2 + Math.sin(i / 30) * 0.2).toFixed(1), rh.toFixed(1), (70.3 - Math.sin(i / 50) * 2).toFixed(1), (48.6 + Math.cos(i / 45)).toFixed(1), (58 + Math.sin(i / 70) * 1.5).toFixed(1), (1.6 + Math.sin(i / 25) * 0.2).toFixed(2), (1013 + Math.cos(i / 90) * 4).toFixed(0)].join(","),
    );
  }
  return rows.join("\n");
}

function spectraCsv(count: number) {
  const wavelengths = Array.from({ length: 121 }, (_, i) => 400 + i * 2.5);
  const lines = [`timestamp,integration_ms,${wavelengths.join(",")}`];
  for (let s = 0; s < count; s += 1) {
    const centre = 520 + s * 1.5;
    lines.push(
      [
        `2026-10-01T10:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`,
        100,
        ...wavelengths.map((w) => (1000 * Math.exp(-(((w - centre) / 18) ** 2)) + 40).toFixed(1)),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function namedCsv() {
  const lines = ["position_mm,signal_a,signal_b,signal_c,reference,temperature_C"];
  for (let i = 0; i < 240; i += 1) {
    lines.push(
      [(i * 0.5).toFixed(2), (2 + Math.sin(i * 0.09) * 0.8).toFixed(4), (1.2 + Math.cos(i * 0.06 + 0.8) * 0.5).toFixed(4), (0.4 + Math.sin(i * 0.03) * 0.6).toFixed(4), "1.0000", (21 + i * 0.002).toFixed(3)].join(","),
    );
  }
  return lines.join("\n");
}

export const PROTOTYPE_SAMPLES = [
  { label: "Named columns", file: "prototype-named.csv", csv: namedCsv },
  { label: "Headerless (9 columns)", file: "prototype-headerless.csv", csv: headerlessCsv },
  { label: "By rows: 80 spectra", file: "prototype-spectra.csv", csv: () => spectraCsv(80) },
];

export function PrototypeSamples({ onPick }: { onPick: (csv: string, file: string) => void }) {
  return (
    <div className={styles.samples}>
      <span>Prototype samples</span>
      {PROTOTYPE_SAMPLES.map((sample) => (
        <button className={styles.quiet} key={sample.file} onClick={() => onPick(sample.csv(), sample.file)} type="button">
          {sample.label}
        </button>
      ))}
    </div>
  );
}
