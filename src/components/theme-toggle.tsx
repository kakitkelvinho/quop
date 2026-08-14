"use client";

function setTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme-preference", theme);
}

export function ThemeToggle() {
  const handleToggle = () => {
    const currentTheme = document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
  };

  return (
    <button
      className="themeToggle"
      type="button"
      onClick={handleToggle}
      aria-label="Toggle dark and light mode"
    >
      <span className="themeToggle__label">Mode</span>
      <span className="themeToggle__value">Dark / Light</span>
    </button>
  );
}
