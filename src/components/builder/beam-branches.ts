import type { Beam } from "./types.ts";

export function migrateBeamBranches(beams: Beam[]): Beam[] {
  const roots = new Map<string, string>();
  return beams.map((beam) => {
    const source = beam.path[0];
    const parentId = roots.get(source);
    if (!parentId) {
      roots.set(source, beam.id);
      return beam;
    }
    return {
      ...beam,
      parentId,
      label: beam.label ?? `${beam.path.length}-stop beam`,
    };
  });
}

export function validBeamParents(beams: Beam[]): Beam[] {
  const byId = new Map(beams.map((beam) => [beam.id, beam]));
  return beams.map((beam) => {
    if (!beam.parentId) return beam;
    let current = beam;
    const seen = new Set([beam.id]);
    while (current.parentId) {
      const parent = byId.get(current.parentId);
      if (!parent || parent.path[0] !== beam.path[0] || seen.has(parent.id)) {
        return { ...beam, parentId: undefined, inheritColor: undefined, inheritLabel: undefined, inheritHidden: undefined };
      }
      seen.add(parent.id);
      current = parent;
    }
    return beam;
  });
}

export function effectiveBeams(beams: Beam[]): Beam[] {
  const byId = new Map(beams.map((beam) => [beam.id, beam]));
  const resolved = new Map<string, Beam>();
  const visiting = new Set<string>();
  const resolve = (beam: Beam): Beam => {
    const cached = resolved.get(beam.id);
    if (cached) return cached;
    if (visiting.has(beam.id)) return beam;
    visiting.add(beam.id);
    const parent = beam.parentId ? byId.get(beam.parentId) : undefined;
    const inherited = parent && parent !== beam && parent.path[0] === beam.path[0] ? resolve(parent) : undefined;
    const result: Beam = {
      ...beam,
      color: beam.inheritColor && inherited ? inherited.color : beam.color,
      label: beam.inheritLabel && inherited ? inherited.label : beam.label,
      hidden: beam.inheritHidden && inherited ? inherited.hidden : beam.hidden,
    };
    visiting.delete(beam.id);
    resolved.set(beam.id, result);
    return result;
  };
  return beams.map(resolve);
}

export function branchDepth(beams: Beam[], id: string): number {
  const byId = new Map(beams.map((beam) => [beam.id, beam]));
  const seen = new Set([id]);
  let beam = byId.get(id);
  let depth = 0;
  while (beam?.parentId && !seen.has(beam.parentId)) {
    const parent = byId.get(beam.parentId);
    if (!parent || parent.path[0] !== beam.path[0]) break;
    depth++;
    seen.add(parent.id);
    beam = parent;
  }
  return depth;
}

export function beamForTracePath(beams: Beam[], path: string[]): Beam | undefined {
  let chosen: Beam | undefined;
  let longest = 0;
  for (const beam of beams) {
    if (beam.path[0] !== path[0]) continue;
    let common = 0;
    while (common < beam.path.length && common < path.length && beam.path[common] === path[common]) common++;
    if (common > longest) {
      chosen = beam;
      longest = common;
    }
  }
  return chosen;
}

export function removeBeamBranch(beams: Beam[], id: string): Beam[] {
  return retainBeamBranches(beams, beams.filter((beam) => beam.id !== id));
}

export function retainBeamBranches(original: Beam[], kept: Beam[]): Beam[] {
  const keptIds = new Set(kept.map((beam) => beam.id));
  const byId = new Map(original.map((beam) => [beam.id, beam]));
  const visible = new Map(effectiveBeams(original).map((beam) => [beam.id, beam]));
  return kept.map((beam) => {
    if (!beam.parentId || keptIds.has(beam.parentId)) return beam;
    const effective = visible.get(beam.id)!;
    let parentId = byId.get(beam.parentId)?.parentId;
    const seen = new Set([beam.id]);
    while (parentId && !keptIds.has(parentId) && !seen.has(parentId)) {
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
    return {
      ...beam,
      parentId: parentId && keptIds.has(parentId) && !seen.has(parentId) ? parentId : undefined,
      color: effective.color,
      label: effective.label,
      hidden: effective.hidden,
      inheritColor: undefined,
      inheritLabel: undefined,
      inheritHidden: undefined,
    };
  });
}
