"use client";

import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { BufferAttribute, BufferGeometry, Color, DoubleSide } from "three";

import {
  componentRadius,
  componentReferenceX,
  type BuilderComponent,
} from "@/components/builder/types";

// The rotation handle (#186, #199): a small bubble threaded on a circle about
// the pivot, two arrowheads inside it. Drawn flat on the table, in the frame
// of the circle's centre: angles run counter-clockwise seen from above, 0
// along local +x, as yaw does.

const DEG = Math.PI / 180;
/** how high over the table the handle lies, mm: just above the selection ring */
const LIFT_MM = 0.9;
/** half the bubble's width, mm */
const BUBBLE_HALF_MM = 5.5;
/** the bubble's length along the circle, mm, its round ends included */
const BUBBLE_LENGTH_MM = 30;
/** an arrowhead's length along the circle and half its width across it, mm */
const HEAD_LENGTH_MM = 5;
const HEAD_HALF_MM = 3;
/** the faint circle a port's bubble is threaded on, mm wide */
const SKEWER_MM = 1.6;
/** the arrowheads: the order badges' ink, per theme */
const ARROW_INK = { light: "#fffaf1", dark: "#1a1d26" } as const;
/** where a centred part's bubble sits on its ring, and a port's on its quarter circle (part's frame) */
const RING_BUBBLE_ANGLE = -45 * DEG;
const PORT_BUBBLE_ANGLE = -90 * DEG;
/** the badge's distance outside the bubble's circle, mm */
const BADGE_OUT_MM = 20;

/**
 * A flat band of the circle between radii r0 and r1, from angle a0 to a1,
 * each end fading to nothing over `fade` of its span. The fade rides on a
 * per-vertex alpha, so the material needs vertexColors.
 */
