import type { ReactNode } from "react";

/**
 * Each tool's station pictogram, drawn as outlines for SignIcon's square (the
 * square, stroke and caps come from `.signIcon`). One per tool on the index,
 * beside the sign's orange arrow, as a platform sign shows what lies that way.
 */
const PICTOGRAMS: Record<string, ReactNode> = {
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
