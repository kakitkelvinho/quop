import type { ReactNode } from "react";

import type { ComponentType } from "@/components/builder/types";

/** One stroke family for every builder control: 24-unit box, 1.7 stroke, round joins. */
const ICONS = {
  back: <path d="M15 5 8 12l7 7" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  redo: (
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </>
  ),
  select: <path d="m5 3 14 7-6 2-2 6-6-15Z" />,
  add: <path d="M12 5v14M5 12h14" />,
  // a laser spot: a starburst of rays round a bright dot, the beam coming in
  // level from the left where the left-hand ray would be
  beam: (
    <>
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <path d="M18.5 12H22M15 8.5V5M15 15.5V19" />
      <path d="m17.5 9.5 1.4-1.4M17.5 14.5l1.4 1.4M12.5 9.5l-1.4-1.4M12.5 14.5l-1.4 1.4" />
      <path d="M2 12h9.5" />
    </>
  ),
  // a patch cord: a plug at each end and the cable slack between them
  connect: (
    <>
      <rect x="3.5" y="3" width="4" height="6" rx="1" />
      <rect x="16.5" y="15" width="4" height="6" rx="1" />
      <path d="M5.5 9c0 8 13 -2 13 6" />
    </>
  ),
  iso: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  top: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 12h16M12 4v16" />
    </>
  ),
  fit: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  // the Show wheel's overlays: a grid, a part label, a ruler, a post
  grid: <path d="M4 4h16v16H4zM4 9.33h16M4 14.67h16M9.33 4v16M14.67 4v16" />,
  labels: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" />
      <circle cx="7.5" cy="8.5" r="1.2" />
    </>
  ),
  // the same tag struck through: labels hidden
  labelsOff: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" />
      <circle cx="7.5" cy="8.5" r="1.2" />
      <path d="M4 4l16 16" />
    </>
  ),
  // a ruler laid at a slant, with its ticks
  ruler: (
    <>
      <path d="m3.5 15.5 12-12 5 5-12 12z" />
      <path d="m7.5 11.5 2 2M10.5 8.5 12 10M13.5 5.5l2 2M6 13l1.5 1.5" />
    </>
  ),
  // a fluted classical column: abacus and echinus, three flutes, base and plinth
  posts: (
    <>
      <path d="M4 4h16" />
      <path d="M6 4.5c0 1.4.9 2 2 2h8c1.1 0 2-.6 2-2" />
      <path d="M7.5 6.5v11M12 6.5v11M16.5 6.5v11" />
      <path d="M6.5 17.5h11M4.5 20.5h15" />
    </>
  ),
  theme: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
    </>
  ),
  // a bulb: the brightness, on its knob in the Show wheel
  light: (
    <>
      <path d="M9 17.5h6M10 20.5h4" />
      <path d="M9 17.5v-1.8c0-1.2-.6-2-1.4-2.9A5.5 5.5 0 1 1 16.4 12.8c-.8.9-1.4 1.7-1.4 2.9v1.8" />
    </>
  ),
  // a large and a small letter: the labels' size
  // three dots: more for this row
  more: (
    <>
      <circle cx="6" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5M12 7.8h.01" />
    </>
  ),
  rotateLeft: (
    <>
      <path d="M4 5v5h5" />
      <path d="M5 13a7 7 0 1 0 1.5-6.5L4 10" />
    </>
  ),
  rotateRight: (
    <>
      <path d="M20 5v5h-5" />
      <path d="M19 13a7 7 0 1 1-1.5-6.5L20 10" />
    </>
  ),
  duplicate: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  // an open eye: shown; the same eye struck through: hidden
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <path d="M4 4l16 16" />
    </>
  ),
  frame: <rect x="4" y="6" width="16" height="12" rx="1.5" strokeDasharray="3 2.5" />,
  up: <path d="m6 15 6-6 6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  dash: <path d="M6 12h12" />,
  down: <path d="m6 9 6 6 6-6" />,
  // a panel's title-bar buttons: collapse to the bar, fill the workspace, and back
  minimise: <path d="M6 16h12" />,
  maximise: <rect x="5" y="5" width="14" height="14" rx="1.5" />,
  restore: (
    <>
      <rect x="4.5" y="8.5" width="11" height="11" rx="1.5" />
      <path d="M8.5 8.5V6A1.5 1.5 0 0 1 10 4.5h8A1.5 1.5 0 0 1 19.5 6v8a1.5 1.5 0 0 1-1.5 1.5h-2.5" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="6" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="18" r="1" />
    </>
  ),
  // the file fan: a setup's JSON, a picture of the view, the example table
  braces: (
    <path d="M9 4H8a2 2 0 0 0-2 2v3.5A2.5 2.5 0 0 1 3.5 12 2.5 2.5 0 0 1 6 14.5V18a2 2 0 0 0 2 2h1M15 4h1a2 2 0 0 1 2 2v3.5a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0-2.5 2.5V18a2 2 0 0 1-2 2h-1" />
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17.5 5-5 4 4 2.5-2.5 4.5 4.5" />
    </>
  ),
  example: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <circle cx="7" cy="14.5" r="1.3" />
      <path d="M8.3 14.5H14l3-5M15.5 8.2l3 2.6" />
    </>
  ),
  // the JSON panel: copy, paste, save as .json, open a .json
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="12" rx="1.5" />
      <path d="M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H6A1.5 1.5 0 0 0 4.5 5v9A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  paste: (
    <>
      <path d="M9 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H15" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  floppy: (
    <>
      <path d="M6 4h10l4 4v10.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4Z" />
      <path d="M8 4v4.5h7V4M7.5 20v-6h9v6" />
    </>
  ),
  folder: (
    <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z" />
  ),
  // the panel rail's slots: a folded beam, and two parts inside a dashed fence
  // (the old two boxes joined by a curve read as the cable; Frames uses `frame`)
  beams: <path d="M3 17 10 8l4 6 7-9" />,
  groups: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" rx="2" strokeDasharray="3 2.4" />
      <rect x="6.5" y="6.5" width="5" height="5" rx="1" />
      <rect x="12.5" y="12.5" width="5" height="5" rx="1" />
    </>
  ),
  // a ball and the shadow it casts on the table: the Show wheel's Shadows
  shadow: (
    <>
      <circle cx="12" cy="9.5" r="5" />
      <ellipse cx="13.5" cy="19" rx="6" ry="1.6" fill="currentColor" opacity="0.45" stroke="none" />
    </>
  ),
  // a gauge with its needle turned down low: the Show wheel's Light graphics
  gauge: (
    <>
      <path d="M4.5 17a8 8 0 1 1 15 0" />
      <path d="m12 14-3.5-4" />
      <circle cx="12" cy="14" r="1" fill="currentColor" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  );
}

