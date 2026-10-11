"use client";

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import { Shape, Vector2 } from "three";

import type { Corner, Frame } from "@/components/builder/types";

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
 * One strip per side, `thickness` across, centred on it. The sides along x
 * run half a thickness past each end and those along z stop half a thickness
 * short, so every corner is closed and covered once.
 */
function sideStrips(corners: Corner[], thickness: number): Strip[] {
  return corners.map(([x0, z0], at) => {
    const [x1, z1] = corners[(at + 1) % corners.length];
    const alongX = z0 === z1;
    const length = alongX ? Math.abs(x1 - x0) + thickness : Math.max(Math.abs(z1 - z0) - thickness, 0);
    return [(x0 + x1) / 2, (z0 + z1) / 2, alongX ? length : thickness, alongX ? thickness : length];
  });
}

/**
 * A frame, flat on the table: a faint tint inside a solid edge, or the edge
 * alone when its fill is off. Only its edge takes a press: the inside lets
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
  const { corners, color } = frame;
  const edge = selected ? SELECTED_EDGE_MM : EDGE_MM;
  const strength = ghost ? GHOST : 1;
  // a faint tint: the frame marks an area, it should not colour the table
  const fill = (selected ? 0.07 : 0.035) * strength;

  // laid flat by the mesh's turn about x, which carries the shape's +y to the table's −z
  const outline = useMemo(() => new Shape(corners.map(([cx, cz]) => new Vector2(cx, -cz))), [corners]);
  const edges = sideStrips(corners, edge);
  const grabs = sideStrips(corners, GRAB_MM);
  const [labelX, labelZ] = corners[0];

  return (
    <group position={[0, FRAME_Y_MM, 0]}>
      {frame.fill === false ? null : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={1}>
          <shapeGeometry args={[outline]} />
          <meshBasicMaterial color={color} transparent opacity={fill} depthWrite={false} />
        </mesh>
      )}
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
        <Html position={[labelX, 0, labelZ]} zIndexRange={[0, 0]} className="builderHtmlLayer">
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
