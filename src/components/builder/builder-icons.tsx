import type { ReactNode } from "react";

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
