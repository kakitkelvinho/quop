"use client";

import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ComponentMesh, componentHeight } from "@/components/builder/component-models";
import {
  COMPONENT_LIBRARY,
  DEFAULT_MOUNT_COLOR,
  GRID_SIZE_MM,
  ROTATION_STEP_DEG,
  TABLE_DEPTH_MM,
  TABLE_WIDTH_MM,
  createBeamId,
  createComponentId,
  snapToGrid,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  type Vec3,
} from "@/components/builder/types";

const CAMERA_DISTANCE = 480;

function IsometricRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(CAMERA_DISTANCE, CAMERA_DISTANCE, CAMERA_DISTANCE);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function TablePlane({ onPlace }: { onPlace: (point: Vec3) => void }) {
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const x = snapToGrid(event.point.x);
      const z = snapToGrid(event.point.z);
      onPlace([x, 0, z]);
    },
    [onPlace],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerDown={handlePointerDown}>
      <planeGeometry args={[TABLE_WIDTH_MM, TABLE_DEPTH_MM]} />
      <meshStandardMaterial color="#1c2230" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

function beamPoints(components: BuilderComponent[], beam: Beam): Vec3[] {
  return beam.path
    .map((id) => components.find((component) => component.id === id))
    .filter((component): component is BuilderComponent => Boolean(component))
    .map((component) => {
      const height = componentHeight(component.type) / 2;
      return [component.position[0], height, component.position[2]] as Vec3;
    });
}

export type BuilderSceneProps = {
  initial?: BuilderSceneData;
};

