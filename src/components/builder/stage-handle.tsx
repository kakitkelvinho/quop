"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Vector3, type Group } from "three";

import { DELAY_KNOB } from "@/components/builder/component-models";
import { ARROW_INK } from "@/components/builder/rotation-handle";
import { delayArmMm, delaySetting, type BuilderComponent } from "@/components/builder/types";

// The stage handle: the thumbscrews on either side of a delay line's
// carriage, which the model draws, are the grips. While the delay line is
// selected each wears a bubble like the rotation handle's, an arrowhead at
// each end pointing along the rail, and dragging either slides the carriage,
// as the inspector's slider does. Only the bubble on the side the camera
// looks at is drawn: the other's ends would peek past the carriage. Drawn in the delay line's frame, about its port, so it turns with it.

const DEG = Math.PI / 180;
/** the bubble's length along the rail and half its height, mm, round ends included: the rotation bubble's */
const BUBBLE_LENGTH_MM = 30;
const BUBBLE_HALF_MM = 5.5;
/** an arrowhead's length and half its width, mm */
const HEAD_LENGTH_MM = 5;
const HEAD_HALF_MM = 3;
/** how far out from the knob's face the bubble stands, mm */
const LIFT_MM = 0.4;
/** how far the grab target, a box round the knob and its bubble, reaches past the bubble's face, mm */
const GRAB_MARGIN_MM = 1.5;

/** Two arrowheads in the bubble's plane, pointing out along it each way. */
function arrowheads(): BufferGeometry {
  const reach = BUBBLE_LENGTH_MM / 2 - 2;
  const base = reach - HEAD_LENGTH_MM;
  const positions = [
    base, -HEAD_HALF_MM, 0, base, HEAD_HALF_MM, 0, reach, 0, 0,
    -base, HEAD_HALF_MM, 0, -base, -HEAD_HALF_MM, 0, -reach, 0, 0,
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
  // under the pointer, the accent lifts a little toward the ink
  const ink = dark ? ARROW_INK.dark : ARROW_INK.light;
  const fill = useMemo(
    () => (active ? new Color(color).lerp(new Color(ink), 0.1) : new Color(color)),
    [active, color, ink],
  );
  const straight = BUBBLE_LENGTH_MM - 2 * BUBBLE_HALF_MM;

  // which side of the carriage faces the camera, checked each frame as the view turns
  const frame = useRef<Group>(null);
  const [facing, setFacing] = useState<1 | -1>(1);
  const eye = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    if (!frame.current) return;
    const side = frame.current.worldToLocal(eye.copy(camera.position)).z >= 0 ? 1 : -1;
    if (side !== facing) setFacing(side);
  });

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
  const at = -delayArmMm(component) + DELAY_KNOB.x;
  return (
    <group ref={frame} position={[x, y, z]} rotation={[0, component.rotation * DEG, 0]}>
      <group position={[at, DELAY_KNOB.y, facing * DELAY_KNOB.z]}>
        {/* the bubble lies on the knob's outer face, facing out, long along the rail */}
        <group position={[0, 0, facing * (DELAY_KNOB.length / 2 + LIFT_MM)]} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
          <mesh>
            <planeGeometry args={[straight, 2 * BUBBLE_HALF_MM]} />
            <meshBasicMaterial color={fill} toneMapped={false} />
          </mesh>
          {[-1, 1].map((end) => (
            <mesh key={end} position={[(end * straight) / 2, 0, 0]}>
              <circleGeometry args={[BUBBLE_HALF_MM, 24]} />
              <meshBasicMaterial color={fill} toneMapped={false} />
            </mesh>
          ))}
          <mesh geometry={heads} position={[0, 0, 0.2]}>
            <meshBasicMaterial color={ink} side={DoubleSide} toneMapped={false} />
          </mesh>
        </group>
        <mesh {...press}>
          <boxGeometry args={[BUBBLE_LENGTH_MM + 2, 2 * BUBBLE_HALF_MM + 2, DELAY_KNOB.length + 2 * GRAB_MARGIN_MM]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {sliding ? (
        <Html position={[at, DELAY_KNOB.y + 26, 0]} center zIndexRange={[0, 0]} className="builderHtmlLayer">
          <span className="builderAngleBadge">{Math.round(delaySetting(component).stage)} mm</span>
        </Html>
      ) : null}
    </group>
  );
}
