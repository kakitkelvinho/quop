"use client";

import type { ThreeEvent } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import BuilderCanvas, {
  CLICK_SLOP_PX,
  type CameraView,
  type CanvasApi,
  tablePoint,
} from "@/components/builder/builder-canvas";
import BuilderHud, { type ConnectDraft } from "@/components/builder/builder-hud";
import { useScenePalette } from "@/components/builder/scene-theme";
import { useBoxSelect, type ScreenBox } from "@/components/builder/use-box-select";
import { useBuilderScene } from "@/components/builder/use-builder-scene";
import { getTheme, setTheme } from "@/components/theme-toggle";
import {
  combineRect,
  dropZeroSides,
  frameCorners,
  isJoint,
  isRectilinear,
  mergeCollinear,
  same,
  sideAxis,
  withCorners,
  type P,
  type ProtoMode,
  type ProtoTarget,
} from "@/components/builder/PROTOTYPE-shaped-frames";
import {
  BEAM_COLORS,
  CONNECTION_KINDS,
  FINE_GRID_MM,
  FRAME_COLORS,
  GRID_SIZE_MM,
  clampToTable,
  createFrameId,
  componentById,
  componentDisplayName,
  findHost,
  appendStop,
  beamDisplayName,
  frameDisplayName,
  moveBeamTo,
  derivedAngleBeam,
  parseScene,
  serializeScene,
  beamLineSnap,
  snapToGrid,
  type BuilderComponent,
  type ComponentType,
  type Frame,
  type Vec3,
} from "@/components/builder/types";

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

/** PROTOTYPE (#146): a side or corner of a selected frame being dragged */
type ShapeDragState = {
  id: string;
  /** corners at the press, rotated and with any joints the drag needs put in */
  corners: P[];
  kind: "edge" | "corner";
  /** the side's first corner, or the corner */
  k: number;
  offsetX: number;
  offsetZ: number;
  started: boolean;
};

function rotate(corners: P[], by: number): P[] {
  const n = corners.length;
  const s = ((by % n) + n) % n;
  return [...corners.slice(s), ...corners.slice(0, s)].map((c): P => [c[0], c[1]]);
}

const other = (axis: "x" | "z" | null) => (axis === "x" ? "z" : axis === "z" ? "x" : null);

/**
 * Get a drag ready: rotate so the side runs 1 -> 2 (or the corner sits at 2),
 * and put a joint in wherever a neighbouring side runs straight on, so moving
 * the side grows a step instead of slanting its neighbour.
 */
function prepareShapeDrag(all: P[], target: ProtoTarget): { corners: P[]; k: number } {
  if (target.kind === "edge") {
    const c = rotate(all, target.index - 1);
    const axis = sideAxis(c[1], c[2]);
    const n = c.length;
    if (sideAxis(c[2], c[3 % n]) !== other(axis)) c.splice(3, 0, [c[2][0], c[2][1]]);
    if (sideAxis(c[0], c[1]) !== other(axis)) {
      c.splice(1, 0, [c[1][0], c[1][1]]);
      return { corners: c, k: 2 };
    }
    return { corners: c, k: 1 };
  }
  const c = rotate(all, target.index - 2);
  if (isJoint(c, 2)) return { corners: c, k: 2 };
  const n = c.length;
  const sA = sideAxis(c[1], c[2]);
  const sB = sideAxis(c[2], c[3]);
  if (sideAxis(c[3], c[4 % n]) !== other(sB)) c.splice(4, 0, [c[3][0], c[3][1]]);
  if (sideAxis(c[0], c[1]) !== other(sA)) {
    c.splice(1, 0, [c[1][0], c[1][1]]);
    return { corners: c, k: 3 };
  }
  return { corners: c, k: 2 };
}

/** Where the drawn outline (b) goes back to its first corner: an elbow if needed. */
function closingElbow(points: P[]): P[] {
  if (points.length < 2) return [];
  const first = points[0];
  const last = points[points.length - 1];
  if (last[0] === first[0] || last[1] === first[1]) return [];
  const axis = sideAxis(points[points.length - 2], last);
  return axis === "x" ? [[last[0], first[1]]] : [[first[0], last[1]]];
}

