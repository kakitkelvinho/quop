"use client";

import { useEffect, useState } from "react";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth <= 900) {
      setIsSidebarOpen(false);
    }
  }, [pathname]);

  return (
    <div className={`shell ${isSidebarOpen ? "shell--sidebar-open" : "shell--sidebar-collapsed"}`}>
      <button
        aria-controls="primary-sidebar"
        aria-expanded={isSidebarOpen}
        aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        className={`sidebarToggle ${isSidebarOpen ? "is-open" : ""}`}
        onClick={() => setIsSidebarOpen((current) => !current)}
        type="button"
      >
        <span aria-hidden="true" className="sidebarToggle__icon">
          <span />
          <span />
          <span />
        </span>
        <span className="sidebarToggle__srOnly">
          {isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        </span>
      </button>

      <ThemeToggle />

      <aside className="sidebar" id="primary-sidebar">
        <div className="sidebarHeader">
          <div className="brand">
            <Link className="brand__link" href="/">
              quop
            </Link>
            <p className="brand__copy">Perspectives from the field.</p>
          </div>
        </div>

        <div className="sidebarBody">
          <nav className="sidebarNav" aria-label="Primary">
            {navSections.map((section) => (
              <div className="navGroup" key={section.href}>
                <Link href={section.href} className="navGroup__title">
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
        </div>
      </aside>

      <main className="content">
        <div className="content__inner">{children}</div>
      </main>
    </div>
  );
}
