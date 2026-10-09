// Edits to several components at once: a selection moved, turned, copied or
// deleted as one rigid group. Each takes a scene and returns the next one, and
// returns the scene it was given when nothing changes, so a no-op never
// becomes an undo step. The hook settles hosts and angles after each, as it
// does after every edit: a particle whose host is in the group is carried by
// it there, not moved here.

import {
  GRID_SIZE_MM,
  MOUNTED_TYPES,
  ROTATION_STEP_DEG,
  clampHeight,
  clampToTable,
  componentById,
  createBeamId,
  createComponentId,
  dropComponentFromBeams,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type Vec3,
} from "./types.ts";

/** A particle whose host moves with the group: settleHosts carries it. */
function ridesWithHost(component: BuilderComponent, group: ReadonlySet<string>): boolean {
  return component.host !== undefined && group.has(component.host);
}

/** The group's parts that move themselves. */
function movers(scene: BuilderSceneData, group: ReadonlySet<string>): BuilderComponent[] {
  return scene.components.filter(
    (component) => group.has(component.id) && !ridesWithHost(component, group),
  );
}

/** The component at (x, z), clamped to the table; a particle moved off its host lets go of it. */
function placedAt(component: BuilderComponent, x: number, z: number): BuilderComponent {
  const [nextX, nextZ] = clampToTable(x, z);
  const [currentX, y, currentZ] = component.position;
  if (nextX === currentX && nextZ === currentZ) return component;
  const moved: BuilderComponent = { ...component, position: [nextX, y, nextZ] };
  delete moved.host;
  return moved;
}

/** `edit` applied to each part of the group its host doesn't carry; the same scene if none changed. */
function editGroup(
  scene: BuilderSceneData,
  group: ReadonlySet<string>,
  edit: (component: BuilderComponent) => BuilderComponent,
): BuilderSceneData {
  let changed = false;
  const components = scene.components.map((component) => {
    if (!group.has(component.id) || ridesWithHost(component, group)) return component;
    const next = edit(component);
    if (next !== component) changed = true;
    return next;
  });
  return changed ? { ...scene, components } : scene;
}

/**
 * Each part in `origins` at its origin plus (dx, dz). A drag previews from the
 * positions the group had when it started, so it never drifts apart.
 */
export function translateComponents(
  scene: BuilderSceneData,
  origins: Record<string, Vec3>,
  dx: number,
  dz: number,
): BuilderSceneData {
  return editGroup(scene, new Set(Object.keys(origins)), (component) => {
    const [x, , z] = origins[component.id];
    return placedAt(component, x + dx, z + dz);
  });
}

export function nudgeComponents(
  scene: BuilderSceneData,
  ids: string[],
  dx: number,
  dz: number,
): BuilderSceneData {
  return editGroup(scene, new Set(ids), (component) =>
    placedAt(component, component.position[0] + dx, component.position[2] + dz),
  );
}

/** To 0.01 mm, so float noise from the turn never reads as an edit; never −0. */
function toHundredth(value: number): number {
  return Math.round(value * 100) / 100 || 0;
}

/**
 * Turn the group one ROTATION_STEP_DEG about the centre of its parts on the
 * table, and each part with it. A yaw θ maps local +x to world
 * (cos θ, 0, −sin θ), so an offset (x, z) from the centre turns to
 * (x cos θ + z sin θ, −x sin θ + z cos θ). One part alone only turns in place.
 */
export function rotateComponents(
  scene: BuilderSceneData,
  ids: string[],
  direction: 1 | -1,
): BuilderSceneData {
  const group = new Set(ids);
  const turning = movers(scene, group);
  if (turning.length === 0) return scene;

  const centreX = turning.reduce((sum, component) => sum + component.position[0], 0) / turning.length;
  const centreZ = turning.reduce((sum, component) => sum + component.position[2], 0) / turning.length;
  const step = direction * ROTATION_STEP_DEG;
  const cos = Math.cos((step * Math.PI) / 180);
  const sin = Math.sin((step * Math.PI) / 180);

  return editGroup(scene, group, (component) => {
    const offsetX = component.position[0] - centreX;
    const offsetZ = component.position[2] - centreZ;
    const placed =
      offsetX === 0 && offsetZ === 0
        ? component
        : placedAt(
            component,
            toHundredth(centreX + offsetX * cos + offsetZ * sin),
            toHundredth(centreZ - offsetX * sin + offsetZ * cos),
          );
    return { ...placed, rotation: (component.rotation + step + 360) % 360 };
  });
}

/** The parts gone, and every beam without them; a beam left with one stop is gone too. */
export function deleteComponents(scene: BuilderSceneData, ids: string[]): BuilderSceneData {
  const gone = new Set(ids);
  const components = scene.components.filter((component) => !gone.has(component.id));
  if (components.length === scene.components.length) return scene;
  return {
    ...scene,
    components,
    beams: ids.reduce((beams, id) => dropComponentFromBeams(beams, id), scene.beams),
  };
}

export type IdMaker = {
  component: (source: BuilderComponent) => string;
  beam: (source: Beam) => string;
};

const FRESH_IDS: IdMaker = {
  component: (source) => createComponentId(source.type),
  beam: () => createBeamId(),
};

/**
 * A copy of each part, one grid step along x and z, and of every beam that
 * runs only between them. The copies' ids come back in the order asked for. A
 * copied particle stays in its host only when the host is copied too.
 */
export function duplicateComponents(
  scene: BuilderSceneData,
  ids: string[],
  makeId: IdMaker = FRESH_IDS,
): { scene: BuilderSceneData; ids: string[] } {
  const sources = ids
    .map((id) => componentById(scene.components, id))
    .filter((component): component is BuilderComponent => component !== undefined);
  if (sources.length === 0) return { scene, ids: [] };

  const copyOf = new Map(sources.map((source) => [source.id, makeId.component(source)]));
  const copies = sources.map((source) => {
    const [x, y, z] = source.position;
    const [copyX, copyZ] = clampToTable(x + GRID_SIZE_MM, z + GRID_SIZE_MM);
    const copy: BuilderComponent = { ...source, id: copyOf.get(source.id)!, position: [copyX, y, copyZ] };
    const host = source.host === undefined ? undefined : copyOf.get(source.host);
    if (host) copy.host = host;
    else delete copy.host;
    return copy;
  });
  const beams = scene.beams
    .filter((beam) => beam.path.every((id) => copyOf.has(id)))
    .map((beam) => ({ ...beam, id: makeId.beam(beam), path: beam.path.map((id) => copyOf.get(id)!) }));

  return {
    scene: {
      ...scene,
      components: [...scene.components, ...copies],
      beams: [...scene.beams, ...beams],
    },
    ids: [...copyOf.values()],
  };
}

/** Every part at one height, each kept to its own range. A hosted particle keeps its host's. */
export function setComponentsHeight(
  scene: BuilderSceneData,
  ids: string[],
  height: number,
): BuilderSceneData {
  return editGroup(scene, new Set(ids), (component) => {
    if (component.host !== undefined) return component;
    const [x, y, z] = component.position;
    const next = clampHeight(component.type, height);
    return next === y ? component : { ...component, position: [x, next, z] };
  });
}

/** The colour on every part held in a mount; the rest keep theirs. */
export function setMountColor(
  scene: BuilderSceneData,
  ids: string[],
  color: string,
): BuilderSceneData {
  return editGroup(scene, new Set(ids), (component) =>
    MOUNTED_TYPES.has(component.type) && component.color !== color ? { ...component, color } : component,
  );
}
