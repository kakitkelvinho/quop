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
      "Quickly calculate and convert between numbers to do back-in-the-envelope calculations.",
    accent: "#ff9d5c",
    orbitalPhase: 0.15,
    links: [
      {
        href: "/calculators/energy-wavelength-calculator",
        label: "Energy-Wavelength",
        description: "Convert between photon energy and wavelength.",
      },
      {
        href: "/calculators/lidt-calculator",
        label: "LIDT",
        description:
          "Estimate pulse energy density and determining damage thresholds.",
      },
      {
        href: "/calculators/pace",
        label: "Pace",
        description: "Swap between running pace and speed inputs.",
      },
      {
        href: "/calculators/light-travel-calculator",
        label: "Light Travel",
        description:
          "Figure out the distance and time travelled by a light pulse.",
      },
    ],
  },
  {
    href: "/theory",
    label: "Theory",
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
      "Interactive viewers for arrays, CSV traces, FITS frames, and lab exports.",
    accent: "#75d7c0",
    orbitalPhase: 3.25,
    links: [
      {
        href: "/plotters/array-plotter",
        label: "Array Plotter",
        description: "Plot x and y arrays in a Chart.js figure.",
      },
      {
        href: "/plotters/generic-csv-plotter",
        label: "CSV Plotter",
        description: "Plot any csv files. Pick which columns are x and y.",
      },
      {
        href: "/plotters/csv-plotter",
        label: "Time CSV Plotter",
        description: "Plot every non-time column against a detected time axis.",
      },
      {
        href: "/plotters/fits-plotter",
        label: "FITS Plotter",
        description: "Upload a FITS image and plot it.",
      },
      {
        href: "/plotters/csv-fits-viewer",
        label: "CSV + FITS Viewer",
        description: "Open CSV and FITS viewers side by side.",
      },
    ],
  },
  {
    href: "/experiment",
    label: "Experiment",
    description:
      "Lab setup notes, measurement workflows, and practical implementation details.",
    accent: "#f06f86",
    orbitalPhase: 4.9,
    links: [
      {
        href: "/experiment/builder",
        label: "Builder",
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
