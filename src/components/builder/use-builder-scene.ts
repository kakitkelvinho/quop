"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import * as groupEdits from "@/components/builder/group-edits";
import * as groups from "@/components/builder/groups";
import {
  BEAM_COLORS,
  BLOCK_SIZE_MM,
  CONNECTION_KINDS,
  DEFAULT_BLOCK_COLOR,
  DEFAULT_CAVITY_LENGTH_MM,
  DEFAULT_FOCAL_LENGTH_MM,
  FRAME_COLORS,
  DEFAULT_MOUNT_COLOR,
  PERISCOPE_RISE_MM,
  DEFAULT_SCENE,
  EMPTY_SCENE,
  clampToTable,
  createBeamId,
  createComponentId,
  createConnectionId,
  createFrameId,
  defaultHeight,
  moveBeamTo as moveBeamInList,
  moveFrameTo as moveFrameInList,
  parseLabelScale,
  parseScene,
  setBeamHidden as setBeamHiddenInList,
  setFrameHidden as setFrameHiddenInList,
  settleAngles,
  settleHosts,
  settlePeriscopes,
  snapToGrid,
  clampHeight,
  translateCorners,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
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
 * Every edit ends with hosted particles back at their host's centre and
 * periscope top mirrors over their lower ones, then mirrors in the middle of
 * a beam turned to reflect it.
 */
function settled(mutate: Mutation): Mutation {
  return (scene) => {
    const next = mutate(scene);
    return next === scene ? scene : settleAngles(settlePeriscopes(settleHosts(next)));
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
    /**
     * `x` and `z` place it; it always starts at its default height. A
     * periscope comes with its top mirror, PERISCOPE_RISE_MM above it.
     */
    (type: ComponentType, [x, , z]: Vec3, extra?: { label?: string; host?: string }): string => {
      const id = createComponentId(type);
      const top: BuilderComponent[] =
        type === "periscope"
          ? [
              {
                id: createComponentId("periscope-top"),
                type: "periscope-top",
                position: [x, clampHeight("periscope-top", defaultHeight(type) + PERISCOPE_RISE_MM), z],
                rotation: 0,
                color: DEFAULT_MOUNT_COLOR,
                periscope: id,
              },
            ]
          : [];
      commit((current) => ({
        ...current,
        components: [
          ...current.components,
          {
            id,
            type,
            position: [x, defaultHeight(type), z],
            rotation: 0,
            color: type === "mirror-mount" || type === "periscope" ? DEFAULT_MOUNT_COLOR : undefined,
            label: extra?.label,
            ...(type === "lens"
              ? { lensShape: "plano-convex" as const, focalLength: DEFAULT_FOCAL_LENGTH_MM }
              : {}),
            ...(type === "cavity" ? { cavityLength: DEFAULT_CAVITY_LENGTH_MM } : {}),
            ...(type === "block" ? { size: [...BLOCK_SIZE_MM] as Vec3, color: DEFAULT_BLOCK_COLOR } : {}),
            ...(extra?.host ? { host: extra.host } : {}),
          },
          ...top,
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

  /** A handle turn in flight: each part `degrees` round `centre` from its origin pose, with no undo step. */
  const turnComponents = useCallback(
    (origins: Record<string, groupEdits.Pose>, centre: [number, number], degrees: number) =>
      preview((current) => groupEdits.turnComponents(current, origins, centre, degrees)),
    [preview],
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
      moveComponent,
      translateComponents,
      nudgeComponents,
      rotateComponents,
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
