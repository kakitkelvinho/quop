"use client";

import { useMemo, useState } from "react";

import { Icon, PartIcon } from "@/components/builder/builder-icons";
import { PanelBar } from "@/components/builder/panel-frame";
import {
  PART_CATEGORIES,
  COMPONENT_SPECS,
  type ComponentType,
} from "@/components/builder/types";
import { usePanel } from "@/components/builder/use-panel-drag";

/** Name, tag and aliases. */
function matches(type: ComponentType, query: string): boolean {
  const spec = COMPONENT_SPECS[type];
  return [spec.label, spec.tag, ...(spec.aliases ?? [])].some((text) => text.toLowerCase().includes(query));
}

/**
 * The parts panel: opened from the + in the top-left island, it lists every
 * part by group with its icon and name. It stays open while placing,
 * so a run of parts can go down without reopening it.
 */
export default function PartsPanel({
  placingType,
  onPick,
  onClose,
}: {
  placingType: ComponentType | null;
  onPick: (type: ComponentType) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const panel = usePanel("parts", { keepHeight: true });
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // a part that comes with another (a periscope's top mirror) is never placed alone
    return PART_CATEGORIES.map((group) => ({
      ...group,
      types: group.types.filter((type) => !COMPONENT_SPECS[type].partOf && (!needle || matches(type, needle))),
    })).filter((group) => group.types.length);
  }, [query]);

  return (
    <aside
      {...panel.frame}
      className={`builderIsland builderParts${panel.moves ? " builderPanel" : ""}`}
      aria-label="Parts"
    >
      {panel.moves ? <PanelBar title="Parts" {...panel.bar} /> : null}
      <header className="builderParts__head">
        <input
          className="builderParts__search"
          type="search"
          placeholder="Search"
          aria-label="Find a part"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Enter picks the only match, so "trap ⏎" is enough
            const only = groups.length === 1 && groups[0].types.length === 1;
            if (event.key === "Enter" && only) onPick(groups[0].types[0]);
            // the builder's own keys skip text fields, so Esc is handled here:
            // clear the search first, then close the panel
            if (event.key === "Escape") {
              if (query) setQuery("");
              else onClose();
            }
          }}
        />
        <button type="button" className="builderHud__close" aria-label="Close parts" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="builderParts__list">
        {groups.map((group) => (
          <section key={group.name} className="builderParts__group">
            <p className="builderParts__groupName">{group.name}</p>
            {group.types.map((type) => (
              <button
                key={type}
                type="button"
                className={`builderPart${placingType === type ? " is-active" : ""}`}
                aria-pressed={placingType === type}
                onClick={() => onPick(type)}
              >
                <span className="builderPart__icon">
                  <PartIcon type={type} />
                </span>
                <span className="builderPart__name">{COMPONENT_SPECS[type].label}</span>
              </button>
            ))}
          </section>
        ))}
        {groups.length ? null : (
          <p className="builderParts__empty">No match.</p>
        )}
      </div>
    </aside>
  );
}
