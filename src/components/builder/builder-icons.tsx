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
  beam: (
    <>
      <circle cx="5" cy="17" r="2" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="19" cy="15" r="2" />
      <path d="m6.2 15.4 4.6-6.8M13.4 8.4l4.2 5.2" />
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
  grid: <path d="M4 4h16v16H4zM4 9.33h16M4 14.67h16M9.33 4v16M14.67 4v16" />,
  /** a beam's crisp core with its direction arrow */
  centreLine: (
    <>
      <path d="M3 12h18" />
      <path d="m10 8 4 4-4 4" />
    </>
  ),
  labels: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" />
      <circle cx="7.5" cy="8.5" r="1.2" />
    </>
  ),
  theme: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
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
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
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