function arcBand(r0: number, r1: number, a0: number, a1: number, fade = 0): BufferGeometry {
  const segments = Math.max(8, Math.ceil(((a1 - a0) / (2 * Math.PI)) * 96));
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const f = i / segments;
    const t = a0 + (a1 - a0) * f;
    const alpha = fade > 0 ? Math.min(1, f / fade, (1 - f) / fade) : 1;
    for (const r of [r0, r1]) {
      positions.push(r * Math.cos(t), LIFT_MM, -r * Math.sin(t));
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

/** A disc of radius `half` at angle t on the circle of radius r: one round end of the bubble. */
function cap(r: number, t: number, half: number): BufferGeometry {
  const segments = 24;
  const [cx, cz] = [r * Math.cos(t), -r * Math.sin(t)];
  const positions = [cx, LIFT_MM, cz];
  const index: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * 2 * Math.PI;
    positions.push(cx + half * Math.cos(a), LIFT_MM, cz + half * Math.sin(a));
    if (i > 0) index.push(0, i, i + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(index);
  return geometry;
}

/** Two arrowheads at angle 0 on the circle of radius r, pointing round it each way. */
function arrowheads(r: number): BufferGeometry {
  const point = (radius: number, t: number) => [radius * Math.cos(t), LIFT_MM + 0.2, -radius * Math.sin(t)];
  const gap = 2 / r;
  const length = HEAD_LENGTH_MM / r;
  const positions = [
    ...point(r - HEAD_HALF_MM, gap), ...point(r + HEAD_HALF_MM, gap), ...point(r, gap + length),
    ...point(r - HEAD_HALF_MM, -gap), ...point(r + HEAD_HALF_MM, -gap), ...point(r, -gap - length),
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

/** Geometry built once per input and disposed when it's replaced or unmounted. */
function useGeometries<T extends Record<string, BufferGeometry>>(build: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometries = useMemo(build, deps);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);
  return geometries;
}

// Drawn over the post bases, so the part it turns never hides it. The ring
// beneath is transparent, and three draws the transparent pass after every
// opaque mesh whatever its renderOrder: so the handle joins that pass, at
// full opacity, to land on top of the ring rather than under it.
const OVER = { depthWrite: false, depthTest: false, side: DoubleSide, transparent: true } as const;

type BubbleProps = {
  /** the circle the bubble is threaded on, mm */
  radius: number;
  /** where on it, radians */
  angle: number;
  /** a faint arc of the circle to thread it on, radians either side of it; none on the selection ring, which is its own */
  skewer?: number;
  color: string;
  dark: boolean;
  rotating: boolean;
  /** shown beside the bubble while it is dragged */
  badge: string | null;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
};

function Bubble({ radius, angle, skewer, color, dark, rotating, badge, onPointerDown }: BubbleProps) {
  const [hover, setHover] = useState(false);
  const get = useThree((state) => state.get);
  const active = hover || rotating;
  useEffect(() => {
    if (!active) return;
    const { style } = get().gl.domElement;
    style.cursor = rotating ? "grabbing" : "grab";
    return () => {
      style.cursor = "";
    };
  }, [active, get, rotating]);

  const half = (BUBBLE_LENGTH_MM / 2 - BUBBLE_HALF_MM) / radius;
  const shapes = useGeometries(
    () => ({
      fill: arcBand(radius - BUBBLE_HALF_MM, radius + BUBBLE_HALF_MM, -half, half),
      start: cap(radius, -half, BUBBLE_HALF_MM),
      end: cap(radius, half, BUBBLE_HALF_MM),
      heads: arrowheads(radius),
      ...(skewer ? { skewer: arcBand(radius - SKEWER_MM / 2, radius + SKEWER_MM / 2, -skewer, skewer, 0.3) } : {}),
    }),
    [radius, half, skewer],
  );
  const ink = dark ? ARROW_INK.dark : ARROW_INK.light;
  // under the pointer, the accent lifts a little toward the ink
  const fill = useMemo(
    () => (active ? new Color(color).lerp(new Color(ink), 0.1) : new Color(color)),
    [active, color, ink],
  );

  const press = {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onPointerDown(event);
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHover(true);
    },
    onPointerOut: () => setHover(false),
  };

  return (
    <group rotation={[0, angle, 0]}>
      {shapes.skewer ? (
        <mesh geometry={shapes.skewer} renderOrder={2}>
          <meshBasicMaterial color={color} vertexColors opacity={0.85} {...OVER} />
        </mesh>
      ) : null}
      {[shapes.fill, shapes.start, shapes.end].map((geometry) => (
        <mesh key={geometry.uuid} geometry={geometry} renderOrder={3} {...press}>
          <meshBasicMaterial color={fill} {...OVER} />
        </mesh>
      ))}
      <mesh geometry={shapes.heads} renderOrder={4}>
        <meshBasicMaterial color={ink} {...OVER} />
      </mesh>
      {badge !== null ? (
        <Html
          position={[radius + BADGE_OUT_MM, 4, 0]}
          center
          zIndexRange={[0, 0]}
          className="builderHtmlLayer"
        >
          <span className="builderAngleBadge">{badge}</span>
        </Html>
      ) : null}
    </group>
  );
}

/** Which handle the selection gets, worked out by the scene and drawn by the canvas. */
export type RotationHandleSpec =
  | { kind: "part"; component: BuilderComponent; lockedBy: string | null; rotating: boolean }
  | { kind: "group"; centre: [number, number]; radius: number; turned: number; rotating: boolean };

export type PartRotationHandleProps = {
  component: BuilderComponent;
  /** the selection ring's colour, the theme's accent */
  color: string;
  dark: boolean;
  /** the beam that sets this part's angle, if one does: no handle then, only a note saying so */
  lockedBy: string | null;
  /** being turned now */
  rotating: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
};

/**
 * The handle on one selected part, drawn in its frame so it turns with it,
 * about its reference point (its position), which its yaw turns about. A
 * centred part's bubble sits on its selection ring; a part with a port (a
 * detector's window, a laser's opening) gets a faint quarter circle about
 * the port, off to its side, with the bubble on that.
 */
export function PartRotationHandle({ component, color, dark, lockedBy, rotating, onPointerDown }: PartRotationHandleProps) {
  const ring = componentRadius(component);
  const centred = componentReferenceX(component) === 0;
  const [x, , z] = component.position;

  if (lockedBy) {
    return (
      <Html position={[x, 0, z]} center zIndexRange={[0, 0]} className="builderHtmlLayer">
        <span className="builderLockChip" style={{ transform: `translateY(${ring * 0.6 + 18}px)` }}>
          Angle set by {lockedBy}
        </span>
      </Html>
    );
  }

  return (
    <group position={[x, 0, z]} rotation={[0, component.rotation * DEG, 0]}>
      <Bubble
        // the selection ring is a 3 mm band from `ring` out: thread the bubble on its middle
        radius={centred ? ring + 1.5 : Math.max(38, ring + 10)}
        angle={centred ? RING_BUBBLE_ANGLE : PORT_BUBBLE_ANGLE}
        skewer={centred ? undefined : 50 * DEG}
        color={color}
        dark={dark}
        rotating={rotating}
        badge={rotating ? `${Math.round(component.rotation)}°` : null}
        onPointerDown={onPointerDown}
      />
    </group>
  );
}

export type GroupRotationHandleProps = {
  /** the point the group turns about, [x, z] mm */
  centre: [number, number];
  /** clear of every part in the group, mm */
  radius: number;
  /** how far the drag in flight has turned the group, degrees; 0 at rest */
  turned: number;
  color: string;
  dark: boolean;
  rotating: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
};

/** One handle for several selected parts, on a faint circle round them all. */
export function GroupRotationHandle({ centre, radius, turned, color, dark, rotating, onPointerDown }: GroupRotationHandleProps) {
  const circle = useGeometries(
    () => ({ circle: arcBand(radius - SKEWER_MM / 2, radius + SKEWER_MM / 2, 0, 2 * Math.PI) }),
    [radius],
  );
  return (
    <group position={[centre[0], 0, centre[1]]}>
      <mesh geometry={circle.circle} renderOrder={2}>
        <meshBasicMaterial color={color} vertexColors opacity={0.5} {...OVER} />
      </mesh>
      <Bubble
        radius={radius}
        angle={RING_BUBBLE_ANGLE + turned * DEG}
        color={color}
        dark={dark}
        rotating={rotating}
        badge={rotating ? `${turned > 0 ? "+" : ""}${turned}°` : null}
        onPointerDown={onPointerDown}
      />
    </group>
  );
}
