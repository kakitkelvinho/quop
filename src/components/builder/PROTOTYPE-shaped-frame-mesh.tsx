"use client";

/**
 * PROTOTYPE (#146), throwaway, not for merging.
 *
 * A frame of any right-angled outline, flat on the table, plus the drafts the
 * prototype's drawing modes lay down. Unselected, any side takes a press that
 * moves the whole frame (as today). Selected, each side and each corner takes
 * its own press, so it can be reshaped.
 */
import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import { DoubleSide, Shape, ShapeGeometry } from "three";

import {
  frameCorners,
  isJoint,
  selfIntersects,
  type P,
  type ProtoTarget,
} from "@/components/builder/PROTOTYPE-shaped-frames";
import type { Frame } from "@/components/builder/types";

const FRAME_Y_MM = 0.6;
const EDGE_MM = 3;
const SELECTED_EDGE_MM = 6;
const GRAB_MM = 28;
const HANDLE_MM = 22;
const GHOST = 0.35;
const INVALID = "#dc2626";

function sideStrip(a: P, b: P, thick: number): [x: number, z: number, sx: number, sz: number] {
  const horizontal = a[1] === b[1];
  return [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    horizontal ? Math.abs(b[0] - a[0]) + thick : thick,
    horizontal ? thick : Math.abs(b[1] - a[1]) + thick,
  ];
}

export function ProtoFrameMesh({
  frame,
  selected,
  ghost,
  showLabel,
  interactive,
  onPress,
  onDoublePress,
}: {
  frame: Frame;
  selected: boolean;
  ghost: boolean;
  showLabel: boolean;
  interactive: boolean;
  onPress: (event: ThreeEvent<PointerEvent>, target: ProtoTarget) => void;
  onDoublePress: (event: ThreeEvent<MouseEvent>, target: ProtoTarget) => void;
}) {
  const corners = frameCorners(frame);
  const key = corners.map((c) => c.join(",")).join(";");
  const invalid = useMemo(() => selfIntersects(corners), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => {
    const shape = new Shape();
    corners.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
    shape.closePath();
    return new ShapeGeometry(shape);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const color = invalid ? INVALID : frame.color;
  const edge = selected ? SELECTED_EDGE_MM : EDGE_MM;
  const strength = ghost ? GHOST : 1;
  const fill = (selected ? 0.07 : 0.035) * strength;
  // the label sits on the back-most, then left-most corner
  const labelAt = [...corners].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];

  return (
    <group position={[0, FRAME_Y_MM, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={1} geometry={geometry}>
        <meshBasicMaterial color={color} transparent opacity={invalid ? 0.12 : fill} depthWrite={false} side={DoubleSide} />
      </mesh>
      {corners.map((a, i) => {
        const b = corners[(i + 1) % corners.length];
        const [x, z, sx, sz] = sideStrip(a, b, edge);
        const [gx, gz, gsx, gsz] = sideStrip(a, b, GRAB_MM);
        return (
          <group key={i}>
            <mesh position={[x, 0.1, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={2}>
              <planeGeometry args={[sx, sz]} />
              <meshBasicMaterial color={color} transparent opacity={0.9 * strength} depthWrite={false} />
            </mesh>
            {interactive ? (
              <mesh
                position={[gx, 0.2, gz]}
                rotation={[-Math.PI / 2, 0, 0]}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onPress(event, { kind: "edge", index: i });
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onDoublePress(event, { kind: "edge", index: i });
                }}
              >
                <planeGeometry args={[gsx, gsz]} />
                <meshBasicMaterial visible={false} />
              </mesh>
            ) : null}
          </group>
        );
      })}
      {selected && interactive
        ? corners.map(([x, z], i) => {
            const joint = isJoint(corners, i);
            const size = joint ? HANDLE_MM * 0.7 : HANDLE_MM;
            return (
              <mesh
                key={`c${i}`}
                position={[x, 0.4, z]}
                rotation={[-Math.PI / 2, 0, joint ? Math.PI / 4 : 0]}
                renderOrder={4}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onPress(event, { kind: "corner", index: i });
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onDoublePress(event, { kind: "corner", index: i });
                }}
              >
                <planeGeometry args={[size, size]} />
                <meshBasicMaterial color={joint ? "#ffffff" : color} depthTest={false} transparent opacity={0.95} />
              </mesh>
            );
          })
        : null}
      {showLabel && !ghost && frame.label?.trim() ? (
        <Html position={[labelAt[0], 0, labelAt[1]]} zIndexRange={[0, 0]} className="builderHtmlLayer">
          <span
            className={`builderLabel builderLabel--frame${selected ? " is-selected" : ""}`}
            style={{ borderColor: color }}
          >
            {frame.label.trim()}
          </span>
        </Html>
      ) : null}
    </group>
  );
}

/** The corner-drawing draft (b) or the rectangle draft (c), laid on the table. */
export function ProtoDraft({ points, closing, color }: { points: P[]; closing: P[] | null; color: string }) {
  return (
    <group position={[0, 1.2, 0]}>
      {points.length >= 2 ? (
        <Line
          points={points.map(([x, z]) => [x, 0, z] as [number, number, number])}
          color={color}
          lineWidth={3}
          depthTest={false}
          renderOrder={5}
        />
      ) : null}
      {closing && closing.length >= 2 ? (
        <Line
          points={closing.map(([x, z]) => [x, 0, z] as [number, number, number])}
          color={color}
          lineWidth={1.5}
          dashed
          dashSize={10}
          gapSize={6}
          transparent
          opacity={0.7}
          depthTest={false}
          renderOrder={5}
        />
      ) : null}
      {points.map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6} raycast={() => null}>
          <planeGeometry args={[i === 0 ? 20 : 14, i === 0 ? 20 : 14]} />
          <meshBasicMaterial color={color} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}
