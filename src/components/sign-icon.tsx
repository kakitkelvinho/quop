import type { ReactNode } from "react";

/**
 * A station pictogram (DESIGN.md › The Pictogram Rule): an icon drawn as a
 * white outline inside a white-bordered square, leading a sign. The outline
 * is set in CSS (`.signIcon`): every shape loses its fill and takes a 1.5px
 * square-capped, mitred stroke that doesn't scale with the viewBox, so any
 * of the repo's inline 24×24 icons fits it as it is.
 */
export function SignIcon({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="signIcon">
      {children}
    </span>
  );
}

/** A direction sign's arrow: this way to the tool. */
export function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 12h17M13 5l7 7-7 7" />
    </svg>
  );
}

/** A file picker's arrow up out of a tray. */
export function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 16V3M6 9l6-6 6 6M3 15v6h18v-6" />
    </svg>
  );
}
