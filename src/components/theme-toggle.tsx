"use client";

type Theme = "light" | "dark";

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme-preference", theme);
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[1.35rem] w-[1.35rem]">
      <path
        d="M15 2.8a9.8 9.8 0 1 0 6.2 17.4A8.6 8.6 0 0 1 15 2.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[1.35rem] w-[1.35rem]">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <g stroke="currentColor" strokeLinecap="round" strokeWidth="1.8">
        <path d="M12 2.5v3" />
        <path d="M12 18.5v3" />
        <path d="M2.5 12h3" />
        <path d="M18.5 12h3" />
        <path d="m5.3 5.3 2.1 2.1" />
        <path d="m16.6 16.6 2.1 2.1" />
        <path d="m16.6 7.4 2.1-2.1" />
        <path d="m5.3 18.7 2.1-2.1" />
      </g>
    </svg>
  );
}

/** Day or night, as the header's last item: in the bar, not floating over the page. */
export function ThemeToggle() {
  const handleToggle = () => {
    const currentTheme = getTheme();
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <button
      className="themeToggle inline-flex h-full min-w-11 items-center justify-center px-3 text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
      type="button"
      onClick={handleToggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      <span className="themeToggle__iconWrap themeToggle__iconWrap--moon">
        <MoonIcon />
      </span>
      <span className="themeToggle__iconWrap themeToggle__iconWrap--sun">
        <SunIcon />
      </span>
      <span className="sr-only">Toggle dark mode</span>
    </button>
  );
}
