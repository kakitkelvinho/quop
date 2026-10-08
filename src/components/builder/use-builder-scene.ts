"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";

import * as groupEdits from "@/components/builder/group-edits";
import {
  BEAM_COLORS,
  BLOCK_SIZE_MM,
  CONNECTION_KINDS,
  DEFAULT_BLOCK_COLOR,
  DEFAULT_CAVITY_LENGTH_MM,
  DEFAULT_FOCAL_LENGTH_MM,
  DEFAULT_MOUNT_COLOR,
  DEFAULT_SCENE,
  EMPTY_SCENE,
  clampToTable,
  createBeamId,
  createComponentId,
  createConnectionId,
  defaultHeight,
  parseScene,
  settleAngles,
  settleHosts,
  snapToGrid,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  type Connection,
  type ConnectionKind,
  type Vec3,
} from "@/components/builder/types";

// The key predates scene versions 2 and 3; parseScene reads every version.
const STORAGE_KEY = "quop.builder.scene.v1";
const HISTORY_LIMIT = 60;

type Mutation = (scene: BuilderSceneData) => BuilderSceneData;

/**
 * Every edit ends with hosted particles back at their host's centre, then
 * mirrors in the middle of a beam turned to reflect it.
 */
function settled(mutate: Mutation): Mutation {
  return (scene) => {
    const next = mutate(scene);
    return next === scene ? scene : settleAngles(settleHosts(next));
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
 * The builder only ever renders on the client (the page loads it with
 * `ssr: false`), so the autosaved table can be read straight into the initial
 * state — no hydration mismatch, no flash of the example layout.
 */
function initialState(): HistoryState {
  let scene = DEFAULT_SCENE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseScene(JSON.parse(stored));
      if (parsed) scene = parsed;
    }
  } catch {
    // A corrupt autosave should never block the page — fall back to the example.
  }
  return { scene, past: [], future: [] };
}

export function useBuilderScene() {
  const [state, dispatch] = useReducer(reducer, null, initialState);
  const { scene } = state;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
    } catch {
      // Private mode / quota: autosave is a convenience, not a requirement.
    }
  }, [scene]);

  const commit = useCallback(
    (mutate: Mutation) => dispatch({ kind: "commit", mutate: settled(mutate) }),
    [],
  );
  const preview = useCallback(
    (mutate: Mutation) => dispatch({ kind: "preview", mutate: settled(mutate) }),
    [],
  );
  const commitCheckpoint = useCallback(
    (snapshot: BuilderSceneData) => dispatch({ kind: "checkpoint", snapshot }),
    [],
  );
  const undo = useCallback(() => dispatch({ kind: "undo" }), []);
  const redo = useCallback(() => dispatch({ kind: "redo" }), []);

  // ---- component edits -----------------------------------------------------

  const addComponent = useCallback(
    /** `x` and `z` place it; it always starts at its default height. */
    (type: ComponentType, [x, , z]: Vec3, extra?: { label?: string; host?: string }): string => {
      const id = createComponentId(type);
      commit((current) => ({
        ...current,
        components: [
          ...current.components,
          {
            id,
            type,
            position: [x, defaultHeight(type), z],
            rotation: 0,
            color: type === "mirror-mount" ? DEFAULT_MOUNT_COLOR : undefined,
            label: extra?.label,
            ...(type === "lens"
              ? { lensShape: "plano-convex" as const, focalLength: DEFAULT_FOCAL_LENGTH_MM }
              : {}),
            ...(type === "cavity" ? { cavityLength: DEFAULT_CAVITY_LENGTH_MM } : {}),
            ...(type === "block" ? { size: [...BLOCK_SIZE_MM] as Vec3, color: DEFAULT_BLOCK_COLOR } : {}),
            ...(extra?.host ? { host: extra.host } : {}),
          },
        ],
      }));
      return id;
    },
    [commit],
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

  const rotateComponents = useCallback(
    (ids: string[], direction: 1 | -1 = 1) =>
      commit((current) => groupEdits.rotateComponents(current, ids, direction)),
    [commit],
  );

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
    (path: string[], color?: string, label?: string) => {
      if (path.length < 2) return;
      commit((current) => ({
        ...current,
        beams: [
          ...current.beams,
          {
            id: createBeamId(),
            path,
            color: color ?? BEAM_COLORS[current.beams.length % BEAM_COLORS.length],
            label,
          },
        ],
      }));
    },
    [commit],
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
        beams: current.beams.filter((beam) => beam.id !== id),
      }));
    },
    [commit],
  );

  // ---- whole-scene ---------------------------------------------------------

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
      moveComponent,
      translateComponents,
      nudgeComponents,
      rotateComponents,
      deleteComponents,
      duplicateComponents,
      setComponentsHeight,
      setMountColor,
      addBeam,
      updateBeam,
      deleteBeam,
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
      moveComponent,
      translateComponents,
      nudgeComponents,
      rotateComponents,
      deleteComponents,
      duplicateComponents,
      setComponentsHeight,
      setMountColor,
      addBeam,
      updateBeam,
      deleteBeam,
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
