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
    href: "/visualizers",
    label: "Visualizers",
    description: "Interactive views for optics and photonics ideas.",
    links: [
      {
        href: "/visualizers/array-plotter",
        label: "Array Plotter",
        description: "Plot x and y arrays in a Chart.js figure.",
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
