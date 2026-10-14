// Import into this table: a setup file merged into the table as it stands,
// rather than replacing it as Open JSON… → Apply does. It completes the
// assembly workflow: each experiment built in its own file (Export group),
// then composed on one table. Pure, so the UI only picks the file and
// answers the dialog for a group that is already on the table.

import { deleteComponents } from "./group-edits.ts";
import { createGroupId, nextGroupColor, pruneMembers } from "./groups.ts";
import { SCENE_LIMITS } from "./scene-text.ts";
import {
  createBeamId,
  createComponentId,
  createConnectionId,
  createFrameId,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type Connection,
  type Frame,
  type Group,
} from "./types.ts";

/** How close two parts' positions must be, on each axis, mm, to be the same part. */
export const SAME_PART_TOLERANCE_MM = 0.5;

/** A fresh id for each kind of thing, given what it is; the merge retries until it is free. */
export type FreshIds = {
  component: (source: BuilderComponent) => string;
  beam: (source: Beam) => string;
  connection: (source: Connection) => string;
  frame: (source: Frame) => string;
  group: (source: Group) => string;
};

const FRESH_IDS: FreshIds = {
  component: (source) => createComponentId(source.type),
  beam: () => createBeamId(),
  connection: (source) => createConnectionId(source.kind),
  frame: () => createFrameId(),
  group: () => createGroupId(),
};

/** What to do with a file's group that is already on the table, by id or by name. */
export type OnExisting = "replace" | "copy";

export type MergeOptions = {
  /** the file's name; a file with no groups comes in as one group named after it, without `.json` */
  fileName: string;
  /** needed when the file brings a group the table has; see `existingGroups` */
  onExisting?: OnExisting;
  ids?: Partial<FreshIds>;
};

export type MergeResult =
  | { ok: true; scene: BuilderSceneData; summary: string }
  | { ok: false; reason: string };

/** A file's name without its `.json`, as a group's name. */
export function nameFromFile(fileName: string): string {
  return fileName.replace(/\.json$/i, "").trim() || "Imported";
}

/**
 * The file's groups, as they come in: its own, or for a file with none (any
 * setup from before groups), one group named after the file holding every
 * part and frame in it.
 */
function fileGroups(table: BuilderSceneData, file: BuilderSceneData, fileName: string): Group[] {
  if (file.groups.length) return file.groups;
  return [
    {
      // no id yet: it gets a fresh one as it comes in
      id: "",
      name: nameFromFile(fileName),
      color: nextGroupColor(table.groups),
      members: [...file.components, ...file.frames].map(({ id }) => id),
    },
  ];
}

function matchExisting(table: BuilderSceneData, incoming: Group[]): { file: Group; table: Group }[] {
  return incoming.flatMap((group) => {
    const match = table.groups.find((entry) => (group.id !== "" && entry.id === group.id) || entry.name === group.name);
    return match ? [{ file: group, table: match }] : [];
  });
}

/**
 * The pairs of a file's group and the table's group it is already on the
 * table as: the same id, or the same name. Empty when the file can come in
 * without asking.
 */
export function existingGroups(
  table: BuilderSceneData,
  file: BuilderSceneData,
  fileName: string,
): { file: Group; table: Group }[] {
  return matchExisting(table, fileGroups(table, file, fileName));
}

/** Whether a file's part is the table's part: the same id, type and place, within half a millimetre on each axis. */
export function isSamePart(table: BuilderComponent, file: BuilderComponent): boolean {
  return (
    table.id === file.id &&
    table.type === file.type &&
    table.position.every((value, axis) => Math.abs(value - file.position[axis]) <= SAME_PART_TOLERANCE_MM)
  );
}

/** "<name> n", with the lowest n from 2 that no group is called yet. */
function copyName(name: string, groups: Group[]): string {
  const names = new Set(groups.map((group) => group.name));
  let n = 2;
  while (names.has(`${name} ${n}`)) n += 1;
  return `${name} ${n}`;
}

/**
 * The table with its group taken off for Replace: the group, its inner beams
 * (every stop a member) and connections (both ends members), and its members,
 * except those still in another group.
 */
