"use client";

import { Edges, Html } from "@react-three/drei";
import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";

import { DEFAULT_MOUNT_COLOR, type BuilderComponent } from "@/components/builder/types";

const NEUTRAL_METAL = "#c9ced6";
const BODY_DARK = "#2b2f36";
const GLASS_BLUE = "#bfe3ff";
const GLASS_CYAN = "#9fd8e0";
const PLATE_AMBER = "#f4e2b0";
const SENSOR_GREEN = "#7be08a";
const GENERIC_GRAY = "#8a8f97";
const EMITTER_RED = "#ff5c5c";

type ComponentMeshProps = {
  component: BuilderComponent;
  selected: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
};

/** Component height above the table surface, in mm — used to compute label offsets. */
export function componentHeight(type: BuilderComponent["type"]): number {
  switch (type) {
    case "laser-source":
      return 24;
    case "mirror-mount":
      return 34;
    case "lens":
      return 20;
    case "pbs-cube":
      return 20;
    case "waveplate":
      return 18;
    case "photodiode":
      return 16;
    case "spectrometer":
      return 30;
    default:
      return 20;
  }
}

function SelectionRing({ radius }: { radius: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
      <ringGeometry args={[radius, radius + 2.5, 32]} />
      <meshBasicMaterial color="#6da8ff" transparent opacity={0.85} />
    </mesh>
  );
}

function LaserSource() {
  return (
    <group>
      <mesh position={[0, 12, 0]}>
        <boxGeometry args={[40, 24, 24]} />
        <meshStandardMaterial color={BODY_DARK} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[24, 12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[4, 4, 8, 16]} />
        <meshStandardMaterial color={EMITTER_RED} emissive={EMITTER_RED} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function MirrorMount({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 15, 0]}>
        <cylinderGeometry args={[6, 6, 30, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, 32, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[14, 14, 3, 24]} />
        <meshStandardMaterial color={NEUTRAL_METAL} roughness={0.15} metalness={0.85} />
      </mesh>
    </group>
  );
}

function Lens() {
  return (
    <mesh position={[0, 10, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[12, 12, 4, 24]} />
      <meshStandardMaterial color={GLASS_BLUE} transparent opacity={0.55} roughness={0.1} />
    </mesh>
  );
}

function PbsCube() {
  return (
    <mesh position={[0, 10, 0]}>
      <boxGeometry args={[20, 20, 20]} />
      <meshStandardMaterial color={GLASS_CYAN} transparent opacity={0.5} roughness={0.1} />
      <Edges color="#3d6a70" />
    </mesh>
  );
}

function Waveplate() {
  return (
    <mesh position={[0, 9, 0]} rotation={[0, 0, Math.PI / 2]}>
      <boxGeometry args={[3, 18, 18]} />
      <meshStandardMaterial color={PLATE_AMBER} transparent opacity={0.7} roughness={0.2} />
    </mesh>
  );
}

function Photodiode() {
  return (
    <group>
      <mesh position={[0, 8, 0]}>
        <boxGeometry args={[16, 16, 10]} />
        <meshStandardMaterial color={BODY_DARK} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 8, 5.2]}>
        <boxGeometry args={[10, 10, 0.5]} />
        <meshStandardMaterial color={SENSOR_GREEN} emissive={SENSOR_GREEN} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Spectrometer() {
  return (
    <mesh position={[0, 15, 0]}>
      <boxGeometry args={[60, 30, 40]} />
      <meshStandardMaterial color={GENERIC_GRAY} roughness={0.7} metalness={0.1} />
    </mesh>
  );
}

const LABELS: Record<BuilderComponent["type"], string> = {
  "laser-source": "Laser",
  "mirror-mount": "Mirror",
  lens: "Lens",
  "pbs-cube": "PBS",
  waveplate: "Waveplate",
  photodiode: "Photodiode",
  spectrometer: "Spectrometer",
};

export function ComponentMesh({ component, selected, onPointerDown }: ComponentMeshProps) {
  const height = useMemo(() => componentHeight(component.type), [component.type]);
  const mountColor = component.color ?? DEFAULT_MOUNT_COLOR;

  return (
    <group
      position={component.position}
      rotation={[0, (component.rotation * Math.PI) / 180, 0]}
      onPointerDown={onPointerDown}
    >
      {component.type === "laser-source" ? <LaserSource /> : null}
      {component.type === "mirror-mount" ? <MirrorMount color={mountColor} /> : null}
      {component.type === "lens" ? <Lens /> : null}
      {component.type === "pbs-cube" ? <PbsCube /> : null}
      {component.type === "waveplate" ? <Waveplate /> : null}
      {component.type === "photodiode" ? <Photodiode /> : null}
      {component.type === "spectrometer" ? <Spectrometer /> : null}
      {selected ? <SelectionRing radius={component.type === "spectrometer" ? 36 : 18} /> : null}
      <Html position={[0, height + 10, 0]} center distanceFactor={220} zIndexRange={[0, 0]}>
        <span className="builderLabel">{component.label ?? LABELS[component.type]}</span>
      </Html>
    </group>
  );
}
