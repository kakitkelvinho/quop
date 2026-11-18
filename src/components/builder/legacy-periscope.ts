type RawPart = Record<string, unknown>;
type RawSetup = Record<string, unknown>;

export function migrateLegacyPeriscopes(raw: RawSetup): { setup: RawSetup; aims: Map<string, string> } {
  const parts = Array.isArray(raw.components) ? raw.components.filter((part): part is RawPart => !!part && typeof part === "object") : [];
  const byId = new Map(parts.filter((part) => typeof part.id === "string").map((part) => [part.id as string, part]));
  const partner = new Map<string, string>();
  for (const top of parts.filter((part) => part.type === "periscope-top" && typeof part.id === "string")) {
    if (typeof top.periscope === "string" && byId.get(top.periscope)?.type === "periscope") {
      partner.set(top.periscope, top.id as string);
      partner.set(top.id as string, top.periscope);
    }
  }
  if (!parts.some((part) => part.type === "periscope" || part.type === "periscope-top")) return { setup: raw, aims: new Map() };

  const aims = new Map<string, string>();
  for (const [lower, top] of partner) {
    if (byId.get(lower)?.type === "periscope") aims.set(lower, top);
  }
  for (const beam of Array.isArray(raw.beams) ? raw.beams : []) {
    if (!beam || typeof beam !== "object" || !Array.isArray((beam as RawPart).path)) continue;
    const path = (beam as RawPart).path as unknown[];
    for (let index = 0; index < path.length - 1; index++) {
      const id = path[index];
      const next = path[index + 1];
      if (typeof id === "string" && typeof next === "string" && byId.get(id)?.type === "periscope-top" && !aims.has(id)) aims.set(id, next);
    }
  }
  const components = parts.map((part) => {
    if (part.type !== "periscope" && part.type !== "periscope-top") return part;
    const base = part.type === "periscope-top" && typeof part.periscope === "string" ? byId.get(part.periscope) : undefined;
    const position = Array.isArray(part.position) ? [...part.position] : part.position;
    if (base && Array.isArray(position) && Array.isArray(base.position) && position.length === 3 && base.position.length === 3) {
      position[0] = base.position[0];
      position[2] = base.position[2];
    }
    const { periscope: _link, ...rest } = part;
    void _link;
    const label = base && typeof base.label === "string" && base.label.trim() && !part.label ? `${base.label.trim()} top` : part.label;
    return { ...rest, type: "mirror-mount", position, ...(base ? { color: base.color, label } : {}) };
  });
  const groups = Array.isArray(raw.groups) ? raw.groups.map((group) => {
    if (!group || typeof group !== "object" || !Array.isArray((group as RawPart).members)) return group;
    const members = new Set((group as RawPart).members as string[]);
    for (const id of members) if (partner.has(id)) members.add(partner.get(id)!);
    return { ...(group as RawPart), members: [...members] };
  }) : raw.groups;
  return { setup: { ...raw, components, groups }, aims };
}
