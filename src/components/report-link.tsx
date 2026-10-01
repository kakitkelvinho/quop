"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { findTool } from "@/components/navigation";

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
 * Without a tool given, it names the tool whose page it is on, if any.
 */
export function ReportLink({ tool }: { tool?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname();
  const version = useSiteVersion();
  const label = tool ?? findTool(pathname.replace(/\/$/, ""))?.label;

  useEffect(() => {
    if (!ref.current) return;
    const subject = label ? `[quop] ${label}` : "[quop]";
    const body = [
      "What happened, and what did you expect?",
      "",
      "",
      "--",
      `Page: ${window.location.href}`,
      `Version: ${version ?? "unknown"}`,
    ].join("\n");
    ref.current.href = `mailto:${MAILBOX.join("@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [label, pathname, version]);

  return <a ref={ref}>Report a problem</a>;
}

/**
 * The builder's one-line invitation, in its About panel: the builder has no
 * site footer, so it carries its own report link. showVersion stands in for
 * the footer's version too.
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