/** A square icon control. The label doubles as the tooltip, so it carries the shortcut. */
export function IconButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  guide,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  /** its key in the quick guide's coach marks */
  guide?: string;
}) {
  return (
    <button
      type="button"
      className={`builderIconBtn${active ? " is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      data-guide={guide}
    >
      <Icon name={icon} />
    </button>
  );
}

/** One small glyph per part, in the same stroke family, for the parts panel. */
const PART_ICONS: Record<ComponentType, ReactNode> = {
  "laser-source": (
    <>
      <rect x="3" y="8.5" width="12" height="7" rx="1.2" />
      <path d="M15 12h6M18.5 9.5 21 12l-2.5 2.5" />
    </>
  ),
  "fiber-collimator": (
    <>
      <path d="M3 20c4 0 4-8 7.5-8" />
      <rect x="10.5" y="9.5" width="7" height="5" rx="1" />
      <path d="M17.5 12H21" />
    </>
  ),
  "mirror-mount": (
    <>
      <path d="M5 19 19 5" />
      <path d="M9 19.5 7 17.5M13 15.5 11 13.5M17 11.5 15 9.5" />
    </>
  ),
  "beam-splitter": (
    <>
      <rect x="5" y="5" width="14" height="14" rx="1" />
      <path d="M5 19 19 5" />
    </>
  ),
  lens: <path d="M12 3c3.2 3.5 3.2 14.5 0 18-3.2-3.5-3.2-14.5 0-18Z" />,
  waveplate: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 4v2.5M20 12h-2.5M12 20v-2.5M4 12h2.5" />
    </>
  ),
  filter: (
    <>
      <rect x="9" y="4" width="6" height="16" rx="1" />
      <path d="m9 10 6-3M9 15l6-3M9 20l6-3" />
    </>
  ),
  iris: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m12 4 1.8 6M20 12l-6 1.8M12 20l-1.8-6M4 12l6-1.8" />
    </>
  ),
  sample: <path d="m8 4 7 2.5v13.5L8 17.5Z" />,
  "paul-trap": (
    <>
      <path d="M7 3v18M17 3v18" />
      <ellipse cx="12" cy="7.5" rx="3.5" ry="1.4" />
      <ellipse cx="12" cy="16.5" rx="3.5" ry="1.4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  cavity: (
    <>
      <path d="M4 5c2 4.5 2 9.5 0 14M20 5c-2 4.5-2 9.5 0 14" />
      <path d="M6.5 9.5c3.5 2 7.5 2 11 0M6.5 14.5c3.5-2 7.5-2 11 0" />
    </>
  ),
  particle: (
    <>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <circle cx="12" cy="12" r="6.5" strokeDasharray="2 2.6" />
    </>
  ),
  photodiode: (
    <>
      <rect x="8" y="5" width="12" height="14" rx="1.5" />
      <path d="M3 12h5" />
      <circle cx="14" cy="12" r="2.6" />
    </>
  ),
  camera: (
    <>
      <rect x="9" y="6" width="12" height="12" rx="1.5" />
      <path d="M9 9H4.5v6H9" />
    </>
  ),
  spectrometer: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M7 15l4-6M10.5 15.5 13 9M14 16l1.8-7" />
    </>
  ),
  // a beam into a box through a connector, and a pulse out the back
  "single-photon-detector": (
    <>
      <path d="M2.5 12h3M5.5 9.5v5" />
      <rect x="7" y="6" width="8" height="12" rx="1.2" />
      <path d="M15 15.5h3.5V9h3v6.5" />
    </>
  ),
  // a low box with a row of inputs across its front
  "time-tagger": (
    <>
      <rect x="2.5" y="8" width="19" height="9" rx="1.2" />
      <circle cx="7" cy="12.5" r="1.1" />
      <circle cx="10.5" cy="12.5" r="1.1" />
      <circle cx="14" cy="12.5" r="1.1" />
      <circle cx="17.5" cy="12.5" r="1.1" />
    </>
  ),
  // a beam running into a finned stack
  "beam-block": (
    <>
      <path d="M3 12h7" />
      <rect x="10" y="6" width="10" height="12" rx="1" />
      <path d="M10 9h10M10 12h10M10 15h10" />
    </>
  ),
  // barrel, taper, tip
  objective: (
    <>
      <path d="M3 9.5h3v5H3" />
      <rect x="6" y="7" width="9" height="10" rx="1" />
      <path d="M15 7l4 3.5v3L15 17" />
    </>
  ),
  block: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  // a crystal with a transducer on top and sound wavefronts through it
  aom: (
    <>
      <rect x="4" y="9" width="16" height="10" rx="1" />
      <rect x="8" y="5" width="8" height="4" />
      <path d="M6 12.5h12M6 15.5h12" strokeDasharray="1.5 1.5" />
    </>
  ),
  // a crystal between two electrodes
  eom: (
    <>
      <path d="M3 7h18M3 17h18" />
      <rect x="5" y="9" width="14" height="6" rx="1" />
      <path d="M12 3v4" />
    </>
  ),
  // a housing with a barrel each end, an arrow on top, and the side port
  "faraday-isolator": (
    <>
      <path d="M2.5 13.5h3M18.5 13.5h3" />
      <rect x="5.5" y="9" width="13" height="9" rx="1.2" />
      <path d="M8.5 5.5h6.5M13 3.5l2 2-2 2" />
      <path d="M12 18v3" />
    </>
  ),
  // two mirrors up a rod, the beam in low and out high
  periscope: (
    <>
      <path d="M8 3.5v17" />
      <path d="M10.5 19.5 15 15M10.5 9 15 4.5" />
      <path d="M3 17.5h9.5V7H21" strokeDasharray="1.6 1.8" />
    </>
  ),
  // the beam line along the top, folded down the rail to the carriage's V of mirrors and back
  "delay-line": (
    <>
      <path d="M3 5h18" strokeDasharray="1.6 1.6" />
      <path d="M8 3.5l3 3M13 6.5l3-3" />
      <path d="M10 6v10M14 6v10" strokeDasharray="1.6 1.6" />
      <path d="M8.5 16.5 12 20l3.5-3.5" />
      <path d="M5 21h14" />
    </>
  ),
  "periscope-top": (
    <>
      <path d="M8 3.5v17" />
      <path d="M10.5 9 15 4.5" />
      <path d="M12.5 21V7H21" strokeDasharray="1.6 1.8" />
    </>
  ),
};

export function PartIcon({ type, size = 20 }: { type: ComponentType; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PART_ICONS[type]}
    </svg>
  );
}
