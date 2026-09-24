"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { navSections } from "@/components/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  href,
  label,
  align = "left",
}: {
  href: string;
  label: string;
  /** which edge the hover menu lines up with; right-hand items open leftward */
  align?: "left" | "right";
}) {
  const section = navSections.find((entry) => entry.href === href);
  const pathname = usePathname();
  const links = section?.links ?? [];
  const active = isActive(pathname, href);

  return (
    <div className="group relative flex h-full">
      <Link
        className={`inline-flex h-full items-center justify-center px-4 text-xs font-bold uppercase tracking-[0.12em] no-underline transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] ${
          active
            ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
            : "text-[var(--muted)]"
        }`}
        href={href}
      >
        {label}
      </Link>
      {links.length ? (
        <div className={`pointer-events-none absolute ${align === "right" ? "right-0" : "left-0"} top-full z-10 grid min-w-44 border border-[var(--border)] bg-[var(--surface)] p-1.5 opacity-0 shadow-[var(--shadow)] transition-all group-hover:pointer-events-auto group-hover:opacity-100`}>
          {links.map((link) => (
            <Link
              className="block px-2.5 py-2 text-sm font-semibold text-[var(--foreground)] no-underline transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** the four sections, in header order; the desktop labels are their own */
const PRIMARY_NAV = [
  { href: "/experiment", label: "experiment" },
  { href: "/theory", label: "theory" },
  { href: "/plotters", label: "plotter" },
  { href: "/calculators", label: "calculator" },
];

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <g stroke="currentColor" strokeLinecap="round" strokeWidth="1.8">
        {open ? (
          <>
            <path d="m6 6 12 12" />
            <path d="M18 6 6 18" />
          </>
        ) : (
          <>
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </>
        )}
      </g>
    </svg>
  );
}

/**
 * Phones get the wordmark and a menu button; the sheet lists every section
 * with its pages spelled out, since the desktop hover submenus don't exist
 * on touch.
 */
function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <nav
      className="relative border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-[14px] md:hidden"
      aria-label="Primary"
    >
      <div className="flex h-14 items-stretch justify-between px-2">
        <Link
          className="inline-flex h-full items-center px-3 text-sm font-bold uppercase tracking-[0.2em] text-[var(--foreground)] no-underline"
          href="/"
          onClick={() => setOpen(false)}
        >
          QUOP
        </Link>
        <button
          className="inline-flex h-full items-center gap-2 px-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]"
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav-sheet"
          onClick={() => setOpen((value) => !value)}
        >
          Menu
          <MenuIcon open={open} />
        </button>
      </div>

      {open ? (
        <div
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-[var(--border)] bg-[var(--background)] px-2 pb-3 shadow-[var(--shadow)]"
          id="mobile-nav-sheet"
        >
          {PRIMARY_NAV.map((item) => {
            const links =
              navSections.find((entry) => entry.href === item.href)?.links ?? [];
            const active = isActive(pathname, item.href);
            return (
              <div className="border-t border-[var(--border)] py-1 first:border-t-0" key={item.href}>
                <Link
                  className={`block px-3 py-3 text-xs font-bold uppercase tracking-[0.12em] no-underline ${
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "text-[var(--foreground)]"
                  }`}
                  href={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
                {links.map((link) => (
                  <Link
                    className={`block px-3 py-2 pl-6 text-sm font-semibold no-underline ${
                      pathname === link.href
                        ? "text-[var(--accent-strong)]"
                        : "text-[var(--muted)]"
                    }`}
                    href={link.href}
                    key={link.href}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBuilderRoute = pathname.startsWith("/experiment/builder");

  return (
    <div className="min-h-screen">
      {/* The builder is a full-window workspace with its own way back. */}
      {isBuilderRoute ? null : (
        <header className="sticky top-0 z-40">
          <MobileNav />
          <nav
            className="hidden h-16 w-full grid-cols-[1fr_auto_1fr] items-stretch md:grid gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-10 backdrop-blur-[14px]"
            aria-label="Primary"
          >
            <div className="flex items-stretch gap-1">
              <NavItem href="/experiment" label="experiment" />
              <NavItem href="/theory" label="theory" />
            </div>

            <Link
              className="inline-flex h-full items-center justify-center px-4 text-sm font-bold uppercase tracking-[0.2em] text-[var(--foreground)] no-underline transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
              href="/"
            >
              QUOP
            </Link>

            <div className="flex items-stretch justify-end gap-1">
              <NavItem href="/plotters" label="plotter" align="right" />
              <NavItem href="/calculators" label="calculator" align="right" />
            </div>
          </nav>
        </header>
      )}

      {isBuilderRoute ? null : <ThemeToggle />}

      <main
        className={
          isBuilderRoute
            ? "builderMain"
            : "mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6"
        }
      >
        {children}
      </main>
    </div>
  );
}
