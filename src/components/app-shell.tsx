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
    <div className="group relative -mb-2 pb-2">
      <Link
        className={`inline-flex min-h-[2.65rem] items-center justify-center rounded-full px-3 text-xs font-bold uppercase tracking-[0.12em] no-underline transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] ${
          active
            ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
            : "text-[var(--foreground)]"
        }`}
        href={href}
      >
        {label}
      </Link>
      {links.length ? (
        <div className="pointer-events-none absolute left-0 top-full z-10 grid min-w-44 -translate-y-1 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 opacity-0 shadow-[var(--shadow)] transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
          {links.map((link) => (
            <Link
              className="block rounded-xl px-2.5 py-2 text-sm font-semibold text-[var(--foreground)] no-underline transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
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
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 p-4 pb-0">
        <nav
          className="mx-auto grid w-full max-w-4xl grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 shadow-[var(--shadow)] backdrop-blur-[14px]"
          aria-label="Primary"
        >
          <div className="flex items-center gap-1">
            <NavItem href="/experiment" label="experiment" />
            <NavItem href="/theory" label="theory" />
          </div>

          <Link
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-bold uppercase tracking-[0.2em] text-[var(--foreground)] no-underline transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
            href="/"
          >
            QUOP
          </Link>

          <div className="flex items-center justify-end gap-1">
            <NavItem href="/plotters" label="plotter" />
            <NavItem href="/calculators" label="calculator" />
          </div>
        </nav>
      </header>

      <ThemeToggle />

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
