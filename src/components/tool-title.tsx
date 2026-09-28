import type { ReactNode } from "react";

import { findTool, type NavLink } from "@/components/navigation";

export function isBeta(tool: Pick<NavLink, "status"> | undefined): boolean {
  return tool?.status === "beta";
}

export function BetaBadge() {
  return (
    <span className="betaBadge" title="Works, but hasn’t met the release checklist yet">
      Beta
    </span>
  );
}

/** A tool page's heading, badged when the navigation registry marks it beta. */
export function ToolTitle({ href, children }: { href: string; children: ReactNode }) {
  return (
    <h1>
      {children}
      {isBeta(findTool(href)) ? (
        <>
          {" "}
          <BetaBadge />
        </>
      ) : null}
    </h1>
  );
}
