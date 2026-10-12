import type { ReactNode } from "react";

/**
 * A calculator's answer: what it is, then the number large, in the Result
 * step, with its unit beside it. The main answer of a tool is `primary`; the
 * rest sit smaller beside it. With no answer to give, it shows a dash.
 */
export function Readout({
  label,
  value,
  unit,
  primary = false,
}: {
  label: ReactNode;
  value: string | null;
  unit: string;
  primary?: boolean;
}) {
  return (
    <div className={`readout${primary ? " readout--primary" : ""}`} aria-live="polite">
      <span className="readout__label">{label}</span>
      {value === null ? (
        <span className="readout__empty">—</span>
      ) : (
        <span className="readout__value">
          {value}
          <span className="readout__unit"> {unit}</span>
        </span>
      )}
    </div>
  );
}
