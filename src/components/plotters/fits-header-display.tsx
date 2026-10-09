"use client";

import { useState, type ReactNode } from "react";

import { rowMatches, type FitsHeaderInfo, type HeaderSection } from "@/components/plotters/fits-header";

type CopyState = "idle" | "copied" | "failed";

const COPY_TEXT: Record<CopyState, string> = { idle: "Copy", copied: "Copied", failed: "Copy failed" };

function CopyButton({ context, idleText = COPY_TEXT.idle, text }: { context: string; idleText?: string; text: string }) {
  const [state, setState] = useState<CopyState>("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }

    window.setTimeout(() => setState("idle"), 1500);
  }

  return (
    <button className="fitsFullHeader__copy" type="button" onClick={() => void copy()}>
      {state === "idle" ? idleText : COPY_TEXT[state]}
      <span className="sr-only"> {context}</span>
    </button>
  );
}

function NotRecorded() {
  return <span className="fitsHeaderNotRecorded">not recorded</span>;
}

function SectionTable({ query, section }: { query: string; section: HeaderSection }) {
  const rows = section.rows.flatMap((row, line) => (rowMatches(row, query) ? [{ line, row }] : []));

  return (
    <section className="fitsFullHeader__section">
      <div className="fitsFullHeader__sectionHead">
        <h3>{section.title}</h3>
        <CopyButton
          idleText="Copy all"
          context={`${section.rows.length} cards of the ${section.title.toLowerCase()}`}
          text={section.rows.map((row) => row.card).join("\n")}
        />
      </div>
      {rows.length ? (
        <table className="fitsFullHeader__table">
          <thead>
            <tr>
              <th scope="col">Keyword</th>
              <th scope="col">Value</th>
              <th scope="col">Comment</th>
              <th scope="col">
                <span className="sr-only">Copy card</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ line, row }) => (
              <tr className={row.kind === "text" ? "fitsFullHeader__textRow" : undefined} key={line}>
                <th scope="row">{row.keyword}</th>
                {row.kind === "text" ? (
                  <td className="fitsFullHeader__text" colSpan={2}>
                    {row.text}
                  </td>
                ) : (
                  <>
                    <td
                      className="fitsFullHeader__value"
                      title={row.value.kind === "notRecorded" ? `Raw value ${row.value.raw}` : undefined}
                    >
                      {row.value.kind === "text" ? row.value.text : <NotRecorded />}
                    </td>
                    <td className="fitsFullHeader__comment">{row.comment}</td>
                  </>
                )}
                <td className="fitsFullHeader__copyCell">
                  <CopyButton context={`the ${row.keyword || "untitled"} card`} text={row.card} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="fitsFullHeader__empty">No cards match.</p>
      )}
    </section>
  );
}

function FullHeader({ header }: { header: FitsHeaderInfo }) {
  const [query, setQuery] = useState("");
  const total = header.sections.reduce((count, section) => count + section.rows.length, 0);
  const matching = header.sections.reduce(
    (count, section) => count + section.rows.filter((row) => rowMatches(row, query)).length,
    0,
  );

  return (
    <details className="fitsFullHeader">
      <summary>
        Full header <span className="fitsFullHeader__count">{total} cards</span>
      </summary>
      <div className="fitsFullHeader__body">
        <label className="field fitsFullHeader__filter">
          <span className="sr-only">Filter the header</span>
          <span className="field__control">
            <input
              placeholder="Filter by keyword, value or comment"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <p aria-live="polite" className="fitsFullHeader__count">
          {query.trim() ? `${matching} of ${total} cards match` : null}
        </p>
        {header.sections.map((section) => (
          <SectionTable key={section.title} query={query} section={section} />
        ))}
      </div>
    </details>
  );
}

export default function FitsHeaderDisplay({ children, header }: { children: ReactNode; header: FitsHeaderInfo | null }) {
  if (!header) {
    return children;
  }

  return (
    <>
      {header.chips.length ? (
        <ul aria-label="Camera settings from the FITS header" className="fitsHeaderChips">
          {header.chips.map((chip) => (
            <li className="fitsHeaderChip" key={chip.label} title={chip.hint}>
              <span className="fitsHeaderChip__label">{chip.label}</span>
              <span className="fitsHeaderChip__value">
                {chip.value.kind === "text" ? chip.value.text : <NotRecorded />}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
      <FullHeader header={header} />
    </>
  );
}
