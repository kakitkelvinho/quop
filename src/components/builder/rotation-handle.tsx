"use client";

// PROTOTYPE (#186): a throwaway rotation handle on the selection ring, to react
// to its look. Not for merging.

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { BufferAttribute, BufferGeometry, DoubleSide } from "three";

import {
  componentRadius,
  componentReferenceX,
  type BuilderComponent,
} from "@/components/builder/types";

const DEG = Math.PI / 180;
/** how high over the table the handle floats, mm: just above the selection ring */
const LIFT_MM = 0.9;
/** half the bubble's width, mm */
const BUBBLE_HALF_MM = 8;
/** the bubble under the pointer or being dragged */
const BUBBLE_HOVER = "#b8325a";
const ARROW_INK = "#fffaf1";

/**
 * A flat band of a circle in the table plane, from angle a0 to a1 (radians,
 * counter-clockwise seen from above, 0 along local +x), with each end fading
 * to nothing over `fade` of its span.
 */
function arcBand(cx: number, r0: number, r1: number, a0: number, a1: number, fade: number) {
  const segments = 48;
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const f = i / segments;
    const t = a0 + (a1 - a0) * f;
    const alpha = fade > 0 ? Math.min(1, f / fade, (1 - f) / fade) : 1;
    for (const r of [r0, r1]) {
      positions.push(cx + r * Math.cos(t), LIFT_MM, -r * Math.sin(t));
      colors.push(1, 1, 1, alpha);
    }
    if (i < segments) {
      const k = i * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 4));
  geometry.setIndex(index);
  return geometry;
}

/** A two-headed arrow along a circle of radius r from a0 to a1. */
function twoWayArrow(cx: number, r: number, a0: number, a1: number, width: number) {
  const head = width * 2.6;
  const reach = (head * 1.3) / r;
  const point = (radius: number, t: number) => [cx + radius * Math.cos(t), LIFT_MM + 0.2, -radius * Math.sin(t)];
  const positions = [
    // each head: two corners at the shaft's end, the tip further round the circle
    ...point(r - head, a0 + reach), ...point(r + head, a0 + reach), ...point(r, a0),
    ...point(r - head, a1 - reach), ...point(r + head, a1 - reach), ...point(r, a1),
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  return { heads: geometry, shaft: arcBand(cx, r - width / 2, r + width / 2, a0 + reach * 0.9, a1 - reach * 0.9, 0) };
}

export type RotationHandleProps = {
  component: BuilderComponent;
  color: string;
  /** a beam sets this part's angle: no handle, just a note saying so */
  lockedBy: string | null;
  /** being turned now: shows the angle */
  rotating: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
};

/**
 * Drawn in the part's own frame, so it turns with the part. The origin is the
 * part's reference point (its position), which the yaw already turns about.
 */
export function RotationHandle({ component, color, lockedBy, rotating, onPointerDown }: RotationHandleProps) {
  const [hover, setHover] = useState(false);
  const ring = componentRadius(component);
  const offset = componentReferenceX(component);
  const centred = offset === 0;

  const shapes = useMemo(() => {
    // the bubble: an oval following the circle, with the two-way arrow inside it
    const bubble = (r: number, a0: number, a1: number) => ({
      fill: arcBand(0, r - BUBBLE_HALF_MM, r + BUBBLE_HALF_MM, a0, a1, 0),
      caps: [a0, a1].map((t) => [r * Math.cos(t), LIFT_MM, -r * Math.sin(t)] as [number, number, number]),
      arrow: twoWayArrow(0, r, a0 - 0.02, a1 + 0.02, 1.8),
    });
    if (centred) {
      // just outside the ring, at the part's front-right
      const r = ring + 14;
      const a0 = -70 * DEG;
      const a1 = -20 * DEG;
      return { guide: null, ...bubble(r, a0, a1), mid: (a0 + a1) / 2, radius: r };
    }
    // a faint quarter circle about the port, on the side away from the beam
    // (local +z, which is the part's right), with the bubble at its middle
    const r = Math.max(38, ring + 10);
    return {
      guide: arcBand(0, r - 1.2, r + 1.2, -140 * DEG, -40 * DEG, 0.3),
      ...bubble(r, -108 * DEG, -72 * DEG),
      mid: -Math.PI / 2,
      radius: r,
    };
  }, [centred, ring]);

  const yaw = (component.rotation * Math.PI) / 180;
  const [x, , z] = component.position;
  const active = hover || rotating;

  if (lockedBy) {
    return (
      <Html position={[x, 2, z]} center zIndexRange={[0, 0]} className="builderHtmlLayer">
        <span className="builderOrderBadge" style={{ transform: `translateY(${ring * 0.6 + 18}px)`, whiteSpace: "nowrap", width: "auto", padding: "0 6px" }}>
          Angle set by {lockedBy}
        </span>
      </Html>
    );
  }

  const labelAt: [number, number, number] = [
    (shapes.radius + 26) * Math.cos(shapes.mid),
    4,
    -(shapes.radius + 26) * Math.sin(shapes.mid),
  ];
  const press = {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onPointerDown(event);
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHover(true);
      document.body.style.cursor = "grab";
    },
    onPointerOut: () => {
      setHover(false);
      document.body.style.cursor = "";
    },
  };
  // drawn over the post bases, so it never hides under the part it turns
  const over = { depthWrite: false, depthTest: false, side: DoubleSide } as const;

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {shapes.guide ? (
        <mesh geometry={shapes.guide} renderOrder={2}>
          <meshBasicMaterial color={color} vertexColors transparent opacity={0.85} {...over} />
        </mesh>
      ) : null}
      <mesh geometry={shapes.fill} renderOrder={3} {...press}>
        <meshBasicMaterial color={active ? BUBBLE_HOVER : color} {...over} />
      </mesh>
      {shapes.caps.map((at, index) => (
        <mesh key={index} position={at} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3} {...press}>
          <circleGeometry args={[BUBBLE_HALF_MM, 24]} />
          <meshBasicMaterial color={active ? BUBBLE_HOVER : color} {...over} />
        </mesh>
      ))}
      <mesh geometry={shapes.arrow.shaft} renderOrder={4}>
        <meshBasicMaterial color={ARROW_INK} {...over} />
      </mesh>
      <mesh geometry={shapes.arrow.heads} renderOrder={4}>
        <meshBasicMaterial color={ARROW_INK} {...over} />
      </mesh>
      {rotating ? (
        <Html position={labelAt} center zIndexRange={[0, 0]} className="builderHtmlLayer">
          <span className="builderOrderBadge" style={{ width: "auto", padding: "0 6px" }}>
            {Math.round(component.rotation)}°
          </span>
        </Html>
      ) : null}
    </group>
  );
}
