import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BetaMark } from "@/components/beta-badge";
import { findTool } from "@/components/navigation";

/**
 * A tool page's heading and lead. The lead is the tool's description in the
 * navigation registry, the same words as its index card, so they're written
 * once; the heading is badged when the registry marks the tool beta. The
 * report link lives in the site footer, which names the tool by its page.
 */
export function ToolIntro({ href, children }: { href: string; children: ReactNode }) {
  const tool = findTool(href);
  return (
    <>
      <h1 className="toolTitle">
        {children}
        <BetaMark tool={tool} />
      </h1>
      {tool ? <p className="lead">{tool.description}</p> : null}
    </>
  );
}

/**
 * A tool page's tab title and description, from the navigation registry, so
 * several open tools can be told apart. Calculators say so, since "LIDT" or
 * "Pace" alone don't.
 */
export function toolMetadata(href: string): Metadata {
  const tool = findTool(href);
  if (!tool) return {};
  const calculator = href.startsWith("/calculators/");
  return {
    title: calculator ? `${tool.label} calculator` : tool.label,
    description: tool.description,
  };
}
