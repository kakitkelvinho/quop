import type { ReactNode } from "react";

import { ArrowRightIcon, SignIcon } from "@/components/sign-icon";

/**
 * Each tool's station pictogram, drawn as outlines for SignIcon's square (the
 * square, stroke and caps come from `.signIcon`). One per tool on the index,
 * and one per section for the homepage's signs, beside the sign's orange
 * arrow, as a platform sign shows what lies that way. The section and home
 * pictograms also mark the 404's signs.
 */
const PICTOGRAMS: Record<string, ReactNode> = {
  // a house: back to the start
  "/": <path d="M3 11l9-8 9 8M6 9v12h12V9M10 21v-6h4v6" />,
  // the Builder section is the Tabletop, so it wears the Tabletop's lens
  "/builder": <path d="M2 12h20M12 4c2.6 3.5 2.6 12.5 0 16M12 4c-2.6 3.5-2.6 12.5 0 16" />,
  // a ruled page
  "/notes": <path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" />,
  // a beam through a lens
  "/builder/tabletop": <path d="M2 12h20M12 4c2.6 3.5 2.6 12.5 0 16M12 4c-2.6 3.5-2.6 12.5 0 16" />,
  // a trace on axes
  "/plotters": <path d="M3 3v18h18M6 16l4-7 3 4 5-8" />,
  // a keypad
  "/calculators": <path d="M5 3h14v18H5zM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />,
  // a light wave
  "/calculators/energy-wavelength-calculator": <path d="M2 12c2.5-6.5 5-6.5 7.5 0s5 6.5 7.5 0 3.5-4.5 5-3" />,
  // a pulse striking a surface
  "/calculators/lidt-calculator": <path d="M2 12h10M15 4v16M18 7l3-2M18 12h4M18 17l3 2" />,
  // a stopwatch
  "/calculators/pace": (
    <>
      <circle cx="12" cy="14" r="7" />
      <path d="M12 10v4l3 2M10 3h4M12 3v4" />
    </>
  ),
  // a distance, end to end
  "/calculators/light-travel-calculator": <path d="M3 12h18M3 8v8M21 8v8M8 9l-3 3 3 3M16 9l3 3-3 3" />,
  // a pair of brackets
  "/plotters/array-plotter": <path d="M8 4H5v16h3M16 4h3v16h-3" />,
  // a table
  "/plotters/generic-csv-plotter": <path d="M3 5h18v14H3zM3 10h18M3 14.5h18M9 5v14" />,
  // a trace against time
  "/plotters/csv-plotter": <path d="M3 3v18h18M6 16l4-7 3 4 5-8" />,
  // a frame with its cloud
  "/plotters/fits-plotter": (
    <>
      <rect x="3" y="3" width="18" height="18" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  // two panes, side by side
  "/plotters/csv-fits-viewer": <path d="M2 5h9v14H2zM13 5h9v14h-9z" />,
};

export function ToolPictogram({ href }: { href: string }) {
  const pictogram = PICTOGRAMS[href];
  if (!pictogram) return null;
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {pictogram}
    </svg>
  );
}

/**
 * A wayfinding sign's marks, in its lower right corner as on a platform
 * sign: the tool's pictogram in its square, then the orange arrow. Shown
 * only while the sign is pointed at (`.signMarks` in globals.css).
 */
export function SignMarks({ href }: { href: string }) {
  return (
    <span className="signMarks">
      <SignIcon>
        <ToolPictogram href={href} />
      </SignIcon>
      <span className="signMarks__arrow">
        <ArrowRightIcon />
      </span>
    </span>
  );
}
