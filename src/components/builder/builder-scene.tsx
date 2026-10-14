"use client";

import type { ThreeEvent } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import PrototypeSwitcher, { useVariant } from "@/components/prototype-switcher";
import { HOLE_VARIANTS, type HoleVariant } from "@/components/builder/table-holes.prototype";
const HOLE_VARIANT_KEYS = Object.keys(HOLE_VARIANTS) as HoleVariant[];
import BuilderCanvas, {
  CLICK_SLOP_PX,
  type CameraView,
  type CanvasApi,
  tablePoint,
} from "@/components/builder/builder-canvas";
import BuilderHud, { type ConnectDraft } from "@/components/builder/builder-hud";
import {
  clickDrawing,
  dragRectangle,
  finishDrawing,
  previewDrawing,
  type DrawingPreview,
  type DrawingStep,
} from "@/components/builder/frame-drawing";
import { DEFAULT_LIGHTING, useScenePalette, type Lighting } from "@/components/builder/scene-theme";
import { readStoredQuality, storeQuality, type GraphicsQuality } from "@/components/builder/graphics-quality";
import { SETUP_BRIEF_FILENAME, setupBrief } from "@/components/builder/setup-brief";
import { useBoxSelect, type ScreenBox } from "@/components/builder/use-box-select";
import { useBuilderScene } from "@/components/builder/use-builder-scene";
import { posesOf, turnCentre, type Pose } from "@/components/builder/group-edits";
import type { RotationHandleSpec } from "@/components/builder/rotation-handle";
import { dragGrip, type FrameGrip } from "@/components/builder/frame-reshape";
import { useFrameDrawing } from "@/components/builder/use-frame-drawing";
import { getTheme, setTheme } from "@/components/theme-toggle";
import {
  BEAM_COLORS,
  CONNECTION_KINDS,
  FINE_GRID_MM,
  FINE_ROTATION_STEP_DEG,
  ROTATION_STEP_DEG,
  componentRadius,
  handleSweep,
  FRAME_COLORS,
  GRID_SIZE_MM,
  bodyCentre,
  clampToTable,
  componentById,
  periscopePartner,
  selectableId,
  withPeriscopePartners,
  componentDisplayName,
  findHost,
  appendStop,
  beamDisplayName,
  frameDisplayName,
  moveBeamTo,
  moveFrameTo,
  derivedAngleBeam,
  delayRailOffset,
  delaySetting,
  serializeScene,
  beamLineSnap,
  snapToGrid,
  translateCorners,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  type Corner,
  type Vec3,
} from "@/components/builder/types";

/** A turn by the rotation handle in flight. */
type TurnState = {
  /** each part the turn carries, as it stood at the press */
  origins: Record<string, Pose>;
  /** the point it turns about, [x, z] mm: one part's reference point, or a group's centre */
  centre: [number, number];
  /** the pointer's angle about the centre at the press, degrees */
  startAngle: number;
  /** how far it has turned, snapped */
  turned: number;
  started: boolean;
};

/** A delay line's stage being slid by its handle. */
type SlideState = {
  id: string;
  /** how far the stage had travelled at the press, mm */
  startStage: number;
  /** how far down the rail the press was, mm (see delayRailOffset) */
  grab: number;
  started: boolean;
};

/** The angle of (x, z) about `centre`, degrees, counter-clockwise from above as yaw is. */
function angleAbout([centreX, centreZ]: [number, number], x: number, z: number): number {
  return (Math.atan2(-(z - centreZ), x - centreX) * 180) / Math.PI;
}

type DragState = {
  id: string;
  offsetX: number;
  offsetZ: number;
  started: boolean;
  /** where the press landed, client px */
  pressX: number;
  pressY: number;
  /** the selection it drags along, when the part was pressed as one of several */
  group: string[] | null;
  /** the group's positions at its first move; every step is measured from these */
  origins: Record<string, Vec3> | null;
};

type FrameDragState = {
  id: string;
  /** from the grab point to the frame's first corner, mm */
  offsetX: number;
  offsetZ: number;
  started: boolean;
};

/** A side or corner of the selected frame being dragged to reshape it. */
type FrameReshapeState = {
  id: string;
  grip: FrameGrip;
  /** the outline at the press; every step is measured from it */
  corners: Corner[];
  /** from the grab point to the grip's corner, mm */
  offsetX: number;
  offsetZ: number;
  /** where the grip's corner last got to: a drag stops at the last valid outline */
  reached: Corner;
  started: boolean;
};

/** A frame being drawn, from "Add a frame" until it is finished or cancelled. */
type FrameDrawing = {
  /** placed so far, in click order */
  corners: Corner[];
  /** the pointer over the table, the grid it snaps to, and whether it is on the first corner on screen */
  pointer: { point: Corner; step: number; onFirst: boolean } | null;
  /** dragged out from a press before the first corner */
  rectangle: { corners: Corner[]; reason: string | null } | null;
  /** the last click was refused, so the double-click it starts doesn't finish */
  refused: boolean;
};

const NEW_DRAWING: FrameDrawing = { corners: [], pointer: null, rectangle: null, refused: false };

/** How near the first corner, client px, a click closes the outline. */
const FIRST_CORNER_PX = 10;

function clampXZ(x: number, y: number, z: number): [number, number, number] {
  const [clampedX, clampedZ] = clampToTable(x, z);
  return [clampedX, y, clampedZ];
}

function positionsOf(components: BuilderComponent[], ids: string[]): Record<string, Vec3> {
  const wanted = new Set(ids);
  return Object.fromEntries(
    components
      .filter((component) => wanted.has(component.id))
      .map((component) => [component.id, component.position]),
  );
}

/** quop-setup-YYYYMMDD (ISO 8601 basic) on the local date, so files sort by day. */
function setupFileName(extension: "json" | "png"): string {
  const now = new Date();
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return `quop-setup-${day}.${extension}`;
}

/**
 * The view as a PNG data URL, part labels included. The labels are HTML laid
 * over the canvas (drei's Html), so the canvas's own pixels leave them out;
 * each one is drawn back on where it sits on screen, in its own colours.
 */
