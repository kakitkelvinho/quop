import type { ReactNode } from "react";

/**
 * A calculator's answer: what it is, then the number large, in the Result
 * step, with its unit beside it. The main answer of a tool is `primary`; the
 * rest sit smaller beside it. With no answer to give, `empty` says why.
 */
export function Readout({
  label,
  value,
  unit,
  primary = false,
  empty,
}: {
  label: ReactNode;
  value: string | null;
  unit: string;
  primary?: boolean;
  /** shown in place of the number when there isn't one */
  empty: string;
}) {
  return (
    <div className={`readout${primary ? " readout--primary" : ""}`} aria-live="polite">
      <span className="readout__label">{label}</span>
      {value === null ? (
        <span className="readout__empty">{empty}</span>
      ) : (
        <span className="readout__value">
          {value}
          <span className="readout__unit"> {unit}</span>
        </span>
      )}
    </div>
  );
}
