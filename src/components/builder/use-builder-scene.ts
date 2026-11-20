"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import * as groupEdits from "@/components/builder/group-edits";
import * as groups from "@/components/builder/groups";
import { removeBeamBranch } from "@/components/builder/beam-branches";
import { aimAt, canAim, catchAims, flipFold, insertIntoAimedPath, settleAims } from "@/components/builder/aim-settling";
import {
  BEAM_COLORS,
  CONNECTION_KINDS,
  FRAME_COLORS,
  DEFAULT_SCENE,
  EMPTY_SCENE,
  clampToTable,
  carryUpgrade,
  createBeamId,
  createComponentId,
  createConnectionId,
  createFrameId,
  moveBeamTo as moveBeamInList,
  moveFrameTo as moveFrameInList,
  newComponent,
  nextLaserLightColor,
  parseLabelScale,
  parseScene,
  setBeamHidden as setBeamHiddenInList,
  setFrameHidden as setFrameHiddenInList,
  settleAngles,
  settleHosts,
  settleStageMounts,
  setStageMount as setStageMountInScene,
  snapToGrid,
  translateCorners,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  type BlockSymbol,
  type Connection,
  type ConnectionKind,
  type Corner,
  type Frame,
  type Vec3,
} from "@/components/builder/types";

// The key predates scene versions 2 and 3; parseScene reads every version.
const STORAGE_KEY = "quop.builder.scene.v1";
const HISTORY_LIMIT = 60;
/** how long the scene must stay still before it is autosaved, ms */
const AUTOSAVE_DELAY_MS = 500;

type Mutation = (scene: BuilderSceneData) => BuilderSceneData;

/**
 * Every edit settles hosted positions and orientations. Drawn Beams control
 * angles only in the temporary fallback mode; physical aims control them normally.
 */
function settled(mutate: Mutation, traced: boolean): Mutation {
  return (scene) => {
    const next = mutate(scene);
    if (next === scene) return scene;
    const placed = settleHosts(settleStageMounts(scene, next));
    return traced ? settleAims(placed).scene : settleAngles(placed);
  };
}

type HistoryState = {
  scene: BuilderSceneData;
  past: BuilderSceneData[];
  future: BuilderSceneData[];
};

type Action =
  /** an edit that becomes one undo step */
  | { kind: "commit"; mutate: Mutation }
  /** an edit that does not — used while a drag is in flight */
  | { kind: "preview"; mutate: Mutation }
  /** record a snapshot taken before a run of previews */
  | { kind: "checkpoint"; snapshot: BuilderSceneData }
  | { kind: "undo" }
  | { kind: "redo" };

function push(stack: BuilderSceneData[], entry: BuilderSceneData): BuilderSceneData[] {
  return [...stack.slice(-(HISTORY_LIMIT - 1)), entry];
}

/**
 * Snapshot history rather than a command log: a scene is a few dozen small
 * objects, so copying the whole thing per edit is cheaper to reason about,
 * and it makes a drag trivial — the drag previews freely and the checkpoint
 * taken at pointer-down is the single thing undo needs.
 */
function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.kind) {
    case "commit": {
      const scene = action.mutate(state.scene);
      if (scene === state.scene) return state;
      return { scene, past: push(state.past, state.scene), future: [] };
    }
    case "preview": {
      const scene = action.mutate(state.scene);
      if (scene === state.scene) return state;
      return { ...state, scene };
    }
    case "checkpoint":
      return { ...state, past: push(state.past, action.snapshot), future: [] };
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        scene: previous,
        past: state.past.slice(0, -1),
        future: [state.scene, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        scene: next,
        past: push(state.past, state.scene),
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

/**
 * The autosaved table, or null for none. The builder only ever renders on the
 * client (the page loads it with `ssr: false`), so it can be read straight
 * into the initial state — no hydration mismatch, no flash of the example layout.
 */
export function readStoredScene(): BuilderSceneData | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return parseScene(JSON.parse(stored));
  } catch {
    // A corrupt autosave should never block the page — fall back to the example.
  }
  return null;
}

function initialState(opening: BuilderSceneData | null, traced: boolean): HistoryState {
  const source = opening ?? readStoredScene() ?? DEFAULT_SCENE;
  const scene = traced ? carryUpgrade(source, settleAims(source).scene) : source;
  return { scene, past: [], future: [] };
}

