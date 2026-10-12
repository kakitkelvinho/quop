/** A tool that works but hasn't met the release checklist yet. */
export type ToolStatus = "beta";

export type NavLink = {
  href: string;
  label: string;
  description: string;
  /** absent means stable; "beta" shows a badge on the tool's page and card */
  status?: ToolStatus;
};

export type NavSection = {
  href: string;
  label: string;
  description: string;
  accent: string;
  orbitalPhase: number;
  links: NavLink[];
};

export const navSections: NavSection[] = [
  {
    href: "/calculators",
    label: "Calculators",
    description:
      "Quick conversions and estimates.",
    accent: "#ff9d5c",
    orbitalPhase: 0.15,
    links: [
      {
        href: "/calculators/energy-wavelength-calculator",
        label: "Energy-Wavelength",
        description: "Photon energy ↔ wavelength.",
      },
      {
        href: "/calculators/lidt-calculator",
        label: "LIDT",
        description:
          "Pulse energy and fluence of a pulsed laser.",
      },
      {
        href: "/calculators/pace",
        label: "Pace",
        description:
          "Running pace ↔ speed.",
      },
      {
        href: "/calculators/light-travel-calculator",
        label: "Light Travel",
        description:
          "Distance ↔ time for light in vacuum.",
      },
    ],
  },
  {
    href: "/notes",
    label: "Notes",
    description:
      "Reference notes for quantum optics, operators, and physical intuition.",
    accent: "#6da8ff",
    orbitalPhase: 1.7,
    links: [],
  },
  {
    href: "/plotters",
    label: "Plotters",
    description:
      "Arrays, CSV and FITS files.",
    accent: "#75d7c0",
    orbitalPhase: 3.25,
    links: [
      {
        href: "/plotters/array-plotter",
        label: "Array Plotter",
        description: "Paste x and y arrays.",
      },
      {
        href: "/plotters/generic-csv-plotter",
        label: "CSV Plotter",
        description: "Any numeric CSV.",
      },
      {
        href: "/plotters/csv-plotter",
        label: "Time CSV Plotter",
        description:
          "A CSV with a time column.",
      },
      {
        href: "/plotters/fits-plotter",
        label: "FITS Plotter",
        description:
          "A FITS frame as a trace, image or surface.",
      },
      {
        href: "/plotters/csv-fits-viewer",
        label: "CSV + FITS Viewer",
        description: "A CSV and a FITS file side by side.",
      },
    ],
  },
  {
    href: "/builder",
    label: "Builder",
    description:
      "Lab setup notes, measurement workflows, and practical implementation details.",
    accent: "#f06f86",
    orbitalPhase: 4.9,
    links: [
      {
        href: "/builder/tabletop",
        label: "Tabletop",
        description:
          "Design and visualize your own optical setup on a virtual table.",
      },
    ],
  },
];

export function isBeta(tool: Pick<NavLink, "status"> | undefined): boolean {
  return tool?.status === "beta";
}

export function findTool(href: string): NavLink | undefined {
  for (const section of navSections) {
    const tool = section.links.find((link) => link.href === href);
    if (tool) return tool;
  }
  return undefined;
}
