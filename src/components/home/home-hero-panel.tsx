import Link from "next/link";

import { navSections } from "@/components/navigation";

export function HomeHeroPanel() {
  return (
    <div className="relative grid aspect-square w-[min(88vw,26rem)] grid-cols-2 grid-rows-2 gap-3">
      {navSections.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-t-[3px] border-[var(--border)] bg-[var(--surface)] p-4 text-center text-xs font-bold uppercase tracking-[0.12em] text-[var(--foreground)] shadow-[var(--shadow)] transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] sm:text-sm"
          style={{ borderTopColor: section.accent }}
        >
          <span>{section.label}</span>
          {section.links.length === 0 ? (
            <span className="text-[0.62rem] font-semibold normal-case tracking-normal text-[var(--muted)] sm:text-[0.68rem]">
              Notes coming soon
            </span>
          ) : null}
        </Link>
      ))}

      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-black uppercase tracking-[0.2em] text-[var(--surface-strong)] shadow-[var(--shadow)] sm:h-28 sm:w-28 sm:text-sm">
        QUOP
      </div>
    </div>
  );
}
