"use client";

import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { Color } from "three";

import { DELAY_KNOB } from "@/components/builder/component-models";
import { ARROW_INK } from "@/components/builder/rotation-handle";
import { delayArmMm, delaySetting, type BuilderComponent } from "@/components/builder/types";

// The stage handle: the thumbscrews on either side of a delay line's
// carriage, which the model draws, are the grips. While the delay line is
// selected a thin ring in the accent marks each, and dragging either slides
// the carriage along the rail, as the inspector's slider does. The rings are
// drawn like the part, so the one behind the carriage stays hidden, and the
// carriage takes a press over it. Drawn in the delay line's frame, about its
// port, so it turns with it.

const DEG = Math.PI / 180;
/** the ring round the knob: its radius past the knob's, and its thickness, mm */
const RING_GAP_MM = 2;
const RING_TUBE_MM = 0.7;
/** the grab target, a little larger than the knob so it is easy to catch, mm */
const GRAB_RADIUS_MM = DELAY_KNOB.radius + 4;

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

  // under the pointer, the accent lifts a little toward the ink
  const ink = dark ? ARROW_INK.dark : ARROW_INK.light;
  const ring = useMemo(
    () => (active ? new Color(color).lerp(new Color(ink), 0.25) : new Color(color)),
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
  return (
    <group position={[x, y, z]} rotation={[0, component.rotation * DEG, 0]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[-delayArmMm(component) + DELAY_KNOB.x, DELAY_KNOB.y, side * DELAY_KNOB.z]}>
          {/* the ring stands round the knob's outer face, in the plane across its axis, hidden like the knob behind the carriage */}
          <mesh position={[0, 0, (side * DELAY_KNOB.length) / 2]}>
            <torusGeometry args={[DELAY_KNOB.radius + RING_GAP_MM, active ? RING_TUBE_MM * 1.6 : RING_TUBE_MM, 8, 40]} />
            <meshBasicMaterial color={ring} toneMapped={false} />
          </mesh>
          <mesh {...press}>
            <sphereGeometry args={[GRAB_RADIUS_MM, 16, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {sliding ? (
        <Html
          position={[-delayArmMm(component) + DELAY_KNOB.x, DELAY_KNOB.y + 26, 0]}
          center
          zIndexRange={[0, 0]}
          className="builderHtmlLayer"
        >
          <span className="builderAngleBadge">{Math.round(delaySetting(component).stage)} mm</span>
        </Html>
      ) : null}
    </group>
  );
}
