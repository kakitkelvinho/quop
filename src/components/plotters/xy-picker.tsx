"use client";

import { useState } from "react";

import { ROW_NUMBER, addY, toggleY } from "@/components/plotters/xy-selection";

// a list longer than this gets a filter and All / None
const MANY = 12;
// and draws at most this many rows, the rest found by filtering
const SHOWN = 60;

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
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? candidates.filter((index) => headers[index].toLowerCase().includes(needle))
    : candidates;
  const shown = matches.slice(0, SHOWN);
  const hidden = matches.length - shown.length;
  const plottedSet = new Set(plotted);

  return (
    <div className="xyPicker">
      <div className="xyPicker__root">
        <span className="xyPicker__axis">X</span>
        <select
          aria-label="X axis"
          className="xyPicker__select"
          onChange={(event) => onX(Number(event.target.value))}
          value={x}
        >
          <option value={ROW_NUMBER}>Row number</option>
          {headers.map((header, index) => (
            <option key={`${header}-${index}`} value={index}>
              {header}
            </option>
          ))}
        </select>
      </div>
      <div className="xyPicker__branch">
        <span className="xyPicker__axis">Y</span>
        {candidates.length > MANY ? (
          <div className="xyPicker__tools">
            <div className="field__control xyPicker__filter">
              <input
                aria-label={`Filter ${noun}`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Filter ${candidates.length} ${noun}`}
                type="search"
                value={query}
              />
            </div>
            <span className="xyPicker__count">
              {plotted.length} of {candidates.length}
            </span>
            <button className="xyPicker__quiet" onClick={() => onY(addY(plotted, matches))} type="button">
              All{needle ? " shown" : ""}
            </button>
            <button className="xyPicker__quiet" onClick={() => onY([])} type="button">
              None
            </button>
          </div>
        ) : null}
        <ul className="xyPicker__spine" aria-label={`Y ${noun}`}>
          {shown.map((index) => (
            <li key={`${headers[index]}-${index}`}>
              <label className="xyPicker__check">
                <input
                  checked={plottedSet.has(index)}
                  onChange={(event) => onY(toggleY(plotted, index, event.target.checked))}
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
