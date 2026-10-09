"use client";

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";

import type { Frame } from "@/components/builder/types";

/** Just above the table's top face and the grid, below every part. */
const FRAME_Y_MM = 0.6;
/** The drawn edge's thickness, and the wider strip that takes the press, mm. */
const EDGE_MM = 3;
const SELECTED_EDGE_MM = 6;
const GRAB_MM = 28;
/** A selected hidden frame, drawn faintly so it can be found and edited. */
const GHOST = 0.35;

type Strip = [x: number, z: number, sizeX: number, sizeZ: number];

/**
 * A frame, flat on the table. Only its edge takes a press: the inside lets
 * clicks and drags through to the table, so a frame around a breadboard never
 * stops the table from panning, or a part from being placed or picked inside it.
 */
export function FrameMesh({
  frame,
  selected,
  ghost,
  showLabel,
  interactive,
  onPointerDown,
}: {
  frame: Frame;
  selected: boolean;
  /** a hidden frame that is selected: only a faint outline */
  ghost: boolean;
  showLabel: boolean;
  /** off while placing a part or drawing a beam or connection: the edge is then no more than a drawing */
  interactive: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const [x, z] = frame.position;
  const { width, depth, color } = frame;
  const edge = selected ? SELECTED_EDGE_MM : EDGE_MM;
  const strength = ghost ? GHOST : 1;
  const fill = (selected ? 0.2 : 0.11) * strength;

  // the four edges, centred on the frame
  const edges: Strip[] = [
    [0, -depth / 2, width + edge, edge],
    [0, depth / 2, width + edge, edge],
    [-width / 2, 0, edge, depth - edge],
    [width / 2, 0, edge, depth - edge],
  ];
  const grabs: Strip[] = [
    [0, -depth / 2, width + GRAB_MM, GRAB_MM],
    [0, depth / 2, width + GRAB_MM, GRAB_MM],
    [-width / 2, 0, GRAB_MM, depth - GRAB_MM],
    [width / 2, 0, GRAB_MM, depth - GRAB_MM],
  ];

  return (
    <group position={[x, FRAME_Y_MM, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={1}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={color} transparent opacity={fill} depthWrite={false} />
      </mesh>
      {edges.map(([ex, ez, sx, sz], index) => (
        <mesh key={index} position={[ex, 0.1, ez]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={2}>
          <planeGeometry args={[sx, sz]} />
          <meshBasicMaterial color={color} transparent opacity={0.9 * strength} depthWrite={false} />
        </mesh>
      ))}
      {interactive
        ? grabs.map(([gx, gz, sx, sz], index) => (
            <mesh key={index} position={[gx, 0.2, gz]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onPointerDown}>
              <planeGeometry args={[sx, sz]} />
              <meshBasicMaterial visible={false} />
            </mesh>
          ))
        : null}
      {showLabel && !ghost && frame.label?.trim() ? (
        <Html position={[-width / 2, 0, -depth / 2]} zIndexRange={[0, 0]} className="builderHtmlLayer">
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
