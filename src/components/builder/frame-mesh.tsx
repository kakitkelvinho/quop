"use client";

import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useMemo } from "react";
import { Shape, Vector2 } from "three";

import type { DrawingPreview } from "@/components/builder/frame-drawing";
import type { FrameGrip } from "@/components/builder/frame-reshape";
import { FRAME_FILL_OPACITY, cornerBounds, type Corner, type Frame, type Vec3 } from "@/components/builder/types";

/** Just above the table's top face and the grid, below every part. */
const FRAME_Y_MM = 0.6;
/** The drawn edge's thickness, and the wider strip that takes the press, mm. */
const EDGE_MM = 3;
const SELECTED_EDGE_MM = 6;
const GRAB_MM = 28;
/** A selected hidden frame, drawn faintly so it can be found and edited. */
const GHOST = 0.35;
/** A selected frame's corner handles: drawn, and the square that takes the press, mm. */
const HANDLE_MM = 14;
const HANDLE_RIM_MM = 3;
const HANDLE_GRAB_MM = 36;
/** A side or a way back that a frame being drawn can't take. */
const REFUSED_COLOR = "#dc2626";
/** The marks on a drawing's corners, mm; the first is larger, as a click there closes the outline. */
const CORNER_MARK_MM = 12;
const FIRST_MARK_MM = 20;
/** The cross on a corner a frame being drawn can't take. */
const CROSS_MM = 26;

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
 * A selected frame also has a handle on each corner; a press says which side
 * or corner it took.
 */
export const FrameMesh = memo(function FrameMesh({
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
  /** handed the frame's id, so one stable handler serves every frame */
  onPointerDown: (id: string, event: ThreeEvent<PointerEvent>, grip: FrameGrip) => void;
}) {
  const { corners, color } = frame;
  const edge = selected ? SELECTED_EDGE_MM : EDGE_MM;
  const strength = ghost ? GHOST : 1;
  // a faint tint by default, so the frame marks an area without colouring the
  // table, up to solid; selecting one deepens a faint tint by as much again
  const base = frame.fillOpacity ?? FRAME_FILL_OPACITY;
  const fill = Math.min(1, selected ? base + Math.min(base, FRAME_FILL_OPACITY) : base) * strength;

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
            <mesh
              key={index}
              position={[gx, 0.2, gz]}
              rotation={[-Math.PI / 2, 0, 0]}
              onPointerDown={(event) => onPointerDown(frame.id, event, { kind: "side", index })}
            >
              <planeGeometry args={[sx, sz]} />
              <meshBasicMaterial visible={false} />
            </mesh>
          ))
        : null}
      {selected && interactive
        ? corners.map(([cx, cz], index) => (
            // above the side strips, so a press near a corner takes the corner
            <group key={index} position={[cx, 0.4, cz]} rotation={[-Math.PI / 2, 0, 0]}>
              <mesh raycast={() => null} renderOrder={3}>
                <planeGeometry args={[HANDLE_MM, HANDLE_MM]} />
                <meshBasicMaterial color={color} transparent opacity={strength} depthWrite={false} />
              </mesh>
              <mesh position={[0, 0, 0.1]} raycast={() => null} renderOrder={4}>
                <planeGeometry args={[HANDLE_MM - 2 * HANDLE_RIM_MM, HANDLE_MM - 2 * HANDLE_RIM_MM]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={strength} depthWrite={false} />
              </mesh>
              <mesh position={[0, 0, 0.2]} onPointerDown={(event) => onPointerDown(frame.id, event, { kind: "corner", index })}>
                <planeGeometry args={[HANDLE_GRAB_MM, HANDLE_GRAB_MM]} />
                <meshBasicMaterial visible={false} />
              </mesh>
            </group>
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
});

const onTable = (corners: Corner[]): Vec3[] => corners.map(([x, z]): Vec3 => [x, 0, z]);

/** The refused sentence without its "Can't … there:" lead-in, as a note beside the pointer. */
function shortReason(reason: string): string {
  const [, rest = reason] = reason.split(": ");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * A frame being drawn, over everything so a corner can go on a part: the
 * sides placed so far, solid, then dashed to where a click puts the next
 * corner, and fainter dashes back to the first. A rectangle being dragged
 * out is all way back, at full strength. Where it is refused the dashes turn
 * red and dotted and the corner is crossed out, so colour isn't the only
 * sign; a note beside the pointer says why, or reads the outline's size.
 */
export function FrameDraft({
  corners,
  next,
  closing,
  refused,
  reason,
  pointer,
  color,
}: Pick<DrawingPreview, "next" | "closing" | "refused" | "reason"> & {
  corners: Corner[];
  /** the pointer over the table, which the note sits beside */
  pointer: Corner | null;
  color: string;
}) {
  const last = corners.at(-1);
  const marks = next ? [...corners, next] : corners;
  const dragging = corners.length === 0 && closing !== null;
  const dots = { dashSize: 3, gapSize: 7 };
  const dashes = { dashSize: 10, gapSize: 6 };
  const anchor = pointer ?? next ?? last;
  const { width, depth } = cornerBounds([...corners, ...(next ? [next] : []), ...(closing ?? [])]);
  // on the corner a click would place, or where the way back starts
  const crossAt = refused === "next" ? next : refused === "closing" ? (next ?? last) : null;
  return (
    <group position={[0, FRAME_Y_MM + 1, 0]}>
      {corners.length >= 2 ? (
        <Line points={onTable(corners)} color={color} lineWidth={3} depthTest={false} renderOrder={5} />
      ) : null}
      {last && next ? (
        <Line
          points={onTable([last, next])}
          color={refused === "next" ? REFUSED_COLOR : color}
          lineWidth={2.5}
          dashed
          {...(refused === "next" ? dots : dashes)}
          depthTest={false}
          renderOrder={5}
        />
      ) : null}
      {closing ? (
        <Line
          points={onTable(closing)}
          color={refused === "closing" ? REFUSED_COLOR : color}
          lineWidth={dragging ? 2.5 : 1.5}
          dashed
          {...(refused === "closing" ? dots : dashes)}
          transparent
          opacity={dragging || refused === "closing" ? 1 : 0.6}
          depthTest={false}
          renderOrder={5}
        />
      ) : null}
      {marks.map(([x, z], index) => {
        const pending = index === corners.length;
        if (pending && refused === "next") return null;
        const size = index === 0 && !pending ? FIRST_MARK_MM : CORNER_MARK_MM;
        return (
          <mesh key={index} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={6}>
            <planeGeometry args={[size, size]} />
            <meshBasicMaterial color={color} depthTest={false} transparent opacity={pending ? 0.6 : 1} />
          </mesh>
        );
      })}
      {crossAt ? (
        <group position={[crossAt[0], 0.2, crossAt[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          {[Math.PI / 4, -Math.PI / 4].map((turn) => (
            <mesh key={turn} rotation={[0, 0, turn]} raycast={() => null} renderOrder={7}>
              <planeGeometry args={[CROSS_MM, CROSS_MM / 6]} />
              <meshBasicMaterial color={REFUSED_COLOR} depthTest={false} transparent />
            </mesh>
          ))}
        </group>
      ) : null}
      {anchor && (reason || width > 0 || depth > 0) ? (
        <Html position={[anchor[0], 0, anchor[1]]} zIndexRange={[0, 0]} className="builderHtmlLayer">
          <span className={`builderDraftNote${reason ? " is-refused" : ""}`}>
            {reason ? shortReason(reason) : `${Math.round(width)} × ${Math.round(depth)} mm`}
          </span>
        </Html>
      ) : null}
    </group>
  );
}
