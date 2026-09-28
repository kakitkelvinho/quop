"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";

// Joined in the browser, so the address never sits whole in the static HTML
// for a scraper to lift.
const MAILBOX = ["kelvin.ho", "aalto.fi"];

const noSubscription = () => () => {};

/** The site version, from the meta tag the layout writes at build time. */
export function useSiteVersion(): string | undefined {
  return useSyncExternalStore(
    noSubscription,
    () => document.querySelector<HTMLMetaElement>('meta[name="quop-version"]')?.content,
    () => undefined,
  );
}

/**
 * A "Report a problem" email link. The subject names the tool, so reports
 * can be filtered; the body carries the page and version, so they say where.
 */
export function ReportLink({ tool }: { tool?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname();
  const version = useSiteVersion();

  useEffect(() => {
    if (!ref.current) return;
    const subject = tool ? `[quop] ${tool}` : "[quop]";
    const body = [
      "What happened, and what did you expect?",
      "",
      "",
      "--",
      `Page: ${window.location.href}`,
      `Version: ${version ?? "unknown"}`,
    ].join("\n");
    ref.current.href = `mailto:${MAILBOX.join("@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [tool, pathname, version]);

  return <a ref={ref}>Report a problem</a>;
}

/**
 * The one-line invitation a tool carries under its intro. showVersion is for
 * the builder, which has no site footer to show it.
 */
export function ReportLine({
  tool,
  className,
  showVersion = false,
}: {
  tool?: string;
  className: string;
  showVersion?: boolean;
}) {
  const version = useSiteVersion();
  return (
    <p className={className}>
      Something wrong or unclear? <ReportLink tool={tool} />
      {showVersion && version ? <> · quop v{version}</> : null}
    </p>
  );
}
