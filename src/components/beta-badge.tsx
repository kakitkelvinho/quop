import { isBeta, type NavLink } from "@/components/navigation";

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
