"use client";

// PROTOTYPE (#186): a throwaway rotation handle on the selection ring, to react
// to its look. Not for merging.

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { BufferAttribute, BufferGeometry, Color, DoubleSide } from "three";

import {
  componentRadius,
  componentReferenceX,
  type BuilderComponent,
} from "@/components/builder/types";

const DEG = Math.PI / 180;
/** how high over the table the handle floats, mm: just above the selection ring */
const LIFT_MM = 0.9;
/** half the bubble's width, mm */
const BUBBLE_HALF_MM = 5.5;
/** the bubble's length along the circle, mm, end caps included */
const BUBBLE_LENGTH_MM = 30;
/** half an arrowhead's width, mm */
const HEAD_HALF_MM = 3;
/** the skewer: the circle line running through the bubble, mm wide */
const SKEWER_MM = 1.6;
/** the arrowheads: the same ink as the order badges, per theme */
const ARROW_INK = { light: "#fffaf1", dark: "#1a1d26" } as const;

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

/** Two arrowheads inside the bubble, pointing round the circle each way from its middle. */
function arrowheads(cx: number, r: number, mid: number, half: number) {
  const point = (radius: number, t: number) => [cx + radius * Math.cos(t), LIFT_MM + 0.2, -radius * Math.sin(t)];
  const gap = 2 / r; // between the two heads
  const length = half / r; // along the circle
  const spread = HEAD_HALF_MM; // across it
  const positions = [
    ...point(r - spread, mid + gap), ...point(r + spread, mid + gap), ...point(r, mid + gap + length),
    ...point(r - spread, mid - gap), ...point(r + spread, mid - gap), ...point(r, mid - gap - length),
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

export type RotationHandleProps = {
  component: BuilderComponent;
  /** the selection ring's colour, the theme's accent */
  color: string;
  dark: boolean;
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
export function RotationHandle({ component, color, dark, lockedBy, rotating, onPointerDown }: RotationHandleProps) {
  const [hover, setHover] = useState(false);
  const ring = componentRadius(component);
  const offset = componentReferenceX(component);
  const centred = offset === 0;

  const shapes = useMemo(() => {
    // the bubble: a short sausage threaded on the circle, two arrowheads inside
    const bubble = (r: number, mid: number) => {
      const half = (BUBBLE_LENGTH_MM / 2 - BUBBLE_HALF_MM) / r;
      return {
        fill: arcBand(0, r - BUBBLE_HALF_MM, r + BUBBLE_HALF_MM, mid - half, mid + half, 0),
        caps: [mid - half, mid + half].map((t) => [r * Math.cos(t), LIFT_MM, -r * Math.sin(t)] as [number, number, number]),
        heads: arrowheads(0, r, mid, 5),
      };
    };
    if (centred) {
      // threaded on the selection ring itself, at the part's front-right
      const r = ring + 1.5;
      const mid = -45 * DEG;
      return { skewer: null, ...bubble(r, mid), mid, radius: r };
    }
    // a faint quarter circle about the port, on the part's right (local +z),
    // threaded through the bubble at its middle
    const r = Math.max(38, ring + 10);
    const mid = -90 * DEG;
    return {
      skewer: arcBand(0, r - SKEWER_MM / 2, r + SKEWER_MM / 2, mid - 50 * DEG, mid + 50 * DEG, 0.3),
      ...bubble(r, mid),
      mid,
      radius: r,
    };
  }, [centred, ring]);

  const yaw = (component.rotation * Math.PI) / 180;
  const [x, , z] = component.position;
  const active = hover || rotating;
  const ink = dark ? ARROW_INK.dark : ARROW_INK.light;
  // under the pointer, the accent lifts a little toward the ink
  const fill = useMemo(() => (active ? new Color(color).lerp(new Color(ink), 0.18) : new Color(color)), [active, color, ink]);

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
    (shapes.radius + 20) * Math.cos(shapes.mid),
    4,
    -(shapes.radius + 20) * Math.sin(shapes.mid),
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
  // the ring is transparent, so three draws it after every opaque mesh: the
  // bubble joins the transparent pass, at full opacity, to land on top of it
  const over = { depthWrite: false, depthTest: false, side: DoubleSide, transparent: true, opacity: 1 } as const;

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {shapes.skewer ? (
        <mesh geometry={shapes.skewer} renderOrder={2}>
          <meshBasicMaterial color={color} vertexColors {...over} opacity={0.85} />
        </mesh>
      ) : null}
      <mesh geometry={shapes.fill} renderOrder={3} {...press}>
        <meshBasicMaterial color={fill} {...over} />
      </mesh>
      {shapes.caps.map((at, index) => (
        <mesh key={index} position={at} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3} {...press}>
          <circleGeometry args={[BUBBLE_HALF_MM, 24]} />
          <meshBasicMaterial color={fill} {...over} />
        </mesh>
      ))}
      <mesh geometry={shapes.heads} renderOrder={4}>
        <meshBasicMaterial color={ink} {...over} />
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
