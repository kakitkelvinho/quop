import Link from "next/link";

import { BetaMark } from "@/components/beta-badge";
import type { NavLink } from "@/components/navigation";
import { ArrowRightIcon, SignIcon } from "@/components/sign-icon";
import { ToolPictogram } from "@/components/tool-pictograms";

/**
 * A section's tools as rows, each one link: its name on a station sign,
 * with the tool's pictogram and the way-on arrow in its corner, then what
 * it does.
 */
export function ToolIndex({ links }: { links: NavLink[] }) {
  return (
    <div className="toolGrid">
      {links.map((link) => (
        <Link className="toolCard" href={link.href} key={link.href}>
          <h2>
            <span className="toolCard__sign">
              {link.label}
              <span className="toolCard__marks">
                <SignIcon>
                  <ToolPictogram href={link.href} />
                </SignIcon>
                <span className="toolCard__arrow">
                  <ArrowRightIcon />
                </span>
              </span>
            </span>
            <BetaMark tool={link} />
          </h2>
          <p>{link.description}</p>
        </Link>
      ))}
    </div>
  );
}
