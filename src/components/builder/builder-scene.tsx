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
  type CameraView,
} from "@/components/builder/builder-canvas";
import BuilderHud from "@/components/builder/builder-hud";
import { useScenePalette } from "@/components/builder/scene-theme";
import { useBuilderScene } from "@/components/builder/use-builder-scene";
import { getTheme, setTheme } from "@/components/theme-toggle";
import {
  BEAM_COLORS,
  COMPONENT_SPECS,
  FINE_GRID_MM,
  GRID_SIZE_MM,
  TABLE_DEPTH_MM,
  TABLE_WIDTH_MM,
  beamLengthMm,
  clampToTable,
  componentById,
  componentDisplayName,
  findHost,
  lengthToPicoseconds,
  parseScene,
  serializeScene,
  snapToGrid,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
} from "@/components/builder/types";

type DragState = {
  id: string;
  offsetX: number;
  offsetZ: number;
  /** scene as it was when the drag began — pushed to history on the first real move */
  snapshot: BuilderSceneData;
  started: boolean;
};

function clampXZ(x: number, y: number, z: number): [number, number, number] {
  const [clampedX, clampedZ] = clampToTable(x, z);
  return [clampedX, y, clampedZ];
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedBeamId, setSelectedBeamId] = useState<string | null>(null);
  const [placingType, setPlacingType] = useState<ComponentType | null>(null);
  const [beamMode, setBeamMode] = useState(false);
  const [beamDraft, setBeamDraft] = useState<string[]>([]);
  const [beamColor, setBeamColor] = useState<string>(BEAM_COLORS[0]);
  const [showLabels, setShowLabels] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [view, setView] = useState<CameraView>("iso");
  const [fitToken, setFitToken] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  const dragRef = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Pointer handlers run outside React's render pass and need the newest
  // scene without re-subscribing on every edit.
  const sceneRef = useRef(scene);
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  const selected = useMemo(
    () =>
      selectedId ? (componentById(scene.components, selectedId) ?? null) : null,
    [scene.components, selectedId],
  );
  const selectedBeam = useMemo(
    () => scene.beams.find((beam) => beam.id === selectedBeamId) ?? null,
    [scene.beams, selectedBeamId],
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
      if (beamMode) return;
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
        setSelectedId(id);
        setPlacingType(null);
        return;
      }
      setSelectedId(null);
      setSelectedBeamId(null);
    },
    [api, beamMode, placingType],
  );

  const handleComponentPointerDown = useCallback(
    (id: string, event: ThreeEvent<PointerEvent>) => {
      if (beamMode) {
        setBeamDraft((current) =>
          current[current.length - 1] === id ? current : [...current, id],
        );
        return;
      }
      const component = componentById(sceneRef.current.components, id);
      if (!component) return;

      setPlacingType(null);
      setSelectedId(id);
      setSelectedBeamId(null);
      dragRef.current = {
        id,
        offsetX: component.position[0] - event.point.x,
        offsetZ: component.position[2] - event.point.z,
        snapshot: sceneRef.current,
        started: false,
      };
      setDragging(true);
    },
    [beamMode],
  );

  const handleSurfaceDrag = useCallback(
    (x: number, z: number, event: ThreeEvent<PointerEvent>) => {
      const drag = dragRef.current;
      if (!drag) return;

      const step = event.nativeEvent.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM;
      const nextX = snapToGrid(x + drag.offsetX, step);
      const nextZ = snapToGrid(z + drag.offsetZ, step);

      const component = componentById(sceneRef.current.components, drag.id);
      if (!component) return;

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
      if (!drag.started) {
        drag.started = true;
        api.commitCheckpoint(drag.snapshot);
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
    const endDrag = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  // ---- beams ---------------------------------------------------------------

  const startBeam = useCallback(() => {
    setBeamMode(true);
    setBeamDraft([]);
    setPlacingType(null);
    setTrayOpen(false);
    setSelectedId(null);
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

  // ---- file & image --------------------------------------------------------

  const handleSave = useCallback(() => {
    const blob = new Blob([serializeScene(sceneRef.current)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quop-setup-${new Date().toISOString().slice(0, 10)}.json`;
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
          setSelectedId(null);
          setSelectedBeamId(null);
          cancelBeam();
          announce(
            `Loaded ${parsed.components.length} parts from ${file.name}.`,
          );
        } catch {
          announce("Couldn't read that file — it isn't valid JSON.");
        }
      };
      reader.readAsText(file);
    },
    [announce, api, cancelBeam],
  );

  const handleExportPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `quop-setup-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      announce("Exported the view as a PNG.");
    } catch {
      announce("Couldn't export the canvas in this browser.");
    }
  }, [announce]);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  // ---- keyboard ------------------------------------------------------------

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

      if (event.key === "Escape") {
        // stop placing first, so Esc mid-run keeps the panel for the next part
        if (placingType) setPlacingType(null);
        else if (trayOpen) setTrayOpen(false);
        else if (beamMode) cancelBeam();
        else {
          setSelectedId(null);
          setSelectedBeamId(null);
        }
        return;
      }

      if (beamMode && event.key === "Enter") {
        event.preventDefault();
        finishBeam();
        return;
      }

      if (!selectedId) return;

      const step = event.shiftKey ? FINE_GRID_MM : GRID_SIZE_MM;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          api.nudgeComponent(selectedId, -step, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          api.nudgeComponent(selectedId, step, 0);
          break;
        case "ArrowUp":
          event.preventDefault();
          api.nudgeComponent(selectedId, 0, -step);
          break;
        case "ArrowDown":
          event.preventDefault();
          api.nudgeComponent(selectedId, 0, step);
          break;
        case "Delete":
        case "Backspace":
          event.preventDefault();
          api.deleteComponent(selectedId);
          setSelectedId(null);
          break;
        case "r":
        case "R":
          api.rotateComponent(selectedId, event.shiftKey ? -1 : 1);
          break;
        case "d":
        case "D": {
          if (meta) return;
          const copyId = api.duplicateComponent(selectedId);
          if (copyId) setSelectedId(copyId);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [api, beamMode, cancelBeam, finishBeam, placingType, selectedId, trayOpen]);

  // ---- readout -------------------------------------------------------------

  const readout = useMemo(() => {
    if (selected) {
      return [
        COMPONENT_SPECS[selected.type].tag.toUpperCase(),
        `x ${Math.round(selected.position[0])}`,
        `z ${Math.round(selected.position[2])}`,
        `h ${Math.round(selected.position[1])}`,
        `yaw ${Math.round(selected.rotation)}°`,
      ].join("   ");
    }
    if (selectedBeam) {
      const length = beamLengthMm(scene.components, selectedBeam);
      return [
        "BEAM",
        `${selectedBeam.path.length} stops`,
        `${Math.round(length)} mm`,
        `${lengthToPicoseconds(length).toFixed(1)} ps`,
      ].join("   ");
    }
    return [
      `${scene.components.length} parts`,
      `${scene.beams.length} beams`,
      `table ${TABLE_WIDTH_MM}×${TABLE_DEPTH_MM} mm`,
    ].join("   ");
  }, [scene.beams.length, scene.components, selected, selectedBeam]);

  const updateSelected = useCallback(
    (patch: Partial<Omit<BuilderComponent, "id" | "type">>, record?: boolean) => {
      if (!selectedId) return;
      api.updateComponent(selectedId, patch, record);
    },
    [api, selectedId],
  );

  const handleSelectBeam = useCallback((id: string) => {
    setSelectedBeamId((current) => (current === id ? null : id));
    setSelectedId(null);
  }, []);

  return (
    <div className="builderWorkspace">
      <div
        className={`builderCanvasHost${placingType || beamMode ? " is-picking" : ""}`}
      >
        <BuilderCanvas
          components={scene.components}
          beams={scene.beams}
          palette={palette}
          selectedId={selectedId}
          selectedBeamId={selectedBeamId}
          hoveredId={hoveredId}
          beamDraft={beamDraft}
          showLabels={showLabels}
          showGrid={showGrid}
          view={view}
          fitToken={fitToken}
          dragging={dragging}
          onSurfaceClick={handleSurfaceClick}
          onSurfaceDrag={handleSurfaceDrag}
          onComponentPointerDown={handleComponentPointerDown}
          onComponentHover={setHoveredId}
          onCanvasReady={handleCanvasReady}
          placing={placingType !== null}
        />
      </div>

      <BuilderHud
        components={scene.components}
        beams={scene.beams}
        selected={selected}
        selectedBeam={selectedBeam}
        placingType={placingType}
        trayOpen={trayOpen}
        beamMode={beamMode}
        beamDraft={beamDraft}
        beamColor={beamColor}
        showLabels={showLabels}
        showGrid={showGrid}
        view={view}
        canUndo={api.canUndo}
        canRedo={api.canRedo}
        readout={readout}
        status={status}
        onToggleTray={() => setTrayOpen((open) => !open)}
        onPickType={(type) => {
          // the panel stays open, so a run of parts goes down without reopening it
          cancelBeam();
          setPlacingType(type);
        }}
        onCloseTray={() => setTrayOpen(false)}
        onSelectTool={() => {
          cancelBeam();
          setPlacingType(null);
          setTrayOpen(false);
        }}
        onDeselect={() => {
          setSelectedId(null);
          setSelectedBeamId(null);
        }}
        onUpdateSelected={updateSelected}
        onRotateSelected={(direction) =>
          selectedId && api.rotateComponent(selectedId, direction)
        }
        onDuplicateSelected={() => {
          if (!selectedId) return;
          const copyId = api.duplicateComponent(selectedId);
          if (copyId) setSelectedId(copyId);
        }}
        onDeleteSelected={() => {
          if (!selectedId) return;
          api.deleteComponent(selectedId);
          setSelectedId(null);
        }}
        onStartBeam={startBeam}
        onFinishBeam={finishBeam}
        onCancelBeam={cancelBeam}
        onUndoBeamStep={undoBeamStep}
        onBeamColorChange={setBeamColor}
        onSelectBeam={handleSelectBeam}
        onUpdateBeam={api.updateBeam}
        onCheckpoint={() => api.commitCheckpoint(sceneRef.current)}
        onDeleteBeam={(id) => {
          api.deleteBeam(id);
          setSelectedBeamId((current) => (current === id ? null : current));
        }}
        onToggleLabels={() => setShowLabels((current) => !current)}
        onToggleGrid={() => setShowGrid((current) => !current)}
        onViewChange={setView}
        onFit={() => setFitToken((token) => token + 1)}
        onToggleTheme={() => setTheme(getTheme() === "dark" ? "light" : "dark")}
        onUndo={api.undo}
        onRedo={api.redo}
        onSave={handleSave}
        onLoad={handleLoad}
        onExportPng={handleExportPng}
        onResetExample={() => {
          api.resetToExample();
          setSelectedId(null);
          announce("Loaded the example pump + reference layout.");
        }}
        onClear={() => {
          api.clearScene();
          setSelectedId(null);
          setSelectedBeamId(null);
          cancelBeam();
        }}
      />
    </div>
  );
}
