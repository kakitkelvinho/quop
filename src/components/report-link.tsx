"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Joined in the browser, so the address never sits whole in the static HTML
// for a scraper to lift.
const MAILBOX = ["kelvin.ho", "aalto.fi"];

/** The layout stamps the site version into this meta tag at build time. */
function siteVersion(): string | undefined {
  return document.querySelector<HTMLMetaElement>('meta[name="quop-version"]')?.content;
}

/**
 * A "Report a problem" email link. The subject names the tool, so reports
 * can be filtered; the body carries the page and version, so they say where.
 */
export function ReportLink({ tool, className }: { tool?: string; className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!ref.current) return;
    const subject = tool ? `[quop] ${tool}` : "[quop]";
    const body = [
      "What happened, and what did you expect?",
      "",
      "",
      "--",
      `Page: ${window.location.href}`,
      `Version: ${siteVersion() ?? "unknown"}`,
    ].join("\n");
    ref.current.href = `mailto:${MAILBOX.join("@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [tool, pathname]);

  return (
    <a ref={ref} className={className}>
      Report a problem
    </a>
  );
}