export default function BuilderScene({ initial }: BuilderSceneProps) {
  const [components, setComponents] = useState<BuilderComponent[]>(initial?.components ?? []);
  const [beams, setBeams] = useState<Beam[]>(initial?.beams ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placingType, setPlacingType] = useState<ComponentType | null>(null);
  const [beamMode, setBeamMode] = useState(false);
  const [beamDraft, setBeamDraft] = useState<string[]>([]);
  const [beamColor, setBeamColor] = useState(DEFAULT_MOUNT_COLOR);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => components.find((component) => component.id === selectedId) ?? null,
    [components, selectedId],
  );

  const handlePlace = useCallback(
    (point: Vec3) => {
      if (!placingType) {
        setSelectedId(null);
        return;
      }
      const nextComponent: BuilderComponent = {
        id: createComponentId(placingType),
        type: placingType,
        position: point,
        rotation: 0,
        color: placingType === "mirror-mount" ? DEFAULT_MOUNT_COLOR : undefined,
      };
      setComponents((current) => [...current, nextComponent]);
      setSelectedId(nextComponent.id);
      setPlacingType(null);
    },
    [placingType],
  );

  const handleSelectComponent = useCallback(
    (id: string) => {
      if (beamMode) {
        setBeamDraft((current) => (current[current.length - 1] === id ? current : [...current, id]));
        return;
      }
      setPlacingType(null);
      setSelectedId(id);
    },
    [beamMode],
  );

  const rotateSelected = useCallback(() => {
    if (!selectedId) return;
    setComponents((current) =>
      current.map((component) =>
        component.id === selectedId
          ? { ...component, rotation: (component.rotation + ROTATION_STEP_DEG) % 360 }
          : component,
      ),
    );
  }, [selectedId]);

  const recolorSelected = useCallback(
    (color: string) => {
      if (!selectedId) return;
      setComponents((current) =>
        current.map((component) => (component.id === selectedId ? { ...component, color } : component)),
      );
    },
    [selectedId],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setComponents((current) => current.filter((component) => component.id !== selectedId));
    setBeams((current) => current.filter((beam) => !beam.path.includes(selectedId)));
    setSelectedId(null);
  }, [selectedId]);

  const startBeam = useCallback(() => {
    setSelectedId(null);
    setPlacingType(null);
    setBeamMode(true);
    setBeamDraft([]);
  }, []);

  const cancelBeam = useCallback(() => {
    setBeamMode(false);
    setBeamDraft([]);
  }, []);

  const finishBeam = useCallback(() => {
    if (beamDraft.length >= 2) {
      const beam: Beam = { id: createBeamId(), path: beamDraft, color: beamColor };
      setBeams((current) => [...current, beam]);
    }
    setBeamMode(false);
    setBeamDraft([]);
  }, [beamDraft, beamColor]);

  const clearTable = useCallback(() => {
    setComponents([]);
    setBeams([]);
    setSelectedId(null);
    setBeamMode(false);
    setBeamDraft([]);
  }, []);

  const handleSave = useCallback(() => {
    const data: BuilderSceneData = { components, beams };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quop-setup-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [components, beams]);

  const handleLoadFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<BuilderSceneData>;
        setComponents(Array.isArray(parsed.components) ? parsed.components : []);
        setBeams(Array.isArray(parsed.beams) ? parsed.beams : []);
        setSelectedId(null);
        setBeamMode(false);
        setBeamDraft([]);
      } catch {
        window.alert("That file doesn't look like a valid setup JSON.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }, []);

  return (
    <div className="builderLayout">
      <aside className="builderPanel">
        <p className="sectionCard__kicker">Components</p>
        <div className="builderPalette">
          {COMPONENT_LIBRARY.map((entry) => (
            <button
              key={entry.type}
              type="button"
              className={`builderPaletteButton ${placingType === entry.type ? "is-active" : ""}`}
              onClick={() => {
                setPlacingType((current) => (current === entry.type ? null : entry.type));
                setSelectedId(null);
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {placingType ? (
          <p className="builderHint">Click the table to place a {placingType}.</p>
        ) : null}

        <p className="sectionCard__kicker">Beams</p>
        {beamMode ? (
          <div className="builderPalette">
            <label className="field">
              <span>Beam color</span>
              <input
                type="color"
                value={beamColor}
                onChange={(event) => setBeamColor(event.target.value)}
              />
            </label>
            <p className="builderHint">
              Click components in order ({beamDraft.length} selected). Finish when done.
            </p>
            <div className="buttonRow">
              <button type="button" className="buttonLink" onClick={finishBeam}>
                Finish beam
              </button>
              <button type="button" className="buttonLink buttonLink--ghost" onClick={cancelBeam}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="buttonLink buttonLink--ghost" onClick={startBeam}>
            Draw a beam path
          </button>
        )}

        {selected ? (
          <>
            <p className="sectionCard__kicker">Selected: {selected.type}</p>
            <div className="buttonRow">
              <button type="button" className="buttonLink buttonLink--ghost" onClick={rotateSelected}>
                Rotate 15°
              </button>
              <button type="button" className="buttonLink buttonLink--ghost" onClick={deleteSelected}>
                Delete
              </button>
            </div>
            {selected.type === "mirror-mount" ? (
              <label className="field">
                <span>Mount color</span>
                <input
                  type="color"
                  value={selected.color ?? DEFAULT_MOUNT_COLOR}
                  onChange={(event) => recolorSelected(event.target.value)}
                />
              </label>
            ) : null}
          </>
        ) : null}

        <div className="buttonRow">
          <button type="button" className="buttonLink" onClick={handleSave}>
            Save JSON
          </button>
          <button type="button" className="buttonLink buttonLink--ghost" onClick={() => fileInputRef.current?.click()}>
            Load JSON
          </button>
          <button type="button" className="buttonLink buttonLink--ghost" onClick={clearTable}>
            Clear table
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="builderFileInput"
          onChange={handleLoadFile}
        />
      </aside>

      <div className="builderCanvasHost">
        <Canvas orthographic camera={{ zoom: 3.2, near: 1, far: 4000 }} shadows={false}>
          <IsometricRig />
          <ambientLight intensity={0.65} />
          <directionalLight position={[300, 500, 200]} intensity={0.9} />
          <directionalLight position={[-200, 300, -300]} intensity={0.35} />
          <TablePlane onPlace={handlePlace} />
          <Grid
            args={[TABLE_WIDTH_MM, TABLE_DEPTH_MM]}
            cellSize={GRID_SIZE_MM}
            cellThickness={0.5}
            cellColor="#3a4256"
            sectionColor="#4c5670"
            sectionThickness={0.9}
            fadeDistance={1600}
            position={[0, 0.2, 0]}
          />
          {components.map((component) => (
            <ComponentMesh
              key={component.id}
              component={component}
              selected={component.id === selectedId}
              onPointerDown={(event) => {
                event.stopPropagation();
                handleSelectComponent(component.id);
              }}
            />
          ))}
          {beams.map((beam) => {
            const points = beamPoints(components, beam);
            if (points.length < 2) return null;
            return <Line key={beam.id} points={points} color={beam.color} lineWidth={2.5} />;
          })}
          <OrbitControls enableRotate={false} enableZoom enablePan minZoom={1} maxZoom={12} />
        </Canvas>
      </div>
    </div>
  );
}
