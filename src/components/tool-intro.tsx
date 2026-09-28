import type { ReactNode } from "react";

import { findTool, isBeta, type NavLink } from "@/components/navigation";

export function BetaBadge() {
  return (
    <span className="betaBadge" title="Works, but hasn’t met the release checklist yet">
      Beta
    </span>
  );
}

/** The badge, set off by a space, when the tool is beta; nothing otherwise. */
export function BetaMark({ tool }: { tool: NavLink | undefined }) {
  if (!isBeta(tool)) return null;
  return (
    <>
      {" "}
      <BetaBadge />
    </>
  );
}

/**
 * A tool page's heading and lead. The lead is the tool's description in the
 * navigation registry, the same words as its index card, so they're written
 * once; the heading is badged when the registry marks the tool beta.
 */
export function ToolIntro({ href, children }: { href: string; children: ReactNode }) {
  const tool = findTool(href);
  return (
    <>
      <h1>
        {children}
        <BetaMark tool={tool} />
      </h1>
      {tool ? <p className="lead">{tool.description}</p> : null}
    </>
  );
}
