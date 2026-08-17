export type NavLink = {
  href: string;
  label: string;
  description: string;
};

export type NavSection = {
  href: string;
  label: string;
  description: string;
  links: NavLink[];
};

export const navSections: NavSection[] = [
  {
    href: "/calculators",
    label: "Calculators",
    description: "Conversion and damage-threshold tools.",
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
    ],
  },
  {
    href: "/theory",
    label: "Theory",
    description: "Reference material for quantum optics concepts.",
    links: [],
  },
  {
    href: "/plotters",
    label: "Plotters",
    description: "Interactive plotting tools for arrays, CSV traces, and lab data.",
    links: [
      {
        href: "/plotters/array-plotter",
        label: "Array Plotter",
        description: "Plot x and y arrays in a Chart.js figure.",
      },
      {
        href: "/plotters/csv-plotter",
        label: "CSV Plotter",
        description: "Upload a two-column CSV and plot one column against the other.",
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
    description: "Notes and workflows for practical lab setup.",
    links: [],
  },
];
