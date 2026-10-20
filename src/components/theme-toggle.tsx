"use client";

import { SignIcon } from "@/components/sign-icon";

type Theme = "light" | "dark";

/** A choice matching the system isn't saved, so the site goes back to following it. */
export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  if (theme === systemTheme) {
    localStorage.removeItem("theme-preference");
  } else {
    localStorage.setItem("theme-preference", theme);
  }
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M15 2.8a9.8 9.8 0 1 0 6.2 17.4A8.6 8.6 0 0 1 15 2.8Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M17.7 6.3l2.1-2.1M4.2 19.8l2.1-2.1" />
    </svg>
  );
}

/**
 * Day or night, as the header's last item: in the bar, not floating over the
 * page. Its sun or moon is a pictogram, squared when the item is lit.
 */
export function ThemeToggle() {
  const handleToggle = () => {
    const currentTheme = getTheme();
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <button
      className="themeToggle navTab inline-flex h-full min-w-11 items-center justify-center px-3 text-[1.05rem]"
      type="button"
      onClick={handleToggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      <SignIcon>
        <span className="themeToggle__iconWrap themeToggle__iconWrap--moon">
          <MoonIcon />
        </span>
        <span className="themeToggle__iconWrap themeToggle__iconWrap--sun">
          <SunIcon />
        </span>
      </SignIcon>
      <span className="sr-only">Toggle dark mode</span>
    </button>
  );
}
