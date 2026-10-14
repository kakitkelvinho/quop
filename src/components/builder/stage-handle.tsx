"use client";

import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { BufferAttribute, BufferGeometry, Color } from "three";

import { ARROW_INK, OVER } from "@/components/builder/rotation-handle";
import { delayArmMm, delaySetting, type BuilderComponent } from "@/components/builder/types";

// The stage handle: a small pill lying just over a delay line's carriage, an
// arrowhead at each end pointing along the rail. Dragging it slides the
// carriage, as the inspector's slider does. Drawn in the delay line's frame,
// about its port, so it turns with it.

const DEG = Math.PI / 180;
/** how far over the beam the pill lies, mm: just clear of the carriage's mirror plate */
const LIFT_MM = 23;
/** where along the rail, mm behind the carriage's mirrors: over the carriage's middle */
const BEHIND_MM = 5;
/** the pill's length along the rail and half its width, mm */
const PILL_LENGTH_MM = 30;
const PILL_HALF_MM = 5.5;
/** an arrowhead's length and half its width, mm */
const HEAD_LENGTH_MM = 4.5;
const HEAD_HALF_MM = 3;

/** Two arrowheads flat on the pill, pointing out along it each way. */
function arrowheads(): BufferGeometry {
  const reach = PILL_LENGTH_MM / 2 - 2;
  const base = reach - HEAD_LENGTH_MM;
  const positions = [
    base, 0, -HEAD_HALF_MM, base, 0, HEAD_HALF_MM, reach, 0, 0,
    -base, 0, HEAD_HALF_MM, -base, 0, -HEAD_HALF_MM, -reach, 0, 0,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

export type StageHandleProps = {
  component: BuilderComponent;
  /** the selection ring's colour, the theme's accent */
  color: string;
  dark: boolean;
  /** being dragged now */
  sliding: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
};

export function StageHandle({ component, color, dark, sliding, onPointerDown }: StageHandleProps) {
  const [hover, setHover] = useState(false);
  const get = useThree((state) => state.get);
  const active = hover || sliding;
  useEffect(() => {
    if (!active) return;
    const { style } = get().gl.domElement;
    style.cursor = sliding ? "grabbing" : "grab";
    return () => {
      style.cursor = "";
    };
  }, [active, get, sliding]);

  const heads = useMemo(() => arrowheads(), []);
  useEffect(() => () => heads.dispose(), [heads]);
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

  const [x, y, z] = component.position;
  const flat = [-Math.PI / 2, 0, 0] as const;
  const straight = PILL_LENGTH_MM - 2 * PILL_HALF_MM;
  return (
    <group position={[x, y, z]} rotation={[0, component.rotation * DEG, 0]}>
      <group position={[-delayArmMm(component) - BEHIND_MM, LIFT_MM, 0]}>
        <mesh rotation={flat} renderOrder={3} {...press}>
          <planeGeometry args={[straight, 2 * PILL_HALF_MM]} />
          <meshBasicMaterial color={fill} {...OVER} />
        </mesh>
        {[-1, 1].map((end) => (
          <mesh key={end} position={[(end * straight) / 2, 0, 0]} rotation={flat} renderOrder={3} {...press}>
            <circleGeometry args={[PILL_HALF_MM, 24]} />
            <meshBasicMaterial color={fill} {...OVER} />
          </mesh>
        ))}
        <mesh geometry={heads} position={[0, 0.2, 0]} renderOrder={4}>
          <meshBasicMaterial color={ink} {...OVER} />
        </mesh>
        {sliding ? (
          <Html position={[0, 6, -PILL_HALF_MM - 14]} center zIndexRange={[0, 0]} className="builderHtmlLayer">
            <span className="builderAngleBadge">{Math.round(delaySetting(component).stage)} mm</span>
          </Html>
        ) : null}
      </group>
    </group>
  );
}
