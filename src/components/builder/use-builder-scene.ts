"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";

import {
  BEAM_COLORS,
  DEFAULT_MOUNT_COLOR,
  DEFAULT_SCENE,
  EMPTY_SCENE,
  GRID_SIZE_MM,
  ROTATION_STEP_DEG,
  clampToTable,
  createBeamId,
  createComponentId,
  parseScene,
  snapToGrid,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  type Vec3,
} from "@/components/builder/types";

const STORAGE_KEY = "quop.builder.scene.v1";
const HISTORY_LIMIT = 60;

type Mutation = (scene: BuilderSceneData) => BuilderSceneData;

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

  const commit = useCallback((mutate: Mutation) => dispatch({ kind: "commit", mutate }), []);
  const preview = useCallback((mutate: Mutation) => dispatch({ kind: "preview", mutate }), []);
  const commitCheckpoint = useCallback(
    (snapshot: BuilderSceneData) => dispatch({ kind: "checkpoint", snapshot }),
    [],
  );
  const undo = useCallback(() => dispatch({ kind: "undo" }), []);
  const redo = useCallback(() => dispatch({ kind: "redo" }), []);

  // ---- component edits -----------------------------------------------------

  const addComponent = useCallback(
    (type: ComponentType, position: Vec3, label?: string): string => {
      const id = createComponentId(type);
      commit((current) => ({
        ...current,
        components: [
          ...current.components,
          {
            id,
            type,
            position,
            rotation: 0,
            color: type === "mirror-mount" ? DEFAULT_MOUNT_COLOR : undefined,
            label,
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
      updateComponent(id, { position: [clampedX, 0, clampedZ] }, record);
    },
    [updateComponent],
  );

  const nudgeComponent = useCallback(
    (id: string, dx: number, dz: number) => {
      commit((current) => ({
        ...current,
        components: current.components.map((component) => {
          if (component.id !== id) return component;
          const [x, z] = clampToTable(component.position[0] + dx, component.position[2] + dz);
          return { ...component, position: [x, 0, z] as Vec3 };
        }),
      }));
    },
    [commit],
  );

  const rotateComponent = useCallback(
    (id: string, direction: 1 | -1 = 1) => {
      commit((current) => ({
        ...current,
        components: current.components.map((component) =>
          component.id === id
            ? {
                ...component,
                rotation: (component.rotation + direction * ROTATION_STEP_DEG + 360) % 360,
              }
            : component,
        ),
      }));
    },
    [commit],
  );

  const deleteComponent = useCallback(
    (id: string) => {
      commit((current) => ({
        ...current,
        components: current.components.filter((component) => component.id !== id),
        // a beam that loses a stop keeps going; one left with a single stop is gone
        beams: current.beams
          .map((beam) => ({ ...beam, path: beam.path.filter((entry) => entry !== id) }))
          .filter((beam) => beam.path.length >= 2),
      }));
    },
    [commit],
  );

  const duplicateComponent = useCallback(
    (id: string): string | null => {
      const source = scene.components.find((component) => component.id === id);
      if (!source) return null;
      const newId = createComponentId(source.type);
      const [x, z] = clampToTable(
        source.position[0] + GRID_SIZE_MM,
        source.position[2] + GRID_SIZE_MM,
      );
      commit((current) => ({
        ...current,
        components: [...current.components, { ...source, id: newId, position: [x, 0, z] }],
      }));
      return newId;
    },
    [commit, scene.components],
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
    (id: string, patch: Partial<Omit<Beam, "id">>) => {
      commit((current) => ({
        ...current,
        beams: current.beams.map((beam) => (beam.id === id ? { ...beam, ...patch } : beam)),
      }));
    },
    [commit],
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
      nudgeComponent,
      rotateComponent,
      deleteComponent,
      duplicateComponent,
      addBeam,
      updateBeam,
      deleteBeam,
      replaceScene,
      clearScene,
      resetToExample,
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
      nudgeComponent,
      rotateComponent,
      deleteComponent,
      duplicateComponent,
      addBeam,
      updateBeam,
      deleteBeam,
      replaceScene,
      clearScene,
      resetToExample,
    ],
  );
}

export type BuilderSceneApi = ReturnType<typeof useBuilderScene>;
