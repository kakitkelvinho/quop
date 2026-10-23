"use client";

import { useMemo, useState } from "react";

import {
  DEFAULT_PLOTTED,
  PLOTTED_LIMIT,
  ROW_NUMBER,
  addY,
  limitY,
  toggleY,
} from "@/components/plotters/xy-selection";

// a list longer than this gets a filter and All / None
const MANY = 12;
// and draws at most this many rows, the rest found by filtering
const SHOWN = 60;
// an X list longer than this is drawn only while the select is in use:
// thousands of options slow every layout of the page
const X_OPTIONS_AT_REST = 200;

/**
 * The generic CSV plotter's X / Y picker, drawn as a tree: X is the root,
 * flush left, one select like a calculator's unit picker. Every Y hangs
 * beneath it one indent in, on a hairline spine, so the indent itself says
 * "plotted against the line above".
 */
export function XYPicker({
  headers,
  noun,
  x,
  candidates,
  plotted,
  onX,
  onY,
}: {
  headers: string[];
  /** what the Ys are: "columns" or "series" */
  noun: string;
  x: number;
  /** the columns that can be Y */
  candidates: number[];
  /** the Ys plotted now */
  plotted: number[];
  onX: (index: number) => void;
  onY: (indexes: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  // a choice past the plotting limit was cut short
  const [limited, setLimited] = useState(false);
  const [xInUse, setXInUse] = useState(false);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? candidates.filter((index) => headers[index].toLowerCase().includes(needle))
    : candidates;
  const shown = matches.slice(0, SHOWN);
  const hidden = matches.length - shown.length;
  const plottedSet = new Set(plotted);
  // read by rows, a file can have thousands of series to list as X; at
  // rest, only the one chosen is drawn
  const xListed = xInUse || headers.length <= X_OPTIONS_AT_REST;
  const xOptions = useMemo(
    () =>
      (xListed ? headers.map((_, index) => index) : x === ROW_NUMBER ? [] : [x]).map(
        (index) => (
          <option key={`${headers[index]}-${index}`} value={index}>
            {headers[index]}
          </option>
        ),
      ),
    [headers, x, xListed],
  );

  function choose(next: number[]) {
    const result = limitY(plotted, next);
    setLimited(result.limited);
    onY(result.plotted);
  }

  return (
    <div className="xyPicker">
      <div className="xyPicker__root">
        <span className="xyPicker__axis">X</span>
        <select
          aria-label="X axis"
          className="xyPicker__select"
          onBlur={() => setXInUse(false)}
          onChange={(event) => onX(Number(event.target.value))}
          onFocus={() => setXInUse(true)}
          onPointerDown={() => setXInUse(true)}
          value={x}
        >
          <option value={ROW_NUMBER}>Row number</option>
          {xOptions}
        </select>
      </div>
      <div className="xyPicker__branch">
        <span className="xyPicker__axis">Y</span>
        {candidates.length > DEFAULT_PLOTTED ? (
          <div className="xyPicker__tools">
            {candidates.length > MANY ? (
              <div className="field__control xyPicker__filter">
                <input
                  aria-label={`Filter ${noun}`}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Filter ${candidates.length} ${noun}`}
                  type="search"
                  value={query}
                />
              </div>
            ) : null}
            <span className="xyPicker__count">
              {plotted.length} of {candidates.length} plotted
            </span>
            {candidates.length > MANY ? (
              <>
                <button
                  className="xyPicker__quiet"
                  onClick={() => choose(addY(plotted, matches))}
                  type="button"
                >
                  All{needle ? " shown" : ""}
                </button>
                <button className="xyPicker__quiet" onClick={() => choose([])} type="button">
                  None
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        {limited ? (
          <p className="xyPicker__note">
            Plotting is limited to {PLOTTED_LIMIT} series; filter to choose.
          </p>
        ) : null}
        <ul className="xyPicker__spine" aria-label={`Y ${noun}`}>
          {shown.map((index) => (
            <li key={`${headers[index]}-${index}`}>
              <label className="xyPicker__check">
                <input
                  checked={plottedSet.has(index)}
                  onChange={(event) => choose(toggleY(plotted, index, event.target.checked))}
                  type="checkbox"
                />
                <span>{headers[index]}</span>
              </label>
            </li>
          ))}
        </ul>
        {hidden > 0 ? (
          <p className="xyPicker__note">and {hidden} more: filter to find them</p>
        ) : null}
      </div>
    </div>
  );
}
