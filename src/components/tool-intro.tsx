import type { Metadata } from "next";

import { BetaMark } from "@/components/beta-badge";
import { findTool } from "@/components/navigation";

/**
 * A tool's name, the same on its index card, its page and its tab: the
 * navigation registry's label, with "Calculator" after a calculator's,
 * since "LIDT" or "Pace" alone don't say what they are.
 */
export function toolName(href: string): string {
  const label = findTool(href)?.label ?? "";
  return href.startsWith("/calculators/") ? `${label} Calculator` : label;
}

/**
 * A tool page's heading, badged when the registry marks the tool beta. The
 * name says what the tool is, so the page carries no lead. An `aside` spells
 * out a name the label abbreviates. The report link lives in the site footer,
 * which names the tool by its page.
 */
export function ToolIntro({ href, aside }: { href: string; aside?: string }) {
  const tool = findTool(href);
  return (
    <>
      <h1 className="toolTitle">
        {toolName(href)}
        <BetaMark tool={tool} />
        {aside ? <span className="toolTitle__aside">{aside}</span> : null}
      </h1>
    </>
  );
}

/** A tool page's tab title and description, from the navigation registry. */
export function toolMetadata(href: string): Metadata {
  const tool = findTool(href);
  if (!tool) return {};
  return { title: toolName(href), description: tool.description };
}
