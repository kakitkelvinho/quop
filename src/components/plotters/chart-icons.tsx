// The chart toolbars' icons, shared by the scatter chart and the FITS Image
// view. Each is a 24×24 outline, worn inside a SignIcon.

export function ResetZoomIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle
        cx="10"
        cy="10"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M13 13 17 20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M5 5 20 20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M20 5 5 20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  );
}

export function ZoomInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 15 20.5 20.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M10 6.8v6.4M6.8 10h6.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function ZoomOutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 15 20.5 20.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M6.8 10h6.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function ScrollIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 4v16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="m8.5 7 3.5-3 3.5 3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m8.5 17 3.5 3 3.5-3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ThemeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M15.2 3.2a8.8 8.8 0 1 0 5.6 15.7 7.7 7.7 0 0 1-5.6-15.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function JoinDotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle
        cx="6.5"
        cy="16.5"
        r="2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="17.5"
        cy="7.5"
        r="2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 15.2c2.3-0.1 3.9-1 5-2.2 1-1 1.6-2.1 2-3.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function PointSizeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M14.6 9.4 18.6 5.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="m16.2 5.4 2.4 0v2.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.4 14.6 5.4 18.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M7.8 18.6H5.4v-2.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function AxisLabelsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <text
        x="5"
        y="16.2"
        fill="currentColor"
        fontFamily="Cambria Math, STIX Two Math, Times New Roman, serif"
        fontSize="12.5"
        fontStyle="italic"
        fontWeight="700"
      >
        xy
      </text>
    </svg>
  );
}

export function LegendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="6.5" cy="7" r="1.5" fill="currentColor" />
      <path
        d="M10 7h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="6.5" cy="12" r="1.5" fill="currentColor" />
      <path
        d="M10 12h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="6.5" cy="17" r="1.5" fill="currentColor" />
      <path
        d="M10 17h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function StyleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 19.5v-2.6M14 19.5v-2.6M4.5 10h2.6M4.5 15h2.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M7.5 15.5c2.2-5 4.5-7.5 9-8.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function FontIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <text
        x="5.3"
        y="17"
        fill="currentColor"
        fontFamily="Times New Roman, Times, serif"
        fontSize="14"
        fontWeight="700"
      >
        A
      </text>
    </svg>
  );
}

export function TitleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5.5 5.5h13v13h-13z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <rect x="8" y="7.4" width="8" height="3.3" rx="0.8" fill="currentColor" />
    </svg>
  );
}

export function TickAxesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5 18.5h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M5.5 19V5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M9 18.5v3M14 18.5v3M19 18.5v3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M2.5 15h3M1.2 10h4.3M2.5 5h3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export function CustomizeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7h9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="15.5" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 12h4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="11" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.5 12H20" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M4 17h9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="15.5" cy="17" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M17.7 7H20M17.7 17H20" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function SaveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6 19h12"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 5v10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="m8.5 11.5 3.5 3.5 3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M7 19v-3.5h10V19"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