function withoutGroup(table: BuilderSceneData, group: Group): BuilderSceneData {
  const members = new Set(group.members);
  const heldElsewhere = new Set(
    table.groups.filter((entry) => entry.id !== group.id).flatMap((entry) => entry.members),
  );
  const leaving = new Set([...members].filter((id) => !heldElsewhere.has(id)));
  let scene: BuilderSceneData = {
    ...table,
    groups: table.groups.filter((entry) => entry.id !== group.id),
    beams: table.beams.filter((beam) => !beam.path.every((id) => members.has(id))),
    connections: table.connections.filter(({ from, to }) => !(members.has(from) && members.has(to))),
    frames: table.frames.filter((frame) => !leaving.has(frame.id)),
  };
  scene = deleteComponents(
    scene,
    scene.components.filter(({ id }) => leaving.has(id)).map(({ id }) => id),
  );
  return pruneMembers(scene);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function listed(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}

/**
 * The file merged into the table, as one setup.
 *
 * - Parts land at the file's own coordinates.
 * - A file with groups brings them as they are; one with none comes in as one
 *   group named after the file. A file's part in none of its groups stays ungrouped.
 * - A file's part with the id, type and place of a table part is that part: it
 *   isn't added again, and the table's part joins the file's groups. This is
 *   how a mirror shared by two exported groups comes back as one mirror.
 * - Any other clash of ids gets a fresh id, and everything in the file that
 *   refers to it (beam stops, connection ends, group members, hosts) follows.
 * - A file beam whose stops all are the same parts, with the same id and path
 *   as a table beam, is that beam, and so for a connection and its ends.
 * - A file group the table already has (by id or name) is replaced or added as
 *   a copy, "<name> 2", as `onExisting` says.
 * - A merge that would go over the setup limits is refused, and the table is
 *   left as it was.
 */
export function mergeSetup(table: BuilderSceneData, file: BuilderSceneData, options: MergeOptions): MergeResult {
  const ids = { ...FRESH_IDS, ...options.ids };
  const incoming = fileGroups(table, file, options.fileName);
  const existing = matchExisting(table, incoming);
  if (existing.length && !options.onExisting) {
    return { ok: false, reason: `${listed(existing.map(({ table: group }) => group.name))} is already on the table.` };
  }

  let base = table;
  const copies = new Set<Group>();
  for (const pair of existing) {
    if (options.onExisting === "replace") base = withoutGroup(base, pair.table);
    else copies.add(pair.file);
  }

  const taken = new Set(
    [base.components, base.beams, base.connections, base.frames, base.groups].flatMap((list) => list.map(({ id }) => id)),
  );
  const fresh = <T>(make: (source: T) => string, source: T): string => {
    let id = make(source);
    while (taken.has(id)) id = make(source);
    taken.add(id);
    return id;
  };
  /** an id that is free keeps its name, and then counts as taken */
  const claim = <T extends { id: string }>(make: (source: T) => string, source: T): string => {
    if (!taken.has(source.id)) {
      taken.add(source.id);
      return source.id;
    }
    return fresh(make, source);
  };

  // parts: the same part is the table's; any other clash gets a fresh id
  const partId = new Map<string, string>();
  const same = new Set<string>();
  for (const component of file.components) {
    const onTable = base.components.find((entry) => entry.id === component.id);
    if (onTable && isSamePart(onTable, component)) {
      partId.set(component.id, component.id);
      same.add(component.id);
    }
  }
  for (const component of file.components) {
    if (!same.has(component.id)) partId.set(component.id, claim(ids.component, component));
  }
  const added = file.components
    .filter(({ id }) => !same.has(id))
    .map((component): BuilderComponent => {
      const next: BuilderComponent = { ...component, id: partId.get(component.id)! };
      if (component.host !== undefined) next.host = partId.get(component.host) ?? component.host;
      if (component.periscope !== undefined) next.periscope = partId.get(component.periscope) ?? component.periscope;
      return next;
    });

  const frameId = new Map(file.frames.map((frame) => [frame.id, claim(ids.frame, frame)]));
  const frames = file.frames.map((frame) => ({ ...frame, id: frameId.get(frame.id)! }));

  const onlySameParts = (stops: string[]) => stops.every((id) => same.has(id));
  const beams = file.beams.flatMap((beam): Beam[] => {
    const path = beam.path.map((id) => partId.get(id) ?? id);
    const twin = base.beams.find((entry) => entry.id === beam.id);
    if (twin && onlySameParts(beam.path) && twin.path.join("\u0000") === path.join("\u0000")) return [];
    return [{ ...beam, id: claim(ids.beam, beam), path }];
  });
  const connections = file.connections.flatMap((connection): Connection[] => {
    const [from, to] = [partId.get(connection.from) ?? connection.from, partId.get(connection.to) ?? connection.to];
    const twin = base.connections.find((entry) => entry.id === connection.id);
    if (twin && onlySameParts([connection.from, connection.to]) && twin.from === from && twin.to === to) return [];
    return [{ ...connection, id: claim(ids.connection, connection), from, to }];
  });

  const memberId = (id: string) => partId.get(id) ?? frameId.get(id) ?? id;
  const names = [...base.groups];
  const groups = incoming.map((group): Group => {
    const copy = copies.has(group);
    const next: Group = {
      ...group,
      id: copy || group.id === "" ? fresh(ids.group, group) : claim(ids.group, group),
      name: copy ? copyName(group.name, names) : group.name,
      members: [...new Set(group.members.map(memberId))],
    };
    names.push(next);
    return next;
  });

  const scene: BuilderSceneData = {
    ...base,
    components: [...base.components, ...added],
    beams: [...base.beams, ...beams],
    connections: [...base.connections, ...connections],
    frames: [...base.frames, ...frames],
    groups: [...base.groups, ...groups],
  };

  for (const key of Object.keys(SCENE_LIMITS) as (keyof typeof SCENE_LIMITS)[]) {
    if (scene[key].length > SCENE_LIMITS[key]) {
      return {
        ok: false,
        reason: `That would make ${scene[key].length} ${key === "components" ? "parts" : key} on the table; a setup holds at most ${SCENE_LIMITS[key]}.`,
      };
    }
  }

  const counts = [plural(added.length, "part", "parts")];
  if (beams.length) counts.push(plural(beams.length, "beam", "beams"));
  if (connections.length) counts.push(plural(connections.length, "connection", "connections"));
  if (frames.length) counts.push(plural(frames.length, "frame", "frames"));
  const into = groups.length ? ` into ${listed(groups.map((group) => group.name))}` : "";
  const shared = same.size ? ` ${plural(same.size, "part was", "parts were")} already on the table.` : "";
  return { ok: true, scene, summary: `Imported ${counts.join(", ")}${into}.${shared}` };
}
