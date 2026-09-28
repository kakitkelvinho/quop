import type { ReactNode } from "react";

import { BetaMark } from "@/components/beta-badge";
import { findTool } from "@/components/navigation";

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
