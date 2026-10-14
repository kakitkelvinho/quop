// Groups: named sets of components and frames saved with the setup, such as
// the parts of one experiment when a table holds several (CONTEXT.md, Group).
// What hiding a group hides, and the edits on groups, as pure functions on a
// scene; the builder makes each edit one undo step.
//
// Not to be confused with a multi-selection, which group-edits.ts edits: a
// selection is whatever is picked right now, a group is kept in the file.

import {
  BEAM_COLORS,
  CONNECTION_KINDS,
  beamDisplayName,
  componentById,
  componentDisplayName,
  labelText,
  withPeriscopePartners,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type Connection,
  type Frame,
  type Group,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

/** What hiding groups (and frames) leaves in the drawing. */
export type Visibility = {
  /** ids of the components drawn */
  components: Set<string>;
  /** ids of the frames drawn */
  frames: Set<string>;
};

/** The groups each component or frame id belongs to. */
function groupsByMember(groups: Group[]): Map<string, Group[]> {
  const byMember = new Map<string, Group[]>();
  for (const group of groups) {
    for (const id of group.members) {
      const held = byMember.get(id);
      if (held) held.push(group);
      else byMember.set(id, [group]);
    }
  }
  return byMember;
}

/** In no group, or in any group that isn't hidden. */
function shownByGroups(held: Group[] | undefined): boolean {
  return !held || held.some((group) => !group.hidden);
}

/**
 * A component is shown when it is in no group, or any of its groups is shown.
 * A frame is shown when it isn't hidden itself and, by the same rule, by its
 * groups. Hiding changes only the drawing: a hidden component still counts in
 * path lengths and still angles mirrors and detectors.
 */
export function visibility(scene: Pick<BuilderSceneData, "components" | "frames" | "groups">): Visibility {
  const byMember = groupsByMember(scene.groups);
  return {
    components: new Set(
      scene.components.filter((component) => shownByGroups(byMember.get(component.id))).map(({ id }) => id),
    ),
    frames: new Set(
      scene.frames.filter((frame) => !frame.hidden && shownByGroups(byMember.get(frame.id))).map(({ id }) => id),
    ),
  };
}

/** A beam is drawn, whole, when it isn't hidden itself and any of its stops is shown. */
export function isBeamDrawn(beam: Beam, shown: Visibility): boolean {
  return !beam.hidden && beam.path.some((id) => shown.components.has(id));
}

/** A connection is drawn when either end is shown. */
export function isConnectionDrawn(connection: Connection, shown: Visibility): boolean {
  return shown.components.has(connection.from) || shown.components.has(connection.to);
}

/** A frame is drawn when it is shown; see `visibility`. */
export function isFrameDrawn(frame: Frame, shown: Visibility): boolean {
  return shown.frames.has(frame.id);
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

export function createGroupId(): string {
  return `group-${Math.random().toString(36).slice(2, 8)}`;
}

/** Every id in the setup: groups' ids are unique across all of them. */
function usedIds(scene: BuilderSceneData): Set<string> {
  return new Set(
    [scene.components, scene.beams, scene.connections, scene.frames, scene.groups].flatMap((list) =>
      list.map(({ id }) => id),
    ),
  );
}

/** "Group n", with the lowest n no group is called yet. */
export function nextGroupName(groups: Group[], base = "Group"): string {
  const names = new Set(groups.map((group) => group.name));
  let n = 1;
  while (names.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/** The first beam colour no group wears yet, or the next round the palette. */
export function nextGroupColor(groups: Group[]): string {
  const worn = new Set(groups.map((group) => group.color));
  return BEAM_COLORS.find((color) => !worn.has(color)) ?? BEAM_COLORS[groups.length % BEAM_COLORS.length];
}

/** The ids that name a part or a frame, each once, with a periscope's other mirror. */
function memberIdsOf(scene: BuilderSceneData, ids: string[]): string[] {
  const parts = new Set(scene.components.map(({ id }) => id));
  const frames = new Set(scene.frames.map(({ id }) => id));
  const kept = ids.filter((id) => parts.has(id) || frames.has(id));
  return [...new Set(withPeriscopePartners(scene.components, kept))];
}

function editGroup(scene: BuilderSceneData, id: string, edit: (group: Group) => Group): BuilderSceneData {
  let changed = false;
  const groups = scene.groups.map((group) => {
    if (group.id !== id) return group;
    const next = edit(group);
    if (next !== group) changed = true;
    return next;
  });
  return changed ? { ...scene, groups } : scene;
}

/**
 * A new group of the given parts and frames, named "Group n" unless a name is
 * given, in the first beam colour no other group wears. Its id comes back too.
 */
export function createGroup(
  scene: BuilderSceneData,
  memberIds: string[],
  name?: string,
  makeId: () => string = createGroupId,
): { scene: BuilderSceneData; id: string } {
  const taken = usedIds(scene);
  let id = makeId();
  while (taken.has(id)) id = makeId();
  const group: Group = {
    id,
    name: labelText(name)?.trim() || nextGroupName(scene.groups),
    color: nextGroupColor(scene.groups),
    members: memberIdsOf(scene, memberIds),
  };
  return { scene: { ...scene, groups: [...scene.groups, group] }, id };
}

/** A group's new name; an empty one is refused. */
export function renameGroup(scene: BuilderSceneData, id: string, name: string): BuilderSceneData {
  const next = labelText(name)?.trim();
  if (!next) return scene;
  return editGroup(scene, id, (group) => (group.name === next ? group : { ...group, name: next }));
}

export function setGroupColor(scene: BuilderSceneData, id: string, color: string): BuilderSceneData {
  return editGroup(scene, id, (group) => (group.color === color ? group : { ...group, color }));
}

/** Hide or show a group. Stored only when hidden, like a beam's or a frame's flag. */
export function setGroupHidden(scene: BuilderSceneData, id: string, hidden: boolean): BuilderSceneData {
  return editGroup(scene, id, (group) => {
    if (Boolean(group.hidden) === hidden) return group;
    const next = { ...group };
    if (hidden) next.hidden = true;
    else delete next.hidden;
    return next;
  });
}

/** Put a part or frame in a group, or take it out; a periscope's two mirrors go together. */
export function setMembership(
  scene: BuilderSceneData,
  groupId: string,
  id: string,
  isMember: boolean,
): BuilderSceneData {
  const ids = memberIdsOf(scene, [id]);
  if (ids.length === 0) return scene;
  return editGroup(scene, groupId, (group) => {
    const members = isMember
      ? [...group.members, ...ids.filter((member) => !group.members.includes(member))]
      : group.members.filter((member) => !ids.includes(member));
    return members.length === group.members.length ? group : { ...group, members };
  });
}

/** Ungroup: the group goes, its members stay on the table. */
export function deleteGroup(scene: BuilderSceneData, id: string): BuilderSceneData {
  const groups = scene.groups.filter((group) => group.id !== id);
  return groups.length === scene.groups.length ? scene : { ...scene, groups };
}

/**
 * Every group's members kept to the parts and frames still on the table, as
 * after a delete. A group left empty stays until it is deleted.
 */
export function pruneMembers(scene: BuilderSceneData): BuilderSceneData {
  const present = new Set([...scene.components, ...scene.frames].map(({ id }) => id));
  let changed = false;
  const groups = scene.groups.map((group) => {
    const members = group.members.filter((id) => present.has(id));
    if (members.length === group.members.length) return group;
    changed = true;
    return { ...group, members };
  });
  return changed ? { ...scene, groups } : scene;
}

/** Each copy joins the groups its source is in. `copyOf` maps a source's id to its copy's. */
export function joinSourcesGroups(scene: BuilderSceneData, copyOf: Map<string, string>): BuilderSceneData {
  let changed = false;
  const groups = scene.groups.map((group) => {
    const copies = group.members.flatMap((id) => {
      const copy = copyOf.get(id);
      return copy !== undefined && !group.members.includes(copy) ? [copy] : [];
    });
    if (copies.length === 0) return group;
    changed = true;
    return { ...group, members: [...group.members, ...copies] };
  });
  return changed ? { ...scene, groups } : scene;
}

// ---------------------------------------------------------------------------
// Export group
// ---------------------------------------------------------------------------

/** A beam or connection left out of a group's file, and the stops outside the group that kept it out. */
export type LeftOut = { kind: "beam"; item: Beam; outside: string[] } | { kind: "connection"; item: Connection; outside: string[] };

/** A part saved without the part it hangs on (a particle's host, a periscope top's lower mirror), which isn't in the group. */
export type Loosened = { id: string; from: string };

/**
 * A group on its own, as a setup: its member parts and frames, every beam
 * whose every stop is a member and every connection with both ends members,
 * and the group itself, shown, with the setup's own settings (`labelScale`).
 * Positions and ids are kept as they are on the table, so the file lines up
 * again when it is brought back in. What a beam or connection through a part
 * outside the group kept out is listed; so is a particle or periscope top
 * whose host or lower mirror is outside, saved where it stands but loose, as
 * the parser would open it. Null when there is no such group.
 */
export function groupSubset(
  scene: BuilderSceneData,
  groupId: string,
): { scene: BuilderSceneData; leftOut: LeftOut[]; loosened: Loosened[] } | null {
  const group = scene.groups.find((entry) => entry.id === groupId);
  if (!group) return null;
  const members = new Set(group.members);
  const loosened: Loosened[] = [];
  const components = scene.components
    .filter((component) => members.has(component.id))
    .map((component): BuilderComponent => {
      const anchor = component.host ?? component.periscope;
      if (anchor === undefined || members.has(anchor)) return component;
      loosened.push({ id: component.id, from: anchor });
      const loose = { ...component };
      delete loose.host;
      delete loose.periscope;
      return loose;
    });
  const leftOut: LeftOut[] = [];
  const beams = scene.beams.filter((beam) => {
    const outside = [...new Set(beam.path.filter((id) => !members.has(id)))];
    if (outside.length) leftOut.push({ kind: "beam", item: beam, outside });
    return outside.length === 0;
  });
  const connections = scene.connections.filter((connection) => {
    const outside = [connection.from, connection.to].filter((id) => !members.has(id));
    if (outside.length) {
      // a connection with neither end in the group was never the group's
      if (outside.length < 2) leftOut.push({ kind: "connection", item: connection, outside });
      return false;
    }
    return true;
  });
  // a beam with no stop in the group was never the group's either
  const passing = leftOut.filter((entry) => entry.kind === "connection" || entry.outside.length < entry.item.path.length);
  const shown = { ...group };
  delete shown.hidden;
  return {
    scene: {
      ...scene,
      components,
      beams,
      connections,
      frames: scene.frames.filter((frame) => members.has(frame.id)),
      groups: [shown],
    },
    leftOut: passing,
    loosened,
  };
}

/** "A, B and C" */
function listed(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}

/**
 * What a group's file left out, as a sentence for the status line:
 * "1 beam left out: Probe passes Laser 1, which isn't in Group 1." Null when
 * nothing was.
 */
export function leftOutNotice(
  scene: BuilderSceneData,
  groupName: string,
  leftOut: LeftOut[],
  loosened: Loosened[] = [],
): string | null {
  const name = (id: string) => {
    const component = componentById(scene.components, id);
    return component ? componentDisplayName(component) : id;
  };
  const outsideOf = (ids: string[]) =>
    `${listed(ids.map(name))}, which ${ids.length === 1 ? "isn't" : "aren't"} in ${groupName}`;
  const sentences: string[] = [];
  for (const kind of ["beam", "connection"] as const) {
    const entries = leftOut.filter((entry) => entry.kind === kind);
    if (!entries.length) continue;
    const count = `${entries.length} ${kind}${entries.length === 1 ? "" : "s"} left out`;
    const each = entries.map((entry) =>
      entry.kind === "beam"
        ? `${beamDisplayName(entry.item)} passes ${outsideOf(entry.outside)}`
        : `${entry.item.label?.trim() || CONNECTION_KINDS[entry.item.kind].label} goes to ${outsideOf(entry.outside)}`,
    );
    sentences.push(`${count}: ${each.join("; ")}.`);
  }
  for (const { id, from } of loosened) {
    sentences.push(`${name(id)} is saved without ${name(from)}, which isn't in ${groupName}.`);
  }
  return sentences.length ? sentences.join(" ") : null;
}
