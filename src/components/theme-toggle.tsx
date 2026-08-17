"use client";

type Theme = "light" | "dark";

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme-preference", theme);
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="themeToggle__icon">
      <path
        d="M15 2.8a9.8 9.8 0 1 0 6.2 17.4A8.6 8.6 0 0 1 15 2.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="themeToggle__icon">
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

export function ThemeToggle() {
  const handleToggle = () => {
    const currentTheme = getTheme();
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <button
      className="themeToggle"
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
      <span className="themeToggle__srOnly">Toggle dark mode</span>
    </button>
  );
}
