import Link from "next/link";

import { BetaMark } from "@/components/beta-badge";
import type { NavLink } from "@/components/navigation";

/**
 * A section's tools as cards, each one link: its name on a station sign,
 * then what it does.
 */
export function ToolIndex({ links }: { links: NavLink[] }) {
  return (
    <div className="toolGrid">
      {links.map((link) => (
        <Link className="toolCard" href={link.href} key={link.href}>
          <h2>
            <span className="toolCard__sign">{link.label}</span>
            <BetaMark tool={link} />
          </h2>
          <p>{link.description}</p>
        </Link>
      ))}
    </div>
  );
}