type FrameDragState = {
  id: string;
  offsetX: number;
  offsetZ: number;
  started: boolean;
};

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
  // the beam "Add stops" is on for; it lapses as soon as another is selected
  const [addingStopsTo, setAddingStopsTo] = useState<string | null>(null);
  const [beamColor, setBeamColor] = useState<string>(BEAM_COLORS[0]);
  const [showLabels, setShowLabels] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showPosts, setShowPosts] = useState(true);
  const [view, setView] = useState<CameraView>("iso");
  const [fitToken, setFitToken] = useState(0);
  const [dragging, setDragging] = useState(false);
  // the straight line a dragged part is locked onto, while it is
  const [snapGuide, setSnapGuide] = useState<[Vec3, Vec3] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  // ---- PROTOTYPE (#146) state ----------------------------------------------
  const [protoMode, setProtoMode] = useState<ProtoMode>("edit");
  const [protoPoints, setProtoPoints] = useState<P[]>([]);
  const [protoHover, setProtoHover] = useState<P | null>(null);
  const protoKeys = useRef({ shift: false, alt: false });
  const shapeDragRef = useRef<ShapeDragState | null>(null);
  useEffect(() => {
    const track = (event: KeyboardEvent | PointerEvent) => {
      protoKeys.current = { shift: event.shiftKey, alt: event.altKey };
    };
    window.addEventListener("keydown", track, true);
    window.addEventListener("keyup", track, true);
    window.addEventListener("pointerdown", track, true);
    return () => {
      window.removeEventListener("keydown", track, true);
      window.removeEventListener("keyup", track, true);
      window.removeEventListener("pointerdown", track, true);
    };
  }, []);
  const protoSnap = useCallback(
    (value: number) => snapToGrid(value, protoKeys.current.shift ? FINE_GRID_MM : GRID_SIZE_MM),
    [],
  );

  const dragRef = useRef<DragState | null>(null);
  const frameDragRef = useRef<FrameDragState | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectRef = useRef<CanvasApi["project"] | null>(null);
  // the part under the pointer, for a Ctrl/⌘ click the canvas never sees
  const hoveredRef = useRef<string | null>(null);
  // Pointer handlers run outside React's render pass and need the newest
  // scene without re-subscribing on every edit.
  const sceneRef = useRef(scene);
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  // an id undo or a delete took off the table drops out here
  const selectedComponents = useMemo(
    () =>
      selection
        .map((id) => componentById(scene.components, id))
        .filter((component): component is BuilderComponent => component !== undefined),
    [scene.components, selection],
  );
  const selectedIds = useMemo(
    () => selectedComponents.map((component) => component.id),
    [selectedComponents],
  );
  const selectedBeam = useMemo(
    () => scene.beams.find((beam) => beam.id === selectedBeamId) ?? null,
    [scene.beams, selectedBeamId],
  );
  // a selected hidden beam shows on screen as a ghost, so it can be edited; a PNG leaves it out
  const [exporting, setExporting] = useState(false);
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

  // PROTOTYPE (#146): where a click would put the next corner (b)
  const drawCandidate = useCallback(
    (points: P[], x: number, z: number): P => {
      const last = points[points.length - 1];
      if (!last) return [protoSnap(x), protoSnap(z)];
      return Math.abs(x - last[0]) >= Math.abs(z - last[1]) ? [protoSnap(x), last[1]] : [last[0], protoSnap(z)];
    },
    [protoSnap],
  );

  const addShapedFrame = useCallback(
    (corners: P[]) => {
      const id = createFrameId();
      const current = sceneRef.current;
      api.replaceScene({
        ...current,
        frames: [
          ...current.frames,
          { id, color: FRAME_COLORS[current.frames.length % FRAME_COLORS.length], ...withCorners(corners) },
        ],
      });
      setSelectedFrameId(id);
      return id;
    },
    [api],
  );

  const finishDrawing = useCallback(
    (points: P[]) => {
      const full = mergeCollinear([...points, ...closingElbow(points)]);
      if (full.length < 4 || !isRectilinear(full)) {
        announce("Not enough corners for an outline yet.");
        return;
      }
      addShapedFrame(full);
      setProtoPoints([]);
      announce(`Drew a frame with ${full.length} corners. Click to start another, Esc to stop drawing.`);
    },
    [addShapedFrame, announce],
  );

  const handleSurfaceClick = useCallback(
    (x: number, z: number) => {
      if (protoMode === "draw") {
        const first = protoPoints[0];
        if (first && protoPoints.length >= 3 && Math.hypot(x - first[0], z - first[1]) < 20) {
          finishDrawing(protoPoints);
          return;
        }
        const next = drawCandidate(protoPoints, x, z);
        if (first && protoPoints.length >= 3 && same(next, first)) {
          finishDrawing(protoPoints);
          return;
        }
        const last = protoPoints[protoPoints.length - 1];
        if (last && same(last, next)) return;
        setProtoPoints([...protoPoints, next]);
        return;
      }
      if (protoMode === "rects") {
        const point: P = [protoSnap(x), protoSnap(z)];
        if (!protoPoints.length) {
          setProtoPoints([point]);
          return;
        }
        const start = protoPoints[0];
        setProtoPoints([]);
        if (start[0] === point[0] || start[1] === point[1]) return;
        const cut = protoKeys.current.alt;
        const target = selectedFrameId ? sceneRef.current.frames.find((f) => f.id === selectedFrameId) : undefined;
        if (!target) {
          if (cut) return announce("Select a frame to cut from.");
          addShapedFrame(mergeCollinear([start, [point[0], start[1]], point, [start[0], point[1]]]));
          announce("New frame from a rectangle. Click two more corners to add to it; Alt on the second click cuts.");
          return;
        }
        const result = combineRect(frameCorners(target), [start, point], cut ? "cut" : "add");
        if (!result.corners) return announce("That would leave nothing of the frame.");
        api.updateFrame(target.id, withCorners(result.corners));
        if (result.pieces > 1) {
          announce(`That made ${result.pieces} loops (pieces or a hole); kept only the largest outline.`);
        }
        return;
      }
      if (beamMode || connectDraft || addingStops) return;
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
    [addingStops, addShapedFrame, announce, api, beamMode, connectDraft, drawCandidate, finishDrawing, placingType, protoMode, protoPoints, protoSnap, selectedFrameId],
  );

  const handleComponentPointerDown = useCallback(
    (id: string, event: ThreeEvent<PointerEvent>) => {
      // middle and right drags orbit the camera, even when they start on a part
      if (event.nativeEvent.button !== 0) return;
      if (protoMode !== "edit") return;
      if (beamMode) {
        setBeamDraft((current) =>
          current[current.length - 1] === id ? current : [...current, id],
        );
        return;
      }
      const component = componentById(sceneRef.current.components, id);
      if (!component) return;

      if (connectDraft) {
        // an undo may have taken away the part clicked first; then this click starts over
        const from = connectDraft.from && componentById(sceneRef.current.components, connectDraft.from);
        if (!from) {
          setConnectDraft({ ...connectDraft, from: id });
        } else if (from.id === id) {
          announce(`Can't connect ${componentDisplayName(component)} to itself. Click another part.`);
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
        else announce(`Can't add ${componentDisplayName(component)}: ${edit.reason}.`);
        return;
      }

      setPlacingType(null);
      setSelectedBeamId(null);
      setSelectedFrameId(null);
      setSelectedConnectionId(null);
      // pressed as one of several selected parts, it drags them all
      const group = selectedIds.length > 1 && selectedIds.includes(id) ? selectedIds : null;
      if (!group) setSelection([id]);
      // the press hits the part up at its height; the drag follows the table
      const [grabX, grabZ] = tablePoint(event.ray) ?? [event.point.x, event.point.z];
      dragRef.current = {
        id,
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
    [addingStops, announce, api, beamMode, connectDraft, protoMode, selectedBeamId, selectedIds],
  );

  const handleComponentHover = useCallback((id: string | null) => {
    hoveredRef.current = id;
    setHoveredId(id);
  }, []);

  // Ctrl/⌘ + click adds the part under the pointer to the selection, or takes it out.
  const togglePointedPart = useCallback(() => {
    const id = hoveredRef.current;
    if (!id) return;
    setSelection((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
    setSelectedBeamId(null);
    setSelectedFrameId(null);
    setSelectedConnectionId(null);
  }, []);

  // Ctrl/⌘ + drag selects every part whose optical centre falls in the box;
  // with Shift as well, it adds them to the selection.
  const selectInBox = useCallback((box: ScreenBox, adding: boolean) => {
    const project = projectRef.current;
    if (!project) return;
    const inside = sceneRef.current.components
      .filter((component) => {
        const [x, y] = project(component.position);
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
    enabled: !placingType && !beamMode && !connectDraft && !addingStops,
    onClick: togglePointedPart,
    onBox: selectInBox,
  });

  const handleSurfaceDrag = useCallback(
    (x: number, z: number, event: PointerEvent) => {
      const shapeDrag = shapeDragRef.current;
      if (shapeDrag) {
        const step = event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM;
        const X = snapToGrid(x + shapeDrag.offsetX, step);
        const Z = snapToGrid(z + shapeDrag.offsetZ, step);
        const c = shapeDrag.corners.map((p): P => [p[0], p[1]]);
        const n = c.length;
        const k = shapeDrag.k;
        const moveSide = (i: number) => {
          const j = (i + 1) % n;
          if (sideAxis(shapeDrag.corners[i], shapeDrag.corners[j]) === "x") c[i][1] = c[j][1] = Z;
          else c[i][0] = c[j][0] = X;
        };
        if (shapeDrag.kind === "edge") moveSide(k);
        else if (isJoint(shapeDrag.corners, k)) {
          if (sideAxis(shapeDrag.corners[k], shapeDrag.corners[(k + 1) % n]) === "x") c[k][0] = X;
          else c[k][1] = Z;
        } else {
          moveSide((k - 1 + n) % n);
          moveSide(k);
        }
        if (!shapeDrag.started && c.every((p, i) => same(p, shapeDrag.corners[i]))) return;
        if (!shapeDrag.started) {
          shapeDrag.started = true;
          api.commitCheckpoint(sceneRef.current);
        }
        api.updateFrame(shapeDrag.id, withCorners(c), false);
        return;
      }
      if (!frameDragRef.current && !dragRef.current) {
        // PROTOTYPE (#146): hovering while drawing
        setProtoHover([x, z]);
        return;
      }
      const frameDrag = frameDragRef.current;
      if (frameDrag) {
        const frame = sceneRef.current.frames.find((entry) => entry.id === frameDrag.id);
        if (!frame) return;
        const step = event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM;
        const nextX = snapToGrid(x + frameDrag.offsetX, step);
        const nextZ = snapToGrid(z + frameDrag.offsetZ, step);
        if (frame.position[0] === nextX && frame.position[1] === nextZ) return;
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
      const lock =
        drag.group || component.type === "particle"
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
          drag.origins = positionsOf(sceneRef.current.components, drag.group);
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
      const shapeDrag = shapeDragRef.current;
      if (shapeDrag) {
        shapeDragRef.current = null;
        setDragging(false);
        const frame = sceneRef.current.frames.find((entry) => entry.id === shapeDrag.id);
        if (shapeDrag.started && frame) api.updateFrame(frame.id, withCorners(dropZeroSides(frameCorners(frame))), false);
      }
      if (frameDragRef.current) {
        frameDragRef.current = null;
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
  }, [api]);

  // ---- connections ---------------------------------------------------------

  const handleConnectionPointerDown = useCallback(
    (id: string, event: ThreeEvent<PointerEvent>) => {
      // while placing or picking parts, the click goes on to the part or the table behind
      if (event.nativeEvent.button !== 0 || placingType || beamMode || connectDraft || addingStops) return;
      event.stopPropagation();
      setSelectedConnectionId(id);
      setSelectedFrameId(null);
      setSelection([]);
      setSelectedBeamId(null);
      setSelectedFrameId(null);
    },
    [addingStops, beamMode, connectDraft, placingType],
  );

  // ---- frames --------------------------------------------------------------

  // Pressing a frame's edge selects it and drags it; only its edge takes the press.
  const handleFramePointerDown = useCallback((id: string, event: ThreeEvent<PointerEvent>, target: ProtoTarget) => {
    if (event.nativeEvent.button !== 0) return;
    const frame = sceneRef.current.frames.find((entry) => entry.id === id);
    if (!frame) return;
    const [px, pz] = tablePoint(event.ray) ?? [event.point.x, event.point.z];
    // PROTOTYPE (#146): a selected frame reshapes from its sides and corners; Alt moves it whole
    if (id === selectedFrameId && !event.nativeEvent.altKey) {
      const { corners, k } = prepareShapeDrag(frameCorners(frame), target);
      shapeDragRef.current = {
        id,
        corners,
        kind: target.kind,
        k,
        offsetX: corners[k][0] - px,
        offsetZ: corners[k][1] - pz,
        started: false,
      };
      setDragging(true);
      return;
    }
    setSelectedFrameId(id);
    setSelection([]);
    setSelectedBeamId(null);
    setSelectedConnectionId(null);
    const [grabX, grabZ] = tablePoint(event.ray) ?? [event.point.x, event.point.z];
    frameDragRef.current = {
      id,
      offsetX: frame.position[0] - grabX,
      offsetZ: frame.position[1] - grabZ,
      started: false,
    };
    setDragging(true);
  }, [selectedFrameId]);

  // PROTOTYPE (#146): double-click a side to put a joint in it, a joint to take it out
  const handleFrameDoublePress = useCallback(
    (id: string, event: ThreeEvent<MouseEvent>, target: ProtoTarget) => {
      const frame = sceneRef.current.frames.find((entry) => entry.id === id);
      if (!frame || id !== selectedFrameId) return;
      const corners = frameCorners(frame);
      const n = corners.length;
      if (target.kind === "corner") {
        if (!isJoint(corners, target.index)) return announce("Only a joint (white diamond) comes out on a double-click.");
        api.updateFrame(id, withCorners(corners.filter((_, i) => i !== target.index)));
        return;
      }
      const a = corners[target.index];
      const b = corners[(target.index + 1) % n];
      const horizontal = sideAxis(a, b) === "x";
      const at: P = horizontal ? [protoSnap(event.point.x), a[1]] : [a[0], protoSnap(event.point.z)];
      const lo = horizontal ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
      const hi = horizontal ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
      const v = horizontal ? at[0] : at[1];
      if (v <= lo || v >= hi) return;
      const next = [...corners];
      next.splice(target.index + 1, 0, at);
      api.updateFrame(id, withCorners(next));
      announce("Put a joint in that side. Drag either half out to make a step; two joints for a notch.");
    },
    [announce, api, protoSnap, selectedFrameId],
  );

  const handleSelectFrame = useCallback((id: string) => {
    setSelectedFrameId((current) => (current === id ? null : id));
    setSelection([]);
    setSelectedBeamId(null);
    setSelectedConnectionId(null);
  }, []);

  const handleAddFrame = useCallback(() => {
    // each new one a little off the last, so they don't land exactly on top of each other
    const shift = (sceneRef.current.frames.length % 8) * GRID_SIZE_MM * 2;
    const id = api.addFrame([snapToGrid(shift), snapToGrid(shift)]);
    setSelectedFrameId(id);
    setSelection([]);
    setSelectedBeamId(null);
    setSelectedConnectionId(null);
    setBeamMode(false);
    setBeamDraft([]);
    setConnectDraft(null);
    setPlacingType(null);
    setTrayOpen(false);
    announce("Added a frame. Drag its edge to move it.");
  }, [announce, api]);

  const handleDeleteFrame = useCallback(
    (id: string) => {
      const frame = sceneRef.current.frames.find((entry) => entry.id === id);
      api.deleteFrame(id);
      setSelectedFrameId((current) => (current === id ? null : current));
      if (frame) announce(`Deleted ${frameDisplayName(frame)}. ⌘Z brings it back.`);
    },
    [announce, api],
  );

  const handleSetFrameHidden = useCallback(
    (id: string, hidden: boolean) => {
      const frame = sceneRef.current.frames.find((entry) => entry.id === id);
      api.setFrameHidden(id, hidden);
      if (frame) announce(`${hidden ? "Hid" : "Showed"} ${frameDisplayName(frame)} on the table.`);
    },
    [announce, api],
  );

  // Placing, drawing a beam and connecting are one mode at a time.
  const startConnect = useCallback(() => {
    setBeamMode(false);
    setBeamDraft([]);
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
      if (beam) announce(`Deleted ${beamDisplayName(beam)}. ⌘Z brings it back.`);
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
      if (beam) announce(`${hidden ? "Hid" : "Showed"} ${beamDisplayName(beam)} on the table.`);
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
    announce("Setup saved as JSON.");
  }, [announce]);

  const handleLoad = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseScene(JSON.parse(String(reader.result)));
          if (!parsed) {
            announce("That file isn't a QUOP setup — no components found.");
            return;
          }
          api.replaceScene(parsed);
          setFitToken((token) => token + 1);
          setSelection([]);
          setSelectedBeamId(null);
          setSelectedFrameId(null);
          setSelectedConnectionId(null);
          cancelBeam();
          cancelConnect();
          announce(
            `Loaded ${parsed.components.length} parts from ${file.name}.`,
          );
        } catch {
          announce("Couldn't read that file — it isn't valid JSON.");
        }
      };
      reader.readAsText(file);
    },
    [announce, api, cancelBeam, cancelConnect],
  );

  const handleExportPng = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (ghostBeamId || ghostFrameId) {
        setExporting(true);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      const link = document.createElement("a");
      link.href = exportViewPng(canvas);
      link.download = setupFileName("png");
      link.click();
      announce("Exported the view as a PNG.");
    } catch {
      announce("Couldn't export the canvas in this browser.");
    } finally {
      setExporting(false);
    }
  }, [announce, ghostBeamId, ghostFrameId]);

  // PROTOTYPE (#146): keys while drawing (b) or adding rectangles (c)
  useEffect(() => {
    if (protoMode === "edit") return;
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        if (protoPoints.length) setProtoPoints([]);
        else setProtoMode("edit");
      } else if (event.key === "Enter" && protoMode === "draw") {
        event.stopImmediatePropagation();
        finishDrawing(protoPoints);
      } else if (event.key === "Backspace") {
        event.stopImmediatePropagation();
        event.preventDefault();
        setProtoPoints(protoPoints.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [finishDrawing, protoMode, protoPoints]);

  const protoDraft = useMemo(() => {
    if (protoMode === "draw") {
      const candidate = protoHover ? drawCandidate(protoPoints, protoHover[0], protoHover[1]) : null;
      const points = candidate ? [...protoPoints, candidate] : protoPoints;
      const closing = points.length >= 3 ? [points[points.length - 1], ...closingElbow(points), points[0]] : null;
      return { points, closing };
    }
    if (protoMode === "rects" && protoPoints.length && protoHover) {
      const a = protoPoints[0];
      const b: P = [protoSnap(protoHover[0]), protoSnap(protoHover[1])];
      return { points: [a, [b[0], a[1]] as P, b, [a[0], b[1]] as P, a], closing: null };
    }
    return null;
  }, [drawCandidate, protoHover, protoMode, protoPoints, protoSnap]);

  const switchProtoMode = useCallback((mode: ProtoMode) => {
    setProtoMode(mode);
    setProtoPoints([]);
    setPlacingType(null);
    setBeamMode(false);
    setBeamDraft([]);
    setConnectDraft(null);
    setSelection([]);
    setSelectedBeamId(null);
    if (mode === "draw") setSelectedFrameId(null);
  }, []);

  const handleCanvasReady = useCallback((handle: CanvasApi) => {
    canvasRef.current = handle.canvas;
    projectRef.current = handle.project;
    // PROTOTYPE (#146): lets a test script find table points on screen
    (window as unknown as { __protoProject?: CanvasApi["project"] }).__protoProject = handle.project;
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

      if (meta && event.key.toLowerCase() === "a" && !beamMode) {
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
        const [fx, fz] = selectedFrame.position;
        const to: Record<string, [number, number]> = {
          ArrowLeft: [fx - nudge, fz],
          ArrowRight: [fx + nudge, fz],
          ArrowUp: [fx, fz - nudge],
          ArrowDown: [fx, fz + nudge],
        };
        if (to[event.key]) {
          event.preventDefault();
          api.updateFrame(selectedFrame.id, { position: clampToTable(...to[event.key]) });
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
    beamMode,
    cancelBeam,
    cancelConnect,
    connectDraft,
    deleteSelected,
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
      <div
        ref={hostRef}
        className={`builderCanvasHost${placingType || beamMode || connectDraft || addingStops || protoMode !== "edit" ? " is-picking" : ""}`}
      >
        <BuilderCanvas
          components={scene.components}
          beams={scene.beams}
          connections={scene.connections}
          frames={scene.frames}
          palette={palette}
          selection={selectedIds}
          selectedBeamId={selectedBeamId}
          ghostBeamId={ghostBeamId}
          selectedConnectionId={selectedConnection?.id ?? null}
          selectedFrameId={selectedFrame?.id ?? null}
          ghostFrameId={ghostFrameId}
          framesInteractive={!placingType && !beamMode && !connectDraft && !addingStops && protoMode === "edit"}
          hoveredId={hoveredId}
          // the part a connection leaves from carries the "1" badge until the second click
          beamDraft={connectDraft?.from ? [connectDraft.from] : beamDraft}
          showLabels={showLabels}
          showGrid={showGrid}
          showPosts={showPosts}
          view={view}
          fitToken={fitToken}
          dragging={dragging}
          snapGuide={snapGuide}
          onSurfaceClick={handleSurfaceClick}
          onSurfaceDrag={handleSurfaceDrag}
          onComponentPointerDown={handleComponentPointerDown}
          onComponentHover={handleComponentHover}
          onConnectionPointerDown={handleConnectionPointerDown}
          onFramePointerDown={handleFramePointerDown}
          onFrameDoublePress={handleFrameDoublePress}
          protoDraft={protoDraft}
          protoTracking={protoMode !== "edit"}
          onCanvasReady={handleCanvasReady}
        />
        <ProtoBar
          mode={protoMode}
          onMode={switchProtoMode}
          drafted={protoPoints.length}
          selectedFrame={selectedFrame}
          onTidy={() => {
            if (selectedFrame) api.updateFrame(selectedFrame.id, withCorners(mergeCollinear(frameCorners(selectedFrame))));
          }}
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
        selectedConnection={selectedConnection}
        connectDraft={connectDraft}
        placingType={placingType}
        trayOpen={trayOpen}
        beamMode={beamMode}
        addingStops={addingStops}
        beamDraft={beamDraft}
        beamColor={beamColor}
        showLabels={showLabels}
        showGrid={showGrid}
        showPosts={showPosts}
        view={view}
        canUndo={api.canUndo}
        canRedo={api.canRedo}
        status={status}
        onToggleTray={() => setTrayOpen((open) => !open)}
        onPickType={(type) => {
          // the panel stays open, so a run of parts goes down without reopening it
          cancelBeam();
          cancelConnect();
          setPlacingType(type);
        }}
        onCloseTray={() => setTrayOpen(false)}
        onSelectTool={() => {
          cancelBeam();
          cancelConnect();
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
        onAddFrame={handleAddFrame}
        onSelectFrame={handleSelectFrame}
        onUpdateFrame={api.updateFrame}
        onDeleteFrame={handleDeleteFrame}
        onSetFrameHidden={handleSetFrameHidden}
        onToggleLabels={() => setShowLabels((current) => !current)}
        onToggleGrid={() => setShowGrid((current) => !current)}
        onTogglePosts={() => setShowPosts((current) => !current)}
        onViewChange={(next) => {
          // pressing the view you are already on still snaps back from an orbit
          setView(next);
          setFitToken((token) => token + 1);
        }}
        onFit={() => setFitToken((token) => token + 1)}
        onToggleTheme={() => setTheme(getTheme() === "dark" ? "light" : "dark")}
        onUndo={api.undo}
        onRedo={api.redo}
        onSave={handleSave}
        onLoad={handleLoad}
        onExportPng={handleExportPng}
        onResetExample={() => {
          api.resetToExample();
          setSelection([]);
          setSelectedConnectionId(null);
          setSelectedFrameId(null);
          announce("Loaded the example pump + reference layout.");
        }}
        onClear={() => {
          api.clearScene();
          setSelection([]);
          setSelectedBeamId(null);
          setSelectedFrameId(null);
          setSelectedConnectionId(null);
          cancelBeam();
          cancelConnect();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PROTOTYPE (#146): the floating mode switch, throwaway
// ---------------------------------------------------------------------------

const PROTO_HELP: Record<ProtoMode, string> = {
  edit:
    "(a) Edge editing. Click a frame's edge to select it, then drag a side in or out, or drag a corner. Double-click a side to put a joint (white diamond) in it; drag either half out for a step, use two joints for a notch. Double-click a joint to take it out. Alt-drag moves the whole frame. Shift = 5 mm steps.",
  draw:
    "(b) Corner drawing. Click corners on the table; each side snaps to x or z, whichever the pointer is further along. Click the first corner (or press Enter) to close; a missing elbow is added for you. Backspace drops the last corner, Esc cancels. Shift = 5 mm steps.",
  rects:
    "(c) Rectangles. Click two opposite corners. With no frame selected it makes a new frame; with one selected it adds to it, or cuts from it if Alt is held on the second click. Shift = 5 mm steps.",
};

function ProtoBar({
  mode,
  onMode,
  drafted,
  selectedFrame,
  onTidy,
}: {
  mode: ProtoMode;
  onMode: (mode: ProtoMode) => void;
  drafted: number;
  selectedFrame: Frame | null;
  onTidy: () => void;
}) {
  const corners = selectedFrame ? frameCorners(selectedFrame) : null;
  const button = (value: ProtoMode, label: string) => (
    <button
      type="button"
      onClick={() => onMode(value)}
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        border: "1px solid #dc2626",
        background: mode === value ? "#dc2626" : "transparent",
        color: mode === value ? "#fff" : "inherit",
        cursor: "pointer",
        font: "inherit",
      }}
    >
      {label}
    </button>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 84,
        transform: "translateX(-50%)",
        zIndex: 30,
        width: "min(720px, calc(100% - 32px))",
        padding: "8px 12px",
        borderRadius: 10,
        border: "2px dashed #dc2626",
        background: "color-mix(in srgb, var(--surface, #fff) 92%, transparent)",
        color: "var(--ink, #111)",
        font: "12px/1.4 ui-sans-serif, system-ui, sans-serif",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ color: "#dc2626" }}>PROTOTYPE #146</strong>
        {button("edit", "(a) Edit sides")}
        {button("draw", "(b) Draw corners")}
        {button("rects", "(c) Add / cut rects")}
        {selectedFrame ? (
          <button type="button" onClick={onTidy} style={{ marginLeft: "auto", font: "inherit", cursor: "pointer" }}>
            Tidy joints
          </button>
        ) : null}
      </div>
      <p style={{ margin: "6px 0 0" }}>{PROTO_HELP[mode]}</p>
      <p data-proto-readout style={{ margin: "4px 0 0", fontFamily: "ui-monospace, monospace", fontSize: 11, opacity: 0.8 }}>
        {mode !== "edit" ? `draft: ${drafted} corner(s) · ` : ""}
        {corners
          ? `selected: ${corners.length} corners, outline ${selectedFrame?.outline ? "stored" : "absent (old rectangle)"} · ${corners
              .map(([x, z]) => `(${x}, ${z})`)
              .join(" ")}`
          : "no frame selected"}
      </p>
    </div>
  );
}
