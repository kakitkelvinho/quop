export type NavLink = {
  href: string;
  label: string;
  description: string;
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
    description: "Conversion, pace, and threshold tools for quick optical estimates.",
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
        description: "Estimate pulse energy density for optics work.",
      },
      {
        href: "/calculators/pace",
        label: "Pace",
        description: "Swap between running pace and speed inputs.",
      },
      {
        href: "/calculators/light-travel-calculator",
        label: "Light Travel",
        description: "Convert between time delay and the distance light travels.",
      },
    ],
  },
  {
    href: "/theory",
    label: "Theory",
    description: "Reference notes for quantum optics, operators, and physical intuition.",
    accent: "#6da8ff",
    orbitalPhase: 1.7,
    links: [],
  },
  {
    href: "/plotters",
    label: "Plotters",
    description: "Interactive viewers for arrays, CSV traces, FITS frames, and lab exports.",
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
        description: "Choose which CSV columns map to x and which become y-series.",
      },
      {
        href: "/plotters/csv-plotter",
        label: "Time CSV Plotter",
        description: "Plot every non-time column against a detected time axis.",
      },
      {
        href: "/plotters/fits-plotter",
        label: "FITS Plotter",
        description: "Upload a FITS image and preview its first frame in the browser.",
      },
      {
        href: "/plotters/csv-fits-viewer",
        label: "CSV + FITS Viewer",
        description: "Open CSV and FITS viewers side by side in one comparison layout.",
      },
    ],
  },
  {
    href: "/experiment",
    label: "Experiment",
    description: "Lab setup notes, measurement workflows, and practical implementation details.",
    accent: "#f06f86",
    orbitalPhase: 4.9,
    links: [],
  },
];
