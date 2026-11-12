"use client";

import { Line } from "@react-three/drei";
import { useMemo } from "react";
import type { BlockSymbol, Vec3 } from "./types";

type Point = [number, number, number];

const circle = (radius = 16): Point[] => Array.from({ length: 65 }, (_, i) => {
  const angle = i * Math.PI / 32;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius, 0];
});
const path = (coordinates: [number, number][]): Point[] => coordinates.map(([x, y]) => [x, y, 0]);
const wave = (y: number, halfWidth = 18): Point[] => Array.from({ length: 49 }, (_, i) => {
  const x = -halfWidth + i * halfWidth / 24;
  return [x, y + Math.sin((x + halfWidth) * Math.PI / (halfWidth / 2)) * 2.5, 0];
});

/** Diagram ink in a 44 × 44 local plane, with +x to the right. */
function SymbolInk({ symbol, color }: { symbol: BlockSymbol; color: string }) {
  const strokes = useMemo(() => {
    switch (symbol) {
      case "rf-source": return [circle(), wave(0, 12)];
      case "mixer": return [circle(), path([[-9, -9], [9, 9]]), path([[-9, 9], [9, -9]])];
      case "amplifier": return [path([[-16, -16], [17, 0], [-16, 16], [-16, -16]])];
      case "low-pass": case "high-pass": case "band-pass": return [
        path([[-20, -17], [20, -17], [20, 17], [-20, 17], [-20, -17]]),
        ...[-10, 0, 10].map(wave),
        ...(symbol === "low-pass" || symbol === "band-pass" ? [path([[-8, 4], [8, 16]])] : []),
        ...(symbol === "high-pass" || symbol === "band-pass" ? [path([[-8, -16], [8, -4]])] : []),
      ];
      case "phase-shifter": return [circle(10), path([[0, -16], [0, 17]]), path([[10, 0], [13, -4]])];
      case "sum": return [circle(), path([[9, 9], [-8, 9], [5, 0], [-8, -9], [9, -9]])];
      case "pid": return [
        path([[-19, -10], [-19, 10], [-10, 10], [-7, 7], [-7, 3], [-10, 0], [-19, 0]]),
        path([[-3, 10], [5, 10]]), path([[1, 10], [1, -10]]), path([[-3, -10], [5, -10]]),
        path([[9, -10], [9, 10], [14, 10], [19, 5], [19, -5], [14, -10], [9, -10]]),
      ];
      case "driver": return [
        path([[-20, -10], [-20, 10], [-15, 10], [-10, 5], [-10, -5], [-15, -10], [-20, -10]]),
        path([[-6, -10], [-6, 10], [2, 10], [5, 6], [5, 3], [2, 0], [-6, 0]]),
        path([[0, 0], [6, -10]]), path([[9, 10], [15, -10], [21, 10]]),
      ];
      case "splitter": return [path([[-18, 0], [0, 0], [0, 13]]), path([[0, 0], [18, -12]]), path([[0, 0], [18, 12]]), circle(3)];
      case "bias-tee": return [path([[-20, 0], [-7, 0]]), path([[7, 0], [20, 0]]), path([[-7, -9], [-7, 9]]), path([[7, -9], [7, 9]]), path([[0, 18], [0, 9]]), path([[-5, 9], [5, 9]]), path([[-5, 9], [-2, 5], [2, 13], [5, 9]])];
      case "scope": return [path([[-21, -16], [21, -16], [21, 16], [-21, 16], [-21, -16]]), wave(0)];
      default: return [];
    }
  }, [symbol]);
  return (
    <group>
      {strokes.map((points, index) => <Line key={index} points={points} color={color} lineWidth={2.6} />)}
    </group>
  );
}

export function BlockSymbolFaces({ symbol, size, axis, color, rotation }: { symbol: BlockSymbol; size: Vec3; axis: number; color: string; rotation: number }) {
  const [dx, dy, dz] = size;
  const topScale = Math.min(dx, dz) / 56;
  const yaw = rotation * Math.PI / 180;
  const localX = Math.cos(yaw) - Math.sin(yaw);
  const localZ = Math.sin(yaw) + Math.cos(yaw);
  const zFace = Math.abs(localZ) >= Math.abs(localX);
  const facePosition: Point = zFace ? [0, axis, Math.sign(localZ) * (dz / 2 + 0.12)] : [Math.sign(localX) * (dx / 2 + 0.12), axis, 0];
  const faceRotation: [number, number, number] = [0, zFace ? (localZ >= 0 ? 0 : Math.PI) : (localX >= 0 ? Math.PI / 2 : -Math.PI / 2), 0];
  const faceScale = Math.min(zFace ? dx : dz, dy) / 56;
  return (
    <group>
      <group position={[0, axis + dy / 2 + 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={topScale}>
        <SymbolInk symbol={symbol} color={color} />
      </group>
      <group position={facePosition} rotation={faceRotation} scale={faceScale}>
        <SymbolInk symbol={symbol} color={color} />
      </group>
    </group>
  );
}
