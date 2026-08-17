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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Link className="brand__link" href="/">
            quop
          </Link>
          <p className="brand__copy">Perspectives from the field.</p>
        </div>

        <nav className="sidebarNav" aria-label="Primary">
          {navSections.map((section) => (
            <div className="navGroup" key={section.href}>
              <p className="navGroup__title">{section.label}</p>
              <Link
                href={section.href}
                className={`navLink ${
                  isActive(pathname, section.href) ? "is-active" : ""
                }`}
              >
                {section.label}
              </Link>
              {section.links.map((link) => (
                <Link
                  href={link.href}
                  key={link.href}
                  className={`navSubLink ${
                    isActive(pathname, link.href) ? "is-active" : ""
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebarFooter">
          <ThemeToggle />
        </div>
      </aside>

      <main className="content">
        <div className="content__inner">{children}</div>
      </main>
    </div>
  );
}
