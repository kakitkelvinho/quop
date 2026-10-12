import Link from "next/link";

import { BetaMark } from "@/components/beta-badge";
import type { NavLink } from "@/components/navigation";

/**
 * What each tool turns out, as one line in the readout's mono: the index card
 * shows a tool's result before it is opened, as the homepage chapters do.
 * The calculators' and the builder's are worked from their own defaults, so
 * every number is one the tool gives; the plotters' show what goes in and out.
 */
const SAMPLES: Record<string, string> = {
  "/calculators/energy-wavelength-calculator": "550 nm → 2.2543 eV",
  "/calculators/lidt-calculator": "1 W · 1 kHz · w 1 mm → 0.0318 J/cm²",
  "/calculators/pace": "4:30 /km → 13.33 km/h",
  "/calculators/light-travel-calculator": "30 fs → 8.99377 µm",
  "/plotters/array-plotter": "[0, 1, 2] [0, 1, 4] → plot",
  "/plotters/generic-csv-plotter": "x, y₁, y₂ … → plot",
  "/plotters/csv-plotter": "time, ch1, ch2 … → traces",
  "/plotters/fits-plotter": "BITPIX · NAXIS1 × NAXIS2 → image",
  "/plotters/csv-fits-viewer": "trace.csv ⟷ frame.fits",
  "/builder/tabletop": "path 575 mm · flight 1.92 ns",
};

/** A section's tools as cards, each one link: its result, its name, what it does. */
export function ToolIndex({ links }: { links: NavLink[] }) {
  return (
    <div className="toolGrid">
      {links.map((link) => (
        <Link className="toolCard" href={link.href} key={link.href}>
          {SAMPLES[link.href] ? <span className="toolCard__sample">{SAMPLES[link.href]}</span> : null}
          <h2>
            {link.label}
            <BetaMark tool={link} />
          </h2>
          <p>{link.description}</p>
          <span className="toolCard__open">
            Open <span aria-hidden="true">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
