"use client";

// PROTOTYPE: throwaway variants for the wayfinder ticket "Parts sidebar: where
// adding a component lives" (#20). Three structurally different parts panels,
// all opened from the + in the top-left island, switched with ?parts=A|B|C
// and the dev-only bar at the bottom. Fold the winner into builder-hud.tsx and
// delete this file.

import { useEffect, useMemo, useState } from "react";

import "./builder-parts-prototype.css";

import { Icon, PartIcon } from "@/components/builder/builder-icons";
import {
  COMPONENT_GROUPS,
  COMPONENT_SPECS,
  type ComponentType,
} from "@/components/builder/types";

export type PartsPanelProps = {
  open: boolean;
  placingType: ComponentType | null;
  /** keepOpen: the panel stays up while the part is placed */
  onPick: (type: ComponentType, keepOpen: boolean) => void;
  onClose: () => void;
};

const VARIANTS = [
  { key: "A", name: "Catalogue: list with hints, stays open" },
  { key: "B", name: "Shelf: search + icon tiles, closes on pick" },
  { key: "C", name: "Rail: group rail + flyout, stays open" },
] as const;
type VariantKey = (typeof VARIANTS)[number]["key"];

function readVariant(): VariantKey {
  const value = new URLSearchParams(window.location.search).get("parts");
  return VARIANTS.some((variant) => variant.key === value) ? (value as VariantKey) : "A";
}

// ---------------------------------------------------------------------------
// A: Catalogue
// ---------------------------------------------------------------------------

function VariantA({ placingType, onPick, onClose }: PartsPanelProps) {
  return (
    <aside className="builderIsland protoParts protoParts--a" aria-label="Parts">
      <header className="protoParts__head">
        <h2>Parts</h2>
        <button type="button" className="builderHud__close" aria-label="Close parts" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="protoParts__scroll">
        {COMPONENT_GROUPS.map((group) => (
          <section key={group.name} className="protoParts__group">
            <p className="protoParts__groupName">{group.name}</p>
            {group.types.map((type) => (
              <button
                key={type}
                type="button"
                className={`protoRow${placingType === type ? " is-active" : ""}`}
                onClick={() => onPick(type, true)}
              >
                <span className="protoRow__icon">
                  <PartIcon type={type} />
                </span>
                <span className="protoRow__text">
                  <span className="protoRow__name">{COMPONENT_SPECS[type].label}</span>
                  <span className="protoRow__hint">{COMPONENT_SPECS[type].hint}</span>
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// B: Shelf
// ---------------------------------------------------------------------------

function VariantB({ placingType, onPick, onClose }: PartsPanelProps) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMPONENT_GROUPS.map((group) => ({
      ...group,
      types: group.types.filter(
        (type) =>
          !q ||
          COMPONENT_SPECS[type].label.toLowerCase().includes(q) ||
          COMPONENT_SPECS[type].tag.toLowerCase().includes(q),
      ),
    })).filter((group) => group.types.length);
  }, [query]);

  return (
    <aside className="builderIsland protoParts protoParts--b" aria-label="Parts">
      <header className="protoParts__head">
        <input
          className="protoParts__search"
          type="search"
          placeholder="Find a part…"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="builderHud__close" aria-label="Close parts" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="protoParts__scroll">
        {groups.map((group) => (
          <section key={group.name} className="protoParts__group">
            <p className="protoParts__groupName">{group.name}</p>
            <div className="protoTiles">
              {group.types.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`protoTile${placingType === type ? " is-active" : ""}`}
                  title={COMPONENT_SPECS[type].hint}
                  onClick={() => onPick(type, false)}
                >
                  <PartIcon type={type} size={28} />
                  <span>{COMPONENT_SPECS[type].label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {groups.length ? null : <p className="protoParts__empty">No part matches “{query}”.</p>}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// C: Rail + flyout
// ---------------------------------------------------------------------------

/** Each group's rail glyph borrows its first part's icon. */
function VariantC({ placingType, onPick, onClose }: PartsPanelProps) {
  const [groupName, setGroupName] = useState<string>(COMPONENT_GROUPS[0].name);
  const group = COMPONENT_GROUPS.find((entry) => entry.name === groupName) ?? COMPONENT_GROUPS[0];

  return (
    <div className="protoParts protoParts--c" aria-label="Parts">
      <nav className="builderIsland protoRail" aria-label="Part groups">
        {COMPONENT_GROUPS.map((entry) => (
          <button
            key={entry.name}
            type="button"
            className={`protoRail__item${entry.name === group.name ? " is-active" : ""}`}
            onClick={() => setGroupName(entry.name)}
          >
            <PartIcon type={entry.types[0]} size={22} />
            <span>{entry.name}</span>
          </button>
        ))}
      </nav>
      <aside className="builderIsland protoFlyout" key={group.name}>
        <header className="protoParts__head">
          <h2>{group.name}</h2>
          <button type="button" className="builderHud__close" aria-label="Close parts" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>
        {group.types.map((type) => (
          <button
            key={type}
            type="button"
            className={`protoCard${placingType === type ? " is-active" : ""}`}
            onClick={() => onPick(type, true)}
          >
            <span className="protoCard__icon">
              <PartIcon type={type} size={34} />
            </span>
            <span className="protoRow__name">{COMPONENT_SPECS[type].label}</span>
            <span className="protoRow__hint">{COMPONENT_SPECS[type].hint}</span>
          </button>
        ))}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Switcher
// ---------------------------------------------------------------------------

function PrototypeSwitcher({
  current,
  onChange,
}: {
  current: VariantKey;
  onChange: (key: VariantKey) => void;
}) {
  const index = VARIANTS.findIndex((variant) => variant.key === current);
  const step = (delta: number) =>
    onChange(VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length].key);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      // [ and ] — the builder already uses the arrow keys to nudge parts
      if (event.key === "[") step(-1);
      if (event.key === "]") step(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="protoSwitcher" role="group" aria-label="Prototype variant">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ‹
      </button>
      <span>
        {current} · {VARIANTS[index].name}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        ›
      </button>
    </div>
  );
}

export default function PartsPanelPrototype(props: PartsPanelProps) {
  const [variant, setVariant] = useState<VariantKey>(readVariant);

  const change = (key: VariantKey) => {
    setVariant(key);
    const url = new URL(window.location.href);
    url.searchParams.set("parts", key);
    window.history.replaceState(null, "", url);
  };

  return (
    <>
      {props.open && variant === "A" ? <VariantA {...props} /> : null}
      {props.open && variant === "B" ? <VariantB {...props} /> : null}
      {props.open && variant === "C" ? <VariantC {...props} /> : null}
      {process.env.NODE_ENV !== "production" ? (
        <PrototypeSwitcher current={variant} onChange={change} />
      ) : null}
    </>
  );
}