/** `opening` is a setup the table opens with in place of the autosaved one, such as a shared link's. */
export function useBuilderScene(opening: BuilderSceneData | null = null, traced = true) {
  const [state, dispatch] = useReducer(reducer, opening, (start) => initialState(start, traced));
  const { scene } = state;

  // A drag previews a new scene on every pointer move; serialising each one
  // stalls a slow machine. The write waits until the scene has been still for
  // a moment, and is flushed at once when the page is hidden or closed, or
  // the builder unmounts, so the last state is never lost.
  const unsaved = useRef<BuilderSceneData | null>(null);
  const flush = useCallback(() => {
    const pending = unsaved.current;
    if (!pending) return;
    unsaved.current = null;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    } catch {
      // Private mode / quota: autosave is a convenience, not a requirement.
    }
  }, []);

  useEffect(() => {
    unsaved.current = scene;
    const timer = window.setTimeout(flush, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [scene, flush]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
  }, [flush]);

  const commit = useCallback(
    (mutate: Mutation) => dispatch({ kind: "commit", mutate: settled(mutate, traced) }),
    [traced],
  );
  const preview = useCallback(
    (mutate: Mutation) => dispatch({ kind: "preview", mutate: settled(mutate, traced) }),
    [traced],
  );
  const commitCheckpoint = useCallback(
    (snapshot: BuilderSceneData) => dispatch({ kind: "checkpoint", snapshot }),
    [],
  );
  const undo = useCallback(() => dispatch({ kind: "undo" }), []);
  const redo = useCallback(() => dispatch({ kind: "redo" }), []);

  // ---- component edits -----------------------------------------------------

  const addComponent = useCallback(
    /** `x` and `z` place it at its default height. */
    (type: ComponentType, [x, , z]: Vec3, extra?: { label?: string; host?: string; symbol?: BlockSymbol }): string => {
      const id = createComponentId(type);
      commit((current) => {
        const placed: BuilderSceneData = {
          ...current,
          components: [...current.components, {
            ...newComponent(type, id, x, z, extra),
            ...(type === "laser-source" ? { lightColor: nextLaserLightColor(current.components) } : {}),
          }],
        };
        if (!traced) return placed;
        const aimed = settleAims(placed).scene;
        return catchAims(insertIntoAimedPath(aimed, id), id);
      });
      return id;
    },
    [commit, traced],
  );

  const updateComponent = useCallback(
    (id: string, patch: Partial<Omit<BuilderComponent, "id" | "type">>, record = true) => {
      const apply: Mutation = (current) => ({
        ...current,
        components: current.components.map((component) =>
          component.id === id ? { ...component, ...patch } : component,
        ),
      });
      if (record) commit(apply);
      else preview(apply);
    },
    [commit, preview],
  );

  const setStageMount = useCallback(
    (opticId: string, stageId: string | undefined) =>
      commit((current) => setStageMountInScene(current, opticId, stageId)),
    [commit],
  );

  const moveComponent = useCallback(
    (id: string, x: number, z: number, record = false) => {
      const [clampedX, clampedZ] = clampToTable(x, z);
      const apply: Mutation = (current) => ({
        ...current,
        components: current.components.map((component) =>
          component.id === id
            ? { ...component, position: [clampedX, component.position[1], clampedZ] as Vec3 }
            : component,
        ),
      });
      if (record) commit(apply);
      else preview(apply);
    },
    [commit, preview],
  );

  // ---- group edits: one undo step each, for one part or several -----------

  /** A drag in flight: each part at its origin plus (dx, dz), with no undo step. */
  const translateComponents = useCallback(
    (origins: Record<string, Vec3>, dx: number, dz: number) =>
      preview((current) => groupEdits.translateComponents(current, origins, dx, dz)),
    [preview],
  );

  const nudgeComponents = useCallback(
    (ids: string[], dx: number, dz: number) =>
      commit((current) => groupEdits.nudgeComponents(current, ids, dx, dz)),
    [commit],
  );

  /** A handle turn in flight: each part `degrees` round `centre` from its origin pose, with no undo step. */
  const turnComponents = useCallback(
    (origins: Record<string, groupEdits.Pose>, centre: [number, number], degrees: number) =>
      preview((current) => {
        const turned = groupEdits.turnComponents(current, origins, centre, degrees);
        if (!traced) return turned;
        return { ...turned, components: turned.components.map((part) => origins[part.id] && canAim(part)
          ? { ...part, aim: undefined, free: true }
          : part) };
      }),
    [preview, traced],
  );

  const rotateComponents = useCallback(
    (ids: string[], direction: 1 | -1 = 1) =>
      commit((current) => {
        const turned = groupEdits.rotateComponents(current, ids, direction);
        if (!traced) return turned;
        return { ...turned, components: turned.components.map((part) => ids.includes(part.id) && canAim(part)
          ? { ...part, aim: undefined, free: true }
          : part) };
      }),
    [commit, traced],
  );

  const setAim = useCallback((id: string, targetId: string) => commit((current) => aimAt(current, id, targetId)), [commit]);
  const flipAim = useCallback((id: string) => commit((current) => flipFold(current, id)), [commit]);
  const snapAim = useCallback((id: string) => commit((current) => ({ ...current, components: current.components.map((part) =>
    part.id === id && canAim(part) ? { ...part, aim: undefined, free: undefined } : part,
  ) })), [commit]);
  const finishAimDrag = useCallback((id: string) => {
    if (!traced) return;
    preview((current) => catchAims(insertIntoAimedPath(current, id), id));
  }, [preview, traced]);

  const deleteComponents = useCallback(
    (ids: string[]) => commit((current) => groupEdits.deleteComponents(current, ids)),
    [commit],
  );

  /** The copies' ids, in the order of `ids`. */
  const duplicateComponents = useCallback(
    (ids: string[]): string[] => {
      // made here, not in the reducer, so they can be handed back
      const copies = new Map<string, string>();
      for (const id of ids) {
        const source = scene.components.find((component) => component.id === id);
        if (source) copies.set(id, createComponentId(source.type));
      }
      if (copies.size === 0) return [];
      commit(
        (current) =>
          groupEdits.duplicateComponents(current, ids, {
            component: (source) => copies.get(source.id) ?? createComponentId(source.type),
            beam: () => createBeamId(),
            connection: (source) => createConnectionId(source.kind),
          }).scene,
      );
      return [...copies.values()];
    },
    [commit, scene.components],
  );

  const setComponentsHeight = useCallback(
    (ids: string[], height: number) =>
      commit((current) => groupEdits.setComponentsHeight(current, ids, height)),
    [commit],
  );

  const setMountColor = useCallback(
    (ids: string[], color: string) =>
      commit((current) => groupEdits.setMountColor(current, ids, color)),
    [commit],
  );

  // ---- beam edits ----------------------------------------------------------

  const addBeam = useCallback(
    (path: string[], color?: string, label?: string, inheritColor = false, fromTrace = false) => {
      if (path.length < 2) return;
      const id = createBeamId();
      commit((current) => {
        const sameSource = current.beams.filter((beam) => beam.path[0] === path[0]);
        const parent = sameSource
          .filter((beam) => beam.path.length < path.length && beam.path.every((id, index) => path[index] === id))
          .sort((a, b) => b.path.length - a.path.length)[0] ?? sameSource[0];
        const added: BuilderSceneData = { ...current, beams: [
          ...current.beams,
          {
            id,
            path,
            color: color ?? BEAM_COLORS[current.beams.length % BEAM_COLORS.length],
            label: parent && !fromTrace ? undefined : label,
            ...(parent ? {
              parentId: parent.id,
              ...(inheritColor ? { inheritColor: true } : {}),
              ...(!fromTrace ? { inheritLabel: true, inheritHidden: true } : {}),
            } : {}),
          },
        ] };
        if (!traced || fromTrace) return added;
        return path.slice(1).reduce((next, id, index) => {
          const from = path[index];
          return next.components.some((part) => part.id === from && canAim(part)) ? aimAt(next, from, id) : next;
        }, added);
      });
      return id;
    },
    [commit, traced],
  );

  const updateBeam = useCallback(
    (id: string, patch: Partial<Omit<Beam, "id">>, record = true) => {
      const apply: Mutation = (current) => ({
        ...current,
        beams: current.beams.map((beam) => (beam.id === id ? { ...beam, ...patch } : beam)),
      });
      if (record) commit(apply);
      else preview(apply);
    },
    [commit, preview],
  );

  const deleteBeam = useCallback(
    (id: string) => {
      commit((current) => ({
        ...current,
        beams: removeBeamBranch(current.beams, id),
      }));
    },
    [commit],
  );

  /** Drop a beam at index `to` of the list; the beam's new place, or null when it can't go there. */
  const moveBeam = useCallback(
    (id: string, to: number): number | null => {
      const edit = moveBeamInList(scene.beams, id, to);
      if (!edit.ok) return null;
      commit((current) => {
        const moved = moveBeamInList(current.beams, id, to);
        return moved.ok ? { ...current, beams: moved.beams } : current;
      });
      return to;
    },
    [commit, scene.beams],
  );

  /** Hide or show a beam on the table: one undo step, and nothing else about the beam changes. */
  const setBeamHidden = useCallback(
    (id: string, hidden: boolean) =>
      commit((current) => ({ ...current, beams: setBeamHiddenInList(current.beams, id, hidden) })),
    [commit],
  );

  // ---- frame edits ---------------------------------------------------------

  /** A new frame with these corners, in standard form, in the next colour: one undo step; its id. */
  const addFrame = useCallback(
    (corners: Corner[]): string => {
      const id = createFrameId();
      commit((current) => ({
        ...current,
        frames: [...current.frames, { id, corners, color: FRAME_COLORS[current.frames.length % FRAME_COLORS.length] }],
      }));
      return id;
    },
    [commit],
  );

  const updateFrame = useCallback(
    (id: string, patch: Partial<Omit<Frame, "id">>, record = true) => {
      const apply: Mutation = (current) => ({
        ...current,
        frames: current.frames.map((frame) => (frame.id === id ? { ...frame, ...patch } : frame)),
      });
      if (record) commit(apply);
      else preview(apply);
    },
    [commit, preview],
  );

  /** Slide a frame whole, unrecorded, so its first corner sits at (x, z), held on the table. */
  const moveFrame = useCallback(
    (id: string, x: number, z: number) =>
      preview((current) => ({
        ...current,
        frames: current.frames.map((frame) => {
          if (frame.id !== id) return frame;
          const [fx, fz] = frame.corners[0];
          return { ...frame, corners: translateCorners(frame.corners, x - fx, z - fz) };
        }),
      })),
    [preview],
  );

  const deleteFrame = useCallback(
    (id: string) =>
      commit((current) =>
        groups.pruneMembers({ ...current, frames: current.frames.filter((frame) => frame.id !== id) }),
      ),
    [commit],
  );

  /** Drop a frame at index `to` of the list; the frame's new place, or null when it can't go there. */
  const reorderFrame = useCallback(
    (id: string, to: number): number | null => {
      const edit = moveFrameInList(scene.frames, id, to);
      if (!edit.ok) return null;
      commit((current) => {
        const moved = moveFrameInList(current.frames, id, to);
        return moved.ok ? { ...current, frames: moved.frames } : current;
      });
      return to;
    },
    [commit, scene.frames],
  );

  /** Hide or show a frame: one undo step, and nothing else about it changes. */
  const setFrameHidden = useCallback(
    (id: string, hidden: boolean) =>
      commit((current) => ({ ...current, frames: setFrameHiddenInList(current.frames, id, hidden) })),
    [commit],
  );

  // ---- whole-scene ---------------------------------------------------------

  /** A new group of these parts and frames, one undo step; its id comes back. */
  const createGroup = useCallback(
    (memberIds: string[], name?: string): string => {
      const id = groups.createGroupId();
      let first = true;
      const makeId = () => {
        if (!first) return groups.createGroupId();
        first = false;
        return id;
      };
      commit((current) => {
        first = true;
        return groups.createGroup(current, memberIds, name, makeId).scene;
      });
      return id;
    },
    [commit],
  );
  const renameGroup = useCallback(
    (id: string, name: string) => commit((current) => groups.renameGroup(current, id, name)),
    [commit],
  );
  /** A group's colour; unrecorded while a picker drags, after a checkpoint. */
  const setGroupColor = useCallback(
    (id: string, color: string, record = true) => {
      const apply: Mutation = (current) => groups.setGroupColor(current, id, color);
      if (record) commit(apply);
      else preview(apply);
    },
    [commit, preview],
  );
  const setGroupHidden = useCallback(
    // three states, shown → faded → hidden
    (id: string, show: groups.GroupShow) => commit((current) => groups.setGroupShow(current, id, show)),
    [commit],
  );
  const setGroupMembership = useCallback(
    (groupId: string, id: string | string[], isMember: boolean) =>
      commit((current) => groups.setMembership(current, groupId, id, isMember)),
    [commit],
  );
  const deleteGroup = useCallback(
    (id: string) => commit((current) => groups.deleteGroup(current, id)),
    [commit],
  );

  /** The labels' size; unrecorded while a slider drags, after a checkpoint. */
  const setLabelScale = useCallback(
    (value: number, record = true) => {
      const apply: Mutation = (current) => {
        const labelScale = parseLabelScale(value);
        if (labelScale === current.labelScale) return current;
        const { labelScale: _old, ...rest } = current;
        void _old;
        return labelScale === undefined ? rest : { ...rest, labelScale };
      };
      if (record) commit(apply);
      else preview(apply);
    },
    [commit, preview],
  );

  const replaceScene = useCallback((next: BuilderSceneData) => commit(() => next), [commit]);
  const clearScene = useCallback(() => commit(() => EMPTY_SCENE), [commit]);
  const resetToExample = useCallback(() => commit(() => DEFAULT_SCENE), [commit]);

  // ---- connection edits ----------------------------------------------------

  const addConnection = useCallback(
    (kind: ConnectionKind, from: string, to: string): string => {
      const id = createConnectionId(kind);
      commit((current) => ({
        ...current,
        connections: [...current.connections, { id, kind, from, to, color: CONNECTION_KINDS[kind].color }],
      }));
      return id;
    },
    [commit],
  );

  const updateConnection = useCallback(
    (id: string, patch: Partial<Omit<Connection, "id">>, record = true) => {
      const apply: Mutation = (current) => ({
        ...current,
        connections: current.connections.map((connection) =>
          connection.id === id ? { ...connection, ...patch } : connection,
        ),
      });
      if (record) commit(apply);
      else preview(apply);
    },
    [commit, preview],
  );

  const deleteConnection = useCallback(
    (id: string) => {
      commit((current) => ({
        ...current,
        connections: current.connections.filter((connection) => connection.id !== id),
      }));
    },
    [commit],
  );

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return useMemo(
    () => ({
      scene,
      canUndo,
      canRedo,
      undo,
      redo,
      commitCheckpoint,
      addComponent,
      updateComponent,
      setStageMount,
      moveComponent,
      translateComponents,
      nudgeComponents,
      rotateComponents,
      setAim,
      flipAim,
      snapAim,
      finishAimDrag,
      turnComponents,
      deleteComponents,
      duplicateComponents,
      setComponentsHeight,
      setMountColor,
      addBeam,
      updateBeam,
      deleteBeam,
      moveBeam,
      setBeamHidden,
      addFrame,
      updateFrame,
      moveFrame,
      deleteFrame,
      reorderFrame,
      setFrameHidden,
      setLabelScale,
      createGroup,
      renameGroup,
      setGroupColor,
      setGroupHidden,
      setGroupMembership,
      deleteGroup,
      replaceScene,
      clearScene,
      resetToExample,
      addConnection,
      updateConnection,
      deleteConnection,
      snapToGrid,
    }),
    [
      scene,
      canUndo,
      canRedo,
      undo,
      redo,
      commitCheckpoint,
      addComponent,
      updateComponent,
      setStageMount,
      moveComponent,
      translateComponents,
      nudgeComponents,
      rotateComponents,
      setAim,
      flipAim,
      snapAim,
      finishAimDrag,
      turnComponents,
      deleteComponents,
      duplicateComponents,
      setComponentsHeight,
      setMountColor,
      addBeam,
      updateBeam,
      deleteBeam,
      moveBeam,
      setBeamHidden,
      addFrame,
      updateFrame,
      moveFrame,
      deleteFrame,
      reorderFrame,
      setFrameHidden,
      setLabelScale,
      createGroup,
      renameGroup,
      setGroupColor,
      setGroupHidden,
      setGroupMembership,
      deleteGroup,
      replaceScene,
      clearScene,
      resetToExample,
      addConnection,
      updateConnection,
      deleteConnection,
    ],
  );
}

export type BuilderSceneApi = ReturnType<typeof useBuilderScene>;
