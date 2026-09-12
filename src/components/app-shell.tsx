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

  return (
    <div className="topNav__itemWrap">
      <Link
        className={`topNav__link ${isActive(pathname, href) ? "is-active" : ""}`}
        href={href}
      >
        {label}
      </Link>
      {links.length ? (
        <div className="topNav__dropdown">
          {links.map((link) => (
            <Link className="topNav__dropdownLink" href={link.href} key={link.href}>
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
    <div className="shell shell--topnav">
      <header className="topNav">
        <nav className="topNav__bar" aria-label="Primary">
          <div className="topNav__side">
            <NavItem href="/experiment" label="experiment" />
            <NavItem href="/theory" label="theory" />
          </div>

          <Link className="topNav__brand" href="/">
            QUOP
          </Link>

          <div className="topNav__side topNav__side--right">
            <NavItem href="/plotters" label="plotter" />
            <NavItem href="/calculators" label="calculator" />
          </div>
        </nav>
      </header>

      <ThemeToggle />

      <main className="content content--topnav">
        <div className="content__inner">{children}</div>
      </main>
    </div>
  );
}