function exportViewPng(canvas: HTMLCanvasElement): string {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const context = out.getContext("2d");
  if (!context) return canvas.toDataURL("image/png");

  context.drawImage(canvas, 0, 0);

  const box = canvas.getBoundingClientRect();
  const scale = box.width > 0 ? canvas.width / box.width : 1;
  const labels = canvas.parentElement?.parentElement?.querySelectorAll<HTMLElement>(".builderLabel") ?? [];

  for (const label of labels) {
    const rect = label.getBoundingClientRect();
    const text = label.textContent ?? "";
    const offCanvas =
      rect.right < box.left || rect.left > box.right || rect.bottom < box.top || rect.top > box.bottom;
    if (!text || rect.width === 0 || offCanvas) continue;

    const style = getComputedStyle(label);
    const x = (rect.left - box.left) * scale;
    const y = (rect.top - box.top) * scale;
    const width = rect.width * scale;
    const height = rect.height * scale;

    context.beginPath();
    context.roundRect(x, y, width, height, (parseFloat(style.borderTopLeftRadius) || 0) * scale);
    context.fillStyle = style.backgroundColor;
    context.fill();
    context.lineWidth = (parseFloat(style.borderTopWidth) || 0) * scale;
    if (context.lineWidth > 0) {
      context.strokeStyle = style.borderTopColor;
      context.stroke();
    }
    context.fillStyle = style.color;
    context.font = `${style.fontWeight} ${parseFloat(style.fontSize) * scale}px ${style.fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, x + width / 2, y + height / 2);
  }

  return out.toDataURL("image/png");
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  // a slider or colour picker has no text to edit, so builder keys still apply
  if (target instanceof HTMLInputElement && ["range", "color", "checkbox"].includes(target.type)) {
    return false;
  }
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export default function BuilderScene() {
  const api = useBuilderScene();
  const palette = useScenePalette();
  const { scene } = api;

  // component ids in the order they were picked; the last is the primary
  const [selection, setSelection] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedBeamId, setSelectedBeamId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  // a frame is selected on its own, never along with parts
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [placingType, setPlacingType] = useState<ComponentType | null>(null);
  const [beamMode, setBeamMode] = useState(false);
  const [beamDraft, setBeamDraft] = useState<string[]>([]);
  const [connectDraft, setConnectDraft] = useState<ConnectDraft | null>(null);
  const [drawing, setDrawing] = useState<FrameDrawing | null>(null);
  // the frame just drawn, whose label field takes focus as it opens
  const [labelFocusId, setLabelFocusId] = useState<string | null>(null);
  // the beam "Add stops" is on for; it lapses as soon as another is selected
  const [addingStopsTo, setAddingStopsTo] = useState<string | null>(null);
  const [beamColor, setBeamColor] = useState<string>(BEAM_COLORS[0]);
  const [showLabels, setShowLabels] = useState(true);
  const [showDistances, setShowDistances] = useState(false);
  const [showGrid, setShowGrid] = useState(true); // PROTOTYPE: on, to judge the holes
  const [gridVariant, setGridVariant] = useVariant(HOLE_VARIANT_KEYS);
  const [showPosts, setShowPosts] = useState(true);
  const [lighting, setLighting] = useState<Lighting>(DEFAULT_LIGHTING);
  const [quality, setQuality] = useState<GraphicsQuality>("full");
  // whether a slow view may still step down to Light by itself: once a session,
  // and never over a choice made on the toggle, this visit or an earlier one
  const [autoQuality, setAutoQuality] = useState(true);
  const [view, setView] = useState<CameraView>("iso");
  const [fitToken, setFitToken] = useState(0);
  const [dragging, setDragging] = useState(false);
  // the straight line a dragged part is locked onto, while it is
  const [snapGuide, setSnapGuide] = useState<[Vec3, Vec3] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  const dragRef = useRef<DragState | null>(null);
  const turnRef = useRef<TurnState | null>(null);
  // the turn in flight, for drawing: its centre and how far it has gone
  const [turning, setTurning] = useState<{ centre: [number, number]; turned: number } | null>(null);
  const slideRef = useRef<SlideState | null>(null);
  const [sliding, setSliding] = useState(false);
  const frameDragRef = useRef<FrameDragState | null>(null);
  const frameReshapeRef = useRef<FrameReshapeState | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectRef = useRef<CanvasApi["project"] | null>(null);
  const tableAtRef = useRef<CanvasApi["tableAt"] | null>(null);
  // the part under the pointer, for a Ctrl/⌘ click the canvas never sees
  const hoveredRef = useRef<string | null>(null);
  // Pointer handlers run outside React's render pass and need the newest
  // scene without re-subscribing on every edit.
  const sceneRef = useRef(scene);
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  // an id undo or a delete took off the table drops out here, and a
  // periscope's top mirror stands for its periscope, selected by its lower one
  const selectedComponents = useMemo(
    () =>
      [...new Set(selection.map((id) => selectableId(scene.components, id)))]
        .map((id) => componentById(scene.components, id))
        .filter((component): component is BuilderComponent => component !== undefined),
    [scene.components, selection],
  );
  const selectedIds = useMemo(
    () => selectedComponents.map((component) => component.id),
    [selectedComponents],
  );
  // One part gets a handle about its reference point, unless a beam sets its
  // angle; several get one round them all. A particle in a trap turns with it.
  const rotationHandle = useMemo((): RotationHandleSpec | null => {
    if (selectedComponents.length === 1) {
      const [component] = selectedComponents;
      if (component.host) return null;
      return {
        kind: "part",
        component,
        locked: derivedAngleBeam(scene.beams, component) !== undefined,
        rotating: turning !== null,
      };
    }
    const centre = turning?.centre ?? turnCentre(scene, selectedIds);
    if (!centre) return null;
    // clear of every part: the farthest edge of a selection ring, and a little more
    const reach = Math.max(
      ...selectedComponents.map((component) => {
        const [x, , z] = bodyCentre(component);
        return Math.hypot(x - centre[0], z - centre[1]) + componentRadius(component);
      }),
    );
    return { kind: "group", centre, radius: reach + 14, turned: turning?.turned ?? 0, rotating: turning !== null };
  }, [scene, selectedComponents, selectedIds, turning]);

  // a lone delay line's carriage gets a handle to slide it along its rail
  const stageHandle = useMemo(() => {
    if (selectedComponents.length !== 1 || selectedComponents[0].type !== "delay-line") return null;
    return { component: selectedComponents[0], sliding };
  }, [selectedComponents, sliding]);

  const selectedBeam = useMemo(
    () => scene.beams.find((beam) => beam.id === selectedBeamId) ?? null,
    [scene.beams, selectedBeamId],
  );
  // a selected hidden beam shows on screen as a ghost, so it can be edited; a PNG leaves it out
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const stored = readStoredQuality();
    if (!stored) return;
    setQuality(stored);
    setAutoQuality(false);
  }, []);
  const ghostBeamId = selectedBeam?.hidden && !exporting ? selectedBeam.id : null;
  const selectedFrame = useMemo(
    () => scene.frames.find((frame) => frame.id === selectedFrameId) ?? null,
    [scene.frames, selectedFrameId],
  );
  const ghostFrameId = selectedFrame?.hidden && !exporting ? selectedFrame.id : null;
  const addingStops = selectedBeam !== null && addingStopsTo === selectedBeam.id;
  const selectedConnection = useMemo(
    () => scene.connections.find((connection) => connection.id === selectedConnectionId) ?? null,
    [scene.connections, selectedConnectionId],
  );

  // A transient line of feedback under the canvas — the builder does a lot of
  // things (export, load, clear) whose only evidence would otherwise be off-screen.
  const announce = useCallback((message: string) => {
    setStatus(message);
    window.setTimeout(
      () => setStatus((current) => (current === message ? null : current)),
      4000,
    );
  }, []);

  // ---- placing & selection -------------------------------------------------

  const handleSurfaceClick = useCallback(
    (x: number, z: number) => {
      if (beamMode || connectDraft || addingStops || drawing) return;
      if (placingType) {
        // a particle clicked onto a trap or cavity goes inside it
        const host =
          placingType === "particle"
            ? findHost(sceneRef.current.components, x, z)
            : undefined;
        const id = api.addComponent(
          placingType,
          [snapToGrid(x), 0, snapToGrid(z)],
          host ? { host: host.id } : undefined,
        );
        setSelection([id]);
        setSelectedConnectionId(null);
        setSelectedFrameId(null);
        setPlacingType(null);
        return;
      }
      setSelection([]);
      setSelectedBeamId(null);
      setSelectedFrameId(null);
      setSelectedConnectionId(null);
    },
    [addingStops, api, beamMode, connectDraft, drawing, placingType],
  );

  const handleComponentPointerDown = useCallback(
    (id: string, event: ThreeEvent<PointerEvent>) => {
      // middle and right drags orbit the camera, even when they start on a part;
      // while a frame is drawn, a click on a part puts a corner on the table under it
      if (event.nativeEvent.button !== 0 || drawing) return;
      if (beamMode) {
        setBeamDraft((current) =>
          current[current.length - 1] === id ? current : [...current, id],
        );
        return;
      }
      const pressed = componentById(sceneRef.current.components, id);
      if (!pressed) return;

      if (connectDraft) {
        // an undo may have taken away the part clicked first; then this click starts over
        const from = connectDraft.from && componentById(sceneRef.current.components, connectDraft.from);
        if (!from) {
          setConnectDraft({ ...connectDraft, from: id });
        } else if (from.id === id) {
          announce(`Can't connect ${componentDisplayName(pressed)} to itself.`);
        } else {
          setSelectedConnectionId(api.addConnection(connectDraft.kind, from.id, id));
          setConnectDraft(null);
          announce(`${CONNECTION_KINDS[connectDraft.kind].label} added.`);
        }
        return;
      }

      if (addingStops && selectedBeamId) {
        // onto the end, in click order, one undo step per stop
        const beam = sceneRef.current.beams.find((entry) => entry.id === selectedBeamId);
        if (!beam) return;
        const edit = appendStop(beam.path, id);
        if (edit.ok) api.updateBeam(beam.id, { path: edit.path });
        else announce(`Can't add ${componentDisplayName(pressed)}: ${edit.reason}.`);
        return;
      }

      setPlacingType(null);
      setSelectedBeamId(null);
      setSelectedFrameId(null);
      setSelectedConnectionId(null);
      // a periscope is selected, and dragged, by its lower mirror, which carries its top one
      const base = pressed.type === "periscope-top" ? periscopePartner(sceneRef.current.components, pressed) : undefined;
      const component = base ?? pressed;
      // pressed as one of several selected parts, it drags them all
      const group = selectedIds.length > 1 && selectedIds.includes(component.id) ? selectedIds : null;
      if (!group) setSelection([component.id]);
      // the press hits the part up at its height; the drag follows the table
      const [grabX, grabZ] = tablePoint(event.ray) ?? [event.point.x, event.point.z];
      dragRef.current = {
        id: component.id,
        offsetX: component.position[0] - grabX,
        offsetZ: component.position[2] - grabZ,
        started: false,
        pressX: event.nativeEvent.clientX,
        pressY: event.nativeEvent.clientY,
        group,
        origins: null,
      };
      setDragging(true);
    },
    [addingStops, announce, api, beamMode, connectDraft, drawing, selectedBeamId, selectedIds],
  );

  // ---- the rotation handle --------------------------------------------------

  const handleRotationHandlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (event.nativeEvent.button !== 0) return;
      const current = sceneRef.current;
      const centre = turnCentre(current, selectedIds);
      const grab = tablePoint(event.ray);
      if (!centre || !grab) return;
      turnRef.current = {
        origins: posesOf(current, selectedIds),
        centre,
        startAngle: angleAbout(centre, grab[0], grab[1]),
        turned: 0,
        started: false,
      };
      setTurning({ centre, turned: 0 });
      setDragging(true);
    },
    [selectedIds],
  );

  // ---- the stage handle ----------------------------------------------------

  const handleStageHandlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (event.nativeEvent.button !== 0 || selectedIds.length !== 1) return;
      const component = componentById(sceneRef.current.components, selectedIds[0]);
      const grab = tablePoint(event.ray);
      if (component?.type !== "delay-line" || !grab) return;
      slideRef.current = {
        id: component.id,
        startStage: delaySetting(component).stage,
        grab: delayRailOffset(component, grab[0], grab[1]),
        started: false,
      };
      setSliding(true);
      setDragging(true);
    },
    [selectedIds],
  );

  const handleComponentHover = useCallback((id: string | null) => {
    hoveredRef.current = id;
    setHoveredId(id);
  }, []);

  // Ctrl/⌘ + click adds the part under the pointer to the selection, or takes it out.
  const togglePointedPart = useCallback(() => {
    const id = hoveredRef.current && selectableId(sceneRef.current.components, hoveredRef.current);
    if (!id) return;
    setSelection((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
    setSelectedBeamId(null);
    setSelectedFrameId(null);
    setSelectedConnectionId(null);
  }, []);

  // Ctrl/⌘ + drag selects every part whose body's centre falls in the box;
  // with Shift as well, it adds them to the selection.
  const selectInBox = useCallback((box: ScreenBox, adding: boolean) => {
    const project = projectRef.current;
    if (!project) return;
    const inside = sceneRef.current.components
      .filter((component) => {
        const [x, y] = project(bodyCentre(component));
        return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      })
      .map((component) => component.id);
    setSelection((current) =>
      adding ? [...current, ...inside.filter((id) => !current.includes(id))] : inside,
    );
    setSelectedBeamId(null);
    setSelectedFrameId(null);
    setSelectedConnectionId(null);
  }, []);

  const selectionBox = useBoxSelect(hostRef, {
    enabled: !placingType && !beamMode && !connectDraft && !addingStops && !drawing,
    onClick: togglePointedPart,
    onBox: selectInBox,
  });

  const handleSurfaceDrag = useCallback(
    (x: number, z: number, event: PointerEvent) => {
      const slide = slideRef.current;
      if (slide) {
        const component = componentById(sceneRef.current.components, slide.id);
        if (!component) return;
        const { travel, stage } = delaySetting(component);
        // in whole millimetres, as the inspector's slider steps
        const moved = delayRailOffset(component, x, z) - slide.grab;
        const next = Math.min(travel, Math.max(0, Math.round(slide.startStage + moved)));
        if (next === stage) return;
        // like a move, the first real change earns the undo step
        if (!slide.started) {
          slide.started = true;
          api.commitCheckpoint(sceneRef.current);
        }
        api.updateComponent(slide.id, { delayStageMm: next }, false);
        return;
      }
      const turn = turnRef.current;
      if (turn) {
        const step = event.shiftKey ? FINE_ROTATION_STEP_DEG : ROTATION_STEP_DEG;
        const turned = handleSweep(turn.startAngle, angleAbout(turn.centre, x, z), step);
        if (turned === turn.turned) return;
        // like a move, the first real change earns the undo step
        if (!turn.started) {
          turn.started = true;
          api.commitCheckpoint(sceneRef.current);
        }
        turn.turned = turned;
        api.turnComponents(turn.origins, turn.centre, turned);
        setTurning({ centre: turn.centre, turned });
        return;
      }
      const reshape = frameReshapeRef.current;
      if (reshape) {
        const frame = sceneRef.current.frames.find((entry) => entry.id === reshape.id);
        if (!frame) return;
        const step = event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM;
        const to: Corner = [snapToGrid(x + reshape.offsetX, step), snapToGrid(z + reshape.offsetZ, step)];
        const { corners, reached } = dragGrip(reshape.corners, reshape.grip, reshape.reached, to, step);
        reshape.reached = reached;
        if (corners.length === frame.corners.length && corners.every(([cx, cz], at) => cx === frame.corners[at][0] && cz === frame.corners[at][1])) return;
        // like a move, the first real change earns the undo step
        if (!reshape.started) {
          reshape.started = true;
          api.commitCheckpoint(sceneRef.current);
        }
        api.updateFrame(reshape.id, { corners }, false);
        return;
      }
      const frameDrag = frameDragRef.current;
      if (frameDrag) {
        const frame = sceneRef.current.frames.find((entry) => entry.id === frameDrag.id);
        if (!frame) return;
        const step = event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM;
        // the first corner snaps to the grid, and every other corner moves with it
        const nextX = snapToGrid(x + frameDrag.offsetX, step);
        const nextZ = snapToGrid(z + frameDrag.offsetZ, step);
        if (frame.corners[0][0] === nextX && frame.corners[0][1] === nextZ) return;
        // like a part, the first real movement earns the undo step
        if (!frameDrag.started) {
          frameDrag.started = true;
          api.commitCheckpoint(sceneRef.current);
        }
        api.moveFrame(frameDrag.id, nextX, nextZ);
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;

      const step = event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM;
      let nextX = snapToGrid(x + drag.offsetX, step);
      let nextZ = snapToGrid(z + drag.offsetZ, step);

      const component = componentById(sceneRef.current.components, drag.id);
      if (!component) return;

      // A single part in the middle of a beam locks onto the straight line
      // between its neighbours when it comes close, ahead of the grid.
      // (a periscope's next stop is its own top mirror, which follows it, so it doesn't lock)
      const lock =
        drag.group || component.type === "particle" || component.type === "periscope"
          ? undefined
          : beamLineSnap(
              sceneRef.current.beams,
              sceneRef.current.components,
              drag.id,
              x + drag.offsetX,
              z + drag.offsetZ,
              step,
            );
      if (lock) [nextX, nextZ] = lock.position;
      setSnapGuide((current) =>
        !lock
          ? null
          : current && current[0] === lock.guide[0] && current[1] === lock.guide[1]
            ? current
            : lock.guide,
      );

      // The pressed part snaps to the grid and the rest of the group keeps its
      // offsets from it, measured from where the group stood at its first move.
      if (drag.group) {
        if (component.position[0] === nextX && component.position[2] === nextZ) return;
        if (!drag.origins) {
          drag.started = true;
          api.commitCheckpoint(sceneRef.current);
          drag.origins = positionsOf(
            sceneRef.current.components,
            withPeriscopePartners(sceneRef.current.components, drag.group),
          );
        }
        const [originX, , originZ] = drag.origins[drag.id];
        api.translateComponents(drag.origins, nextX - originX, nextZ - originZ);
        return;
      }

      // A particle dragged over a trap or cavity snaps into it; dragged clear,
      // it lets go.
      const host =
        component.type === "particle"
          ? findHost(sceneRef.current.components, nextX, nextZ)
          : undefined;
      const unchanged = host
        ? component.host === host.id
        : !component.host &&
          component.position[0] === nextX &&
          component.position[2] === nextZ;
      if (unchanged) return;

      // First real movement is what earns an undo entry — a plain click shouldn't.
      // The scene is read now, not at pointer-down: the click may have settled a
      // number field, and that edit is its own step, not part of the drag.
      if (!drag.started) {
        drag.started = true;
        api.commitCheckpoint(sceneRef.current);
      }
      if (component.type === "particle") {
        api.updateComponent(
          drag.id,
          host
            ? { host: host.id }
            : { host: undefined, position: clampXZ(nextX, component.position[1], nextZ) },
          false,
        );
      } else {
        api.moveComponent(drag.id, nextX, nextZ, false);
      }
    },
    [api],
  );

  useEffect(() => {
    const endDrag = (event: PointerEvent) => {
      if (slideRef.current) {
        slideRef.current = null;
        setSliding(false);
        setDragging(false);
        return;
      }
      if (turnRef.current) {
        turnRef.current = null;
        setTurning(null);
        setDragging(false);
        return;
      }
      if (frameDragRef.current || frameReshapeRef.current) {
        frameDragRef.current = null;
        frameReshapeRef.current = null;
        setDragging(false);
      }
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setDragging(false);
      setSnapGuide(null);
      // a click on one of several selected parts, with no drag, picks it alone
      const travelled = Math.hypot(event.clientX - drag.pressX, event.clientY - drag.pressY);
      if (drag.group && !drag.started && event.type === "pointerup" && travelled <= CLICK_SLOP_PX) {
        setSelection([drag.id]);
      }
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  // ---- connections ---------------------------------------------------------

  const handleConnectionPointerDown = useCallback(
    (id: string, event: ThreeEvent<PointerEvent>) => {
      // while placing or picking parts, the click goes on to the part or the table behind
      if (event.nativeEvent.button !== 0 || placingType || beamMode || connectDraft || addingStops || drawing) return;
      event.stopPropagation();
      setSelectedConnectionId(id);
      setSelectedFrameId(null);
      setSelection([]);
      setSelectedBeamId(null);
      setSelectedFrameId(null);
    },
    [addingStops, beamMode, connectDraft, drawing, placingType],
  );

  // ---- frames --------------------------------------------------------------

  // Pressing an unselected frame's edge selects it and drags it whole; on the
  // selected frame, a side or corner reshapes it, and Alt drags it whole.
  // Only its edge and corner handles take the press.
  const handleFramePointerDown = useCallback(
    (id: string, event: ThreeEvent<PointerEvent>, grip: FrameGrip) => {
      if (event.nativeEvent.button !== 0) return;
      const frame = sceneRef.current.frames.find((entry) => entry.id === id);
      if (!frame) return;
      const [grabX, grabZ] = tablePoint(event.ray) ?? [event.point.x, event.point.z];
      if (id === selectedFrameId && !event.nativeEvent.altKey) {
        const [gripX, gripZ] = frame.corners[grip.index];
        frameReshapeRef.current = {
          id,
          grip,
          corners: frame.corners,
          offsetX: gripX - grabX,
          offsetZ: gripZ - grabZ,
          reached: [gripX, gripZ],
          started: false,
        };
        setDragging(true);
        return;
      }
      setSelectedFrameId(id);
      setSelection([]);
      setSelectedBeamId(null);
      setSelectedConnectionId(null);
      frameDragRef.current = {
        id,
        offsetX: frame.corners[0][0] - grabX,
        offsetZ: frame.corners[0][1] - grabZ,
        started: false,
      };
      setDragging(true);
    },
    [selectedFrameId],
  );

  const handleSelectFrame = useCallback((id: string) => {
    setSelectedFrameId((current) => (current === id ? null : id));
    setSelection([]);
    setSelectedBeamId(null);
    setSelectedConnectionId(null);
  }, []);

  // "Add a frame" draws one: placing, drawing a beam or a frame and connecting are one mode at a time
  const startFrame = useCallback(() => {
    setDrawing(NEW_DRAWING);
    setSelection([]);
    setSelectedBeamId(null);
    setSelectedFrameId(null);
    setSelectedConnectionId(null);
    setBeamMode(false);
    setBeamDraft([]);
    setConnectDraft(null);
    setPlacingType(null);
    setTrayOpen(false);
  }, []);

  const cancelFrame = useCallback(() => setDrawing(null), []);

  /** What a click, a double-click, Enter or a dragged-out rectangle did; true when it finished the frame. */
  const applyDrawing = useCallback(
    (step: DrawingStep): boolean => {
      if (step.kind === "done") {
        // the whole drawing is one undo step: the frame arrives in one commit
        const id = api.addFrame(step.corners);
        setSelectedFrameId(id);
        setLabelFocusId(id);
        setDrawing(null);
        announce("Frame added.");
        return true;
      }
      // what the pointer would do is shown beside it; the status line, which is read out, says only what a click did
      if (step.kind === "refused") announce(step.reason);
      setDrawing((current) =>
        current && {
          ...current,
          corners: step.kind === "corner" ? step.corners : current.corners,
          refused: step.kind === "refused",
        },
      );
      return false;
    },
    [announce, api],
  );

  const isOnFirstCorner = useCallback((corners: Corner[], event: PointerEvent): boolean => {
    const project = projectRef.current;
    if (!project || corners.length < 3) return false;
    const [x, y] = project([corners[0][0], 0, corners[0][1]]);
    return Math.hypot(event.clientX - x, event.clientY - y) <= FIRST_CORNER_PX;
  }, []);

  useFrameDrawing(hostRef, {
    active: drawing !== null,
    rectangles: drawing?.corners.length === 0,
    tableAt: (clientX, clientY) => tableAtRef.current?.(clientX, clientY) ?? null,
    onHover: (point, event) =>
      setDrawing(
        (current) =>
          current && {
            ...current,
            pointer: point && {
              point,
              step: event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM,
              onFirst: isOnFirstCorner(current.corners, event),
            },
          },
      ),
    onClick: (point, event, second) => {
      if (!drawing) return false;
      if (second) return drawing.refused ? false : applyDrawing(finishDrawing(drawing.corners));
      const step = event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM;
      const onFirst = isOnFirstCorner(drawing.corners, event);
      return applyDrawing(clickDrawing(drawing.corners, point, { step, onFirst }));
    },
    onRectangle: (from, to, event, done) => {
      if (!drawing) return;
      const rectangle = dragRectangle(from, to, event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM);
      if (!done) {
        setDrawing((current) => current && { ...current, rectangle });
        return;
      }
      setDrawing((current) => current && { ...current, rectangle: null });
      applyDrawing(
        rectangle.reason ? { kind: "refused", reason: rectangle.reason } : { kind: "done", corners: rectangle.corners },
      );
    },
  });

  // the drawing, with what the pointer would do next, for the canvas
  const drawingView = useMemo((): (DrawingPreview & { corners: Corner[]; pointer: Corner | null }) | null => {
    if (!drawing) return null;
    const { corners, rectangle } = drawing;
    const pointer = drawing.pointer?.point ?? null;
    if (rectangle) {
      const loop = [...rectangle.corners, rectangle.corners[0]];
      const refused = rectangle.reason ? "closing" : null;
      return { corners: [], pointer, next: null, closing: loop, refused, reason: rectangle.reason };
    }
    if (!drawing.pointer) return { corners, pointer, next: null, closing: null, refused: null, reason: null };
    const { step, onFirst } = drawing.pointer;
    return { corners, pointer, ...previewDrawing(corners, drawing.pointer.point, { step, onFirst }) };
  }, [drawing]);

  const handleDeleteFrame = useCallback(
    (id: string) => {
      const frame = sceneRef.current.frames.find((entry) => entry.id === id);
      api.deleteFrame(id);
      setSelectedFrameId((current) => (current === id ? null : current));
      if (frame) announce(`Deleted ${frameDisplayName(frame)}. ⌘Z undoes.`);
    },
    [announce, api],
  );

  const handleMoveFrame = useCallback(
    (id: string, to: number): boolean => {
      const frames = sceneRef.current.frames;
      const frame = frames.find((entry) => entry.id === id);
      if (!frame) return false;
      const place = api.reorderFrame(id, to);
      if (place === null) {
        const edit = moveFrameTo(frames, id, to);
        announce(`Can't move ${frameDisplayName(frame)}: ${edit.ok ? "it can't go there" : edit.reason}.`);
        return false;
      }
      announce(`Moved ${frameDisplayName(frame)} to ${place + 1} of ${frames.length}.`);
      return true;
    },
    [announce, api],
  );

  const handleSetFrameHidden = useCallback(
    (id: string, hidden: boolean) => {
      const frame = sceneRef.current.frames.find((entry) => entry.id === id);
      api.setFrameHidden(id, hidden);
      if (frame) announce(`${hidden ? "Hid" : "Showed"} ${frameDisplayName(frame)}.`);
    },
    [announce, api],
  );

  // Placing, drawing a beam or a frame and connecting are one mode at a time.
  const startConnect = useCallback(() => {
    setBeamMode(false);
    setBeamDraft([]);
    setDrawing(null);
    setPlacingType(null);
    setTrayOpen(false);
    setSelection([]);
    setSelectedBeamId(null);
    setSelectedFrameId(null);
    setSelectedConnectionId(null);
    // a new connection starts as the kind of the last one drawn
    setConnectDraft({ kind: sceneRef.current.connections.at(-1)?.kind ?? "fiber", from: null });
  }, []);

  const cancelConnect = useCallback(() => setConnectDraft(null), []);

  // ---- beams ---------------------------------------------------------------

  const startBeam = useCallback(() => {
    setBeamMode(true);
    setBeamDraft([]);
    setConnectDraft(null);
    setDrawing(null);
    setPlacingType(null);
    setTrayOpen(false);
    setSelection([]);
    setSelectedFrameId(null);
    setBeamColor(
      BEAM_COLORS[sceneRef.current.beams.length % BEAM_COLORS.length],
    );
  }, []);

  const cancelBeam = useCallback(() => {
    setBeamMode(false);
    setBeamDraft([]);
  }, []);

  const finishBeam = useCallback(() => {
    if (beamDraft.length >= 2) {
      const first = componentById(sceneRef.current.components, beamDraft[0]);
      const last = componentById(
        sceneRef.current.components,
        beamDraft[beamDraft.length - 1],
      );
      const label =
        first && last
          ? `${componentDisplayName(first)} → ${componentDisplayName(last)}`
          : undefined;
      api.addBeam(beamDraft, beamColor, label);
      announce("Beam added.");
    }
    setBeamMode(false);
    setBeamDraft([]);
  }, [announce, api, beamColor, beamDraft]);

  const undoBeamStep = useCallback(
    () => setBeamDraft((current) => current.slice(0, -1)),
    [],
  );

  // A beam's row vanishes or jumps, so say what happened for those who can't see it.
  const handleDeleteBeam = useCallback(
    (id: string) => {
      const beam = sceneRef.current.beams.find((entry) => entry.id === id);
      api.deleteBeam(id);
      setSelectedBeamId((current) => (current === id ? null : current));
      if (beam) announce(`Deleted ${beamDisplayName(beam)}. ⌘Z undoes.`);
    },
    [announce, api],
  );

  const handleMoveBeam = useCallback(
    (id: string, to: number): boolean => {
      const beams = sceneRef.current.beams;
      const beam = beams.find((entry) => entry.id === id);
      if (!beam) return false;
      const place = api.moveBeam(id, to);
      if (place === null) {
        const edit = moveBeamTo(beams, id, to);
        announce(`Can't move ${beamDisplayName(beam)}: ${edit.ok ? "it can't go there" : edit.reason}.`);
        return false;
      }
      announce(`Moved ${beamDisplayName(beam)} to ${place + 1} of ${beams.length}.`);
      return true;
    },
    [announce, api],
  );

  const handleSetBeamHidden = useCallback(
    (id: string, hidden: boolean) => {
      const beam = sceneRef.current.beams.find((entry) => entry.id === id);
      api.setBeamHidden(id, hidden);
      if (beam) announce(`${hidden ? "Hid" : "Showed"} ${beamDisplayName(beam)}.`);
    },
    [announce, api],
  );

  // ---- file & image --------------------------------------------------------

  const handleSave = useCallback(() => {
    const blob = new Blob([serializeScene(sceneRef.current)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = setupFileName("json");
    link.click();
    URL.revokeObjectURL(url);
    announce("Saved.");
  }, [announce]);

  const handleCopyBrief = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(setupBrief());
      announce("Brief copied.");
    } catch {
      announce("Copy blocked. Use Download.");
    }
  }, [announce]);

  const handleDownloadBrief = useCallback(() => {
    const url = URL.createObjectURL(new Blob([setupBrief()], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = SETUP_BRIEF_FILENAME;
    link.click();
    URL.revokeObjectURL(url);
    announce("Brief saved.");
  }, [announce]);

  // a setup the JSON panel checked replaces the table, as one undo step
  const handleApplyScene = useCallback(
    (parsed: BuilderSceneData, summary: string) => {
      api.replaceScene(parsed);
      setFitToken((token) => token + 1);
      setSelection([]);
      setSelectedBeamId(null);
      setSelectedFrameId(null);
      setSelectedConnectionId(null);
      cancelBeam();
      cancelConnect();
      cancelFrame();
      announce(`Applied: ${summary}. ⌘Z undoes.`);
    },
    [announce, api, cancelBeam, cancelConnect, cancelFrame],
  );

  const sceneJson = useCallback(() => serializeScene(sceneRef.current), []);

  const handleExportPng = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // an export is drawn at full quality, with no ghosts: switch for the
      // capture and give the canvas a few frames to redraw at its new size
      if (ghostBeamId || ghostFrameId || quality !== "full") {
        setExporting(true);
        for (let frame = 0; frame < 3; frame += 1) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }
      const link = document.createElement("a");
      link.href = exportViewPng(canvas);
      link.download = setupFileName("png");
      link.click();
      announce("PNG exported.");
    } catch {
      announce("PNG export failed.");
    } finally {
      setExporting(false);
    }
  }, [announce, ghostBeamId, ghostFrameId, quality]);

  const handleSlowView = useCallback(() => {
    setQuality("light");
    setAutoQuality(false);
    announce("Switched to light graphics. Click ⚡ in the View toolbar to undo.");
  }, [announce]);

  const toggleQuality = useCallback(() => {
    const next: GraphicsQuality = quality === "full" ? "light" : "full";
    setQuality(next);
    setAutoQuality(false);
    storeQuality(next);
  }, [quality]);

  const handleCanvasReady = useCallback((handle: CanvasApi) => {
    canvasRef.current = handle.canvas;
    projectRef.current = handle.project;
    tableAtRef.current = handle.tableAt;
  }, []);

  // ---- keyboard ------------------------------------------------------------

  const rotateSelected = useCallback(
    (direction: 1 | -1) => {
      if (selectedIds.length === 0) return;
      const [only] = selectedComponents;
      // a part whose angle a beam sets doesn't turn by hand; in a group it
      // still swings round with the rest, and its beam re-angles it
      if (selectedIds.length === 1 && derivedAngleBeam(sceneRef.current.beams, only)) return;
      api.rotateComponents(selectedIds, direction);
    },
    [api, selectedComponents, selectedIds],
  );

  const duplicateSelected = useCallback(() => {
    const copies = api.duplicateComponents(selectedIds);
    if (copies.length) setSelection(copies);
  }, [api, selectedIds]);

  const deleteSelected = useCallback(() => {
    api.deleteComponents(selectedIds);
    setSelection([]);
  }, [api, selectedIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) api.redo();
        else api.undo();
        return;
      }

      if (meta && event.key.toLowerCase() === "a" && !beamMode && !drawing) {
        event.preventDefault();
        setSelection(sceneRef.current.components.map((component) => component.id));
        setSelectedBeamId(null);
        setSelectedFrameId(null);
        return;
      }

      if (event.key === "Escape") {
        // stop placing first, so Esc mid-run keeps the panel for the next part
        if (placingType) setPlacingType(null);
        else if (trayOpen) setTrayOpen(false);
        else if (beamMode) cancelBeam();
        else if (drawing) cancelFrame();
        else if (connectDraft) cancelConnect();
        else if (addingStops) setAddingStopsTo(null);
        else {
          setSelection([]);
          setSelectedBeamId(null);
          setSelectedFrameId(null);
          setSelectedConnectionId(null);
        }
        return;
      }

      if (beamMode && event.key === "Enter") {
        event.preventDefault();
        finishBeam();
        return;
      }

      if (drawing) {
        if (event.key === "Enter") {
          event.preventDefault();
          applyDrawing(finishDrawing(drawing.corners));
        } else if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          setDrawing({ ...drawing, corners: drawing.corners.slice(0, -1), refused: false });
        }
        return;
      }

      if (addingStops && event.key === "Enter") {
        event.preventDefault();
        setAddingStopsTo(null);
        return;
      }

      if (selectedConnection && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        api.deleteConnection(selectedConnection.id);
        setSelectedConnectionId(null);
        return;
      }

      if (selectedFrame && selectedIds.length === 0) {
        const nudge = event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM;
        const by: Record<string, [number, number]> = {
          ArrowLeft: [-nudge, 0],
          ArrowRight: [nudge, 0],
          ArrowUp: [0, -nudge],
          ArrowDown: [0, nudge],
        };
        if (by[event.key]) {
          event.preventDefault();
          api.updateFrame(selectedFrame.id, { corners: translateCorners(selectedFrame.corners, ...by[event.key]) });
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          handleDeleteFrame(selectedFrame.id);
        }
        return;
      }

      if (selectedIds.length === 0) return;

      const step = event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          api.nudgeComponents(selectedIds, -step, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          api.nudgeComponents(selectedIds, step, 0);
          break;
        case "ArrowUp":
          event.preventDefault();
          api.nudgeComponents(selectedIds, 0, -step);
          break;
        case "ArrowDown":
          event.preventDefault();
          api.nudgeComponents(selectedIds, 0, step);
          break;
        case "Delete":
        case "Backspace":
          event.preventDefault();
          deleteSelected();
          break;
        case "r":
        case "R":
          rotateSelected(event.shiftKey ? -1 : 1);
          break;
        case "d":
        case "D":
          if (meta) return;
          duplicateSelected();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    addingStops,
    api,
    applyDrawing,
    beamMode,
    cancelBeam,
    cancelConnect,
    cancelFrame,
    connectDraft,
    deleteSelected,
    drawing,
    duplicateSelected,
    finishBeam,
    handleDeleteFrame,
    placingType,
    rotateSelected,
    selectedConnection,
    selectedFrame,
    selectedIds,
    trayOpen,
  ]);

  const updateSelected = useCallback(
    (patch: Partial<Omit<BuilderComponent, "id" | "type">>, record?: boolean) => {
      if (selectedIds.length !== 1) return;
      api.updateComponent(selectedIds[0], patch, record);
    },
    [api, selectedIds],
  );

  const handleSelectBeam = useCallback((id: string) => {
    setSelectedBeamId((current) => (current === id ? null : id));
    setSelection([]);
    setSelectedConnectionId(null);
    setSelectedFrameId(null);
  }, []);

  return (
    <div className="builderWorkspace">
      <PrototypeSwitcher names={HOLE_VARIANTS} current={gridVariant} onChange={setGridVariant} />
      <div
        ref={hostRef}
        className={`builderCanvasHost${placingType || beamMode || connectDraft || addingStops || drawing ? " is-picking" : ""}`}
      >
        <BuilderCanvas
          components={scene.components}
          beams={scene.beams}
          connections={scene.connections}
          frames={scene.frames}
          palette={palette}
          lighting={lighting}
          quality={exporting ? "full" : quality}
          onSlowView={autoQuality && quality === "full" ? handleSlowView : undefined}
          selection={selectedIds}
          selectedBeamId={selectedBeamId}
          ghostBeamId={ghostBeamId}
          selectedConnectionId={selectedConnection?.id ?? null}
          selectedFrameId={selectedFrame?.id ?? null}
          ghostFrameId={ghostFrameId}
          framesInteractive={!placingType && !beamMode && !connectDraft && !addingStops && !drawing}
          frameDraft={
            drawingView && { ...drawingView, color: FRAME_COLORS[scene.frames.length % FRAME_COLORS.length] }
          }
          hoveredId={hoveredId}
          // the part a connection leaves from carries the "1" badge until the second click
          beamDraft={connectDraft?.from ? [connectDraft.from] : beamDraft}
          showLabels={showLabels}
          showDistances={showDistances}
          showGrid={showGrid}
          gridVariant={gridVariant}
          showPosts={showPosts}
          view={view}
          fitToken={fitToken}
          dragging={dragging}
          snapGuide={snapGuide}
          onSurfaceClick={handleSurfaceClick}
          onSurfaceDrag={handleSurfaceDrag}
          onComponentPointerDown={handleComponentPointerDown}
          onComponentHover={handleComponentHover}
          rotationHandle={rotationHandle}
          onRotationHandlePointerDown={handleRotationHandlePointerDown}
          stageHandle={stageHandle}
          onStageHandlePointerDown={handleStageHandlePointerDown}
          onConnectionPointerDown={handleConnectionPointerDown}
          onFramePointerDown={handleFramePointerDown}
          onCanvasReady={handleCanvasReady}
        />
        {selectionBox ? (
          <div
            className="builderBoxSelect"
            style={{
              left: selectionBox.left,
              top: selectionBox.top,
              width: selectionBox.right - selectionBox.left,
              height: selectionBox.bottom - selectionBox.top,
            }}
          />
        ) : null}
      </div>

      <BuilderHud
        components={scene.components}
        beams={scene.beams}
        frames={scene.frames}
        selected={selectedComponents}
        selectedBeam={selectedBeam}
        selectedFrame={selectedFrame}
        focusFrameLabel={selectedFrame !== null && selectedFrame.id === labelFocusId}
        onFrameLabelFocused={() => setLabelFocusId(null)}
        selectedConnection={selectedConnection}
        connectDraft={connectDraft}
        placingType={placingType}
        trayOpen={trayOpen}
        beamMode={beamMode}
        drawingFrame={drawing !== null}
        frameCorners={drawing?.corners.length ?? 0}
        addingStops={addingStops}
        beamDraft={beamDraft}
        beamColor={beamColor}
        showLabels={showLabels}
        showDistances={showDistances}
        showGrid={showGrid}
        showPosts={showPosts}
        lighting={lighting}
        view={view}
        canUndo={api.canUndo}
        canRedo={api.canRedo}
        status={status}
        onToggleTray={() => setTrayOpen((open) => !open)}
        onPickType={(type) => {
          // the panel stays open, so a run of parts goes down without reopening it
          cancelBeam();
          cancelConnect();
          cancelFrame();
          setPlacingType(type);
        }}
        onCloseTray={() => setTrayOpen(false)}
        onSelectTool={() => {
          cancelBeam();
          cancelConnect();
          cancelFrame();
          setPlacingType(null);
          setTrayOpen(false);
        }}
        onDeselect={() => {
          setSelection([]);
          setSelectedBeamId(null);
          setSelectedFrameId(null);
          setSelectedConnectionId(null);
        }}
        onUpdateSelected={updateSelected}
        onUpdateComponent={api.updateComponent}
        onRotateSelected={rotateSelected}
        onDuplicateSelected={duplicateSelected}
        onDeleteSelected={deleteSelected}
        onSetSelectedHeight={(height) => api.setComponentsHeight(selectedIds, height)}
        onSetSelectedMountColor={(color) => api.setMountColor(selectedIds, color)}
        onStartBeam={startBeam}
        onFinishBeam={finishBeam}
        onCancelBeam={cancelBeam}
        onUndoBeamStep={undoBeamStep}
        onBeamColorChange={setBeamColor}
        onStartConnect={startConnect}
        onCancelConnect={cancelConnect}
        onConnectKindChange={(kind) => setConnectDraft((current) => current && { ...current, kind })}
        onUpdateConnection={api.updateConnection}
        onDeleteConnection={(id) => {
          api.deleteConnection(id);
          setSelectedConnectionId(null);
        }}
        onSelectBeam={handleSelectBeam}
        onToggleAddStops={() =>
          setAddingStopsTo((current) =>
            current === selectedBeamId ? null : selectedBeamId,
          )
        }
        onUpdateBeam={api.updateBeam}
        onCheckpoint={() => api.commitCheckpoint(sceneRef.current)}
        onDeleteBeam={handleDeleteBeam}
        onMoveBeam={handleMoveBeam}
        onSetBeamHidden={handleSetBeamHidden}
        onStartFrame={startFrame}
        onCancelFrame={cancelFrame}
        onSelectFrame={handleSelectFrame}
        onUpdateFrame={api.updateFrame}
        onDeleteFrame={handleDeleteFrame}
        onMoveFrame={handleMoveFrame}
        onSetFrameHidden={handleSetFrameHidden}
        onToggleLabels={() => setShowLabels((current) => !current)}
        onToggleDistances={() => setShowDistances((current) => !current)}
        onToggleGrid={() => setShowGrid((current) => !current)}
        onTogglePosts={() => setShowPosts((current) => !current)}
        onLightingChange={(patch) => setLighting((current) => ({ ...current, ...patch }))}
        onViewChange={(next) => {
          // pressing the view you are already on still snaps back from an orbit
          setView(next);
          setFitToken((token) => token + 1);
        }}
        onFit={() => setFitToken((token) => token + 1)}
        onToggleTheme={() => setTheme(getTheme() === "dark" ? "light" : "dark")}
        quality={quality}
        onToggleQuality={toggleQuality}
        onUndo={api.undo}
        onRedo={api.redo}
        onSave={handleSave}
        sceneJson={sceneJson}
        onApplyScene={handleApplyScene}
        onExportPng={handleExportPng}
        onCopyBrief={handleCopyBrief}
        onDownloadBrief={handleDownloadBrief}
        onResetExample={() => {
          api.resetToExample();
          setSelection([]);
          setSelectedConnectionId(null);
          setSelectedFrameId(null);
          announce("Example loaded. ⌘Z undoes.");
        }}
        onClear={() => {
          api.clearScene();
          setSelection([]);
          setSelectedBeamId(null);
          setSelectedFrameId(null);
          setSelectedConnectionId(null);
          cancelBeam();
          cancelConnect();
          cancelFrame();
          announce("Table cleared. ⌘Z undoes.");
        }}
      />
    </div>
  );
}
