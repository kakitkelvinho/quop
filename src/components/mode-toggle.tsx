"use client";

import { SignIcon } from "@/components/sign-icon";

type Mode = "light" | "dark";

/** A choice matching the system isn't saved, so the site goes back to following it. */
export function setMode(mode: Mode) {
  document.documentElement.dataset.mode = mode;
  const systemMode = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  if (mode === systemMode) {
    localStorage.removeItem("mode-preference");
  } else {
    localStorage.setItem("mode-preference", mode);
  }
}

export function getMode(): Mode {
  return document.documentElement.dataset.mode === "dark" ? "dark" : "light";
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

/** Day or night, as the header's last item. */
export function ModeToggle() {
  const handleToggle = () => {
    const currentMode = getMode();
    setMode(currentMode === "dark" ? "light" : "dark");
  };

  return (
    <button
      className="modeToggle navTab inline-flex h-full min-w-11 items-center justify-center px-3 text-[1.05rem]"
      type="button"
      onClick={handleToggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      <SignIcon>
        <span className="modeToggle__iconWrap modeToggle__iconWrap--moon"><MoonIcon /></span>
        <span className="modeToggle__iconWrap modeToggle__iconWrap--sun"><SunIcon /></span>
      </SignIcon>
      <span className="sr-only">Toggle dark mode</span>
    </button>
  );
}
