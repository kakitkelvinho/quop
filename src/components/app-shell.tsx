"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
}: {
  href: string;
  label: string;
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
        <div className="pointer-events-none absolute left-0 top-full z-10 grid min-w-44 border border-[var(--border)] bg-[var(--surface)] p-1.5 opacity-0 shadow-[var(--shadow)] transition-all group-hover:pointer-events-auto group-hover:opacity-100">
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBuilderRoute = pathname.startsWith("/experiment/builder");

  return (
    <div className="min-h-screen">
      {/* The builder is a full-window workspace with its own way back. */}
      {isBuilderRoute ? null : (
        <header className="sticky top-0 z-40">
          <nav
            className="grid h-16 w-full grid-cols-[1fr_auto_1fr] items-stretch gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-10 backdrop-blur-[14px]"
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
              <NavItem href="/plotters" label="plotter" />
              <NavItem href="/calculators" label="calculator" />
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
