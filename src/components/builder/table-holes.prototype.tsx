"use client";
/* eslint-disable react-hooks/immutability -- PROTOTYPE: uniforms are mutated in place */

// PROTOTYPE, throwaway. Question: what should the Tabletop's grid look like
// once it shows the optical table's M6 holes on a 25 mm pitch instead of lines?
// Four variants on /builder/tabletop, switched with ?variant=A|B|C|D (bottom bar,
// or ← →). Turn the grid on in the toolbar to see them.

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, DoubleSide, type Mesh, ShaderMaterial } from "three";

export const HOLE_VARIANTS = {
  A: "Lines (today)",
  B: "M6 holes",
  C: "Holes + beam rows",
  D: "Steel plate",
} as const;
export type HoleVariant = keyof typeof HOLE_VARIANTS;

const PITCH_MM = 25;
/** an M6 tapped hole reads as about 6 mm across from above */
const HOLE_DIAMETER_MM = 6;
const SPAN_MM = 20000;

const vertex = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Holes sit on multiples of the pitch, so a part snapped to the 25 mm grid
// stands on a hole. Every edge is anti-aliased with fwidth, and holes fade to
// a flat tint once they shrink under a couple of pixels, so a far zoom shows no
// moiré.
const fragment = /* glsl */ `
  uniform vec3 uHole;
  uniform vec3 uRim;
  uniform vec3 uPlate;
  uniform vec3 uLine;
  uniform float uPitch;
  uniform float uRadius;
  uniform float uFade;
  uniform vec2 uCentre;
  uniform float uPlateAlpha;
  uniform float uRimAlpha;
  uniform float uLineAlpha;
  varying vec2 vWorld;

  void main() {
    vec2 cell = vWorld / uPitch;
    vec2 local = (fract(cell + 0.5) - 0.5) * uPitch; // mm from the nearest hole
    float d = length(local);
    float px = fwidth(d);                            // mm per pixel here
    float pxPerPitch = uPitch / max(fwidth(vWorld.x), 1e-4);

    float hole = 1.0 - smoothstep(uRadius - px, uRadius + px, d);
    // the countersink: a thin lighter ring just outside the hole
    float rimOuter = uRadius + 1.2;
    float rim = (1.0 - smoothstep(rimOuter - px, rimOuter + px, d)) * (1.0 - hole);

    // guide lines through the hole centres, one pixel wide
    vec2 lineD = abs(local) / max(fwidth(vWorld), vec2(1e-4));
    float line = 1.0 - min(min(lineD.x, lineD.y), 1.0);

    // holes give way to a flat tint as they near a pixel
    float detail = smoothstep(4.0, 12.0, pxPerPitch);
    float far = 1.0 - smoothstep(uFade * 0.4, uFade, length(vWorld - uCentre));

    vec3 colour = uPlate;
    float alpha = uPlateAlpha;
    colour = mix(colour, uLine, line * uLineAlpha * detail);
    alpha = max(alpha, line * uLineAlpha * detail);
    colour = mix(colour, uRim, rim * uRimAlpha * detail);
    alpha = max(alpha, rim * uRimAlpha * detail);
    colour = mix(colour, uHole, hole * detail);
    alpha = max(alpha, hole * detail);
    // far away, the holes average to a faint tone instead of shimmering
    float average = 3.1416 * uRadius * uRadius / (uPitch * uPitch);
    alpha = mix(max(uPlateAlpha, average * 0.6), alpha, detail);
    colour = mix(mix(uPlate, uHole, step(uPlateAlpha, 0.001)), colour, detail);

    gl_FragColor = vec4(colour, alpha * far);
    if (gl_FragColor.a < 0.003) discard;
  }
`;

type Look = {
  hole: string;
  rim: string;
  plate: string;
  line: string;
  plateAlpha: number;
  rimAlpha: number;
  lineAlpha: number;
};

function looks(variant: Exclude<HoleVariant, "A">, dark: boolean): Look {
  if (variant === "B")
    return dark
      ? { hole: "#5a5d63", rim: "#000", plate: "#000", line: "#000", plateAlpha: 0, rimAlpha: 0, lineAlpha: 0 }
      : { hole: "#8f939b", rim: "#000", plate: "#000", line: "#000", plateAlpha: 0, rimAlpha: 0, lineAlpha: 0 };
  if (variant === "C")
    return dark
      ? { hole: "#5a5d63", rim: "#000", plate: "#000", line: "#2c2c2c", plateAlpha: 0, rimAlpha: 0, lineAlpha: 0.9 }
      : { hole: "#8f939b", rim: "#000", plate: "#000", line: "#d3d6dc", plateAlpha: 0, rimAlpha: 0, lineAlpha: 0.9 };
  // D: a satin steel top with dark tapped holes and a bright countersink
  return dark
    ? { hole: "#050506", rim: "#4b4f57", plate: "#1d1f23", line: "#000", plateAlpha: 0.92, rimAlpha: 0.9, lineAlpha: 0 }
    : { hole: "#2a2c31", rim: "#f4f5f7", plate: "#c9ccd1", line: "#000", plateAlpha: 0.85, rimAlpha: 0.9, lineAlpha: 0 };
}

export function TableHoles({ variant, dark }: { variant: Exclude<HoleVariant, "A">; dark: boolean }) {
  const mesh = useRef<Mesh>(null);
  const controls = useThree((state) => state.controls) as { target?: { x: number; z: number } } | null;
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        extensions: { derivatives: true } as never,
        uniforms: {
          uHole: { value: new Color() },
          uRim: { value: new Color() },
          uPlate: { value: new Color() },
          uLine: { value: new Color() },
          uPitch: { value: PITCH_MM },
          uRadius: { value: HOLE_DIAMETER_MM / 2 },
          uFade: { value: 9000 },
          uCentre: { value: [0, 0] },
          uPlateAlpha: { value: 0 },
          uRimAlpha: { value: 0 },
          uLineAlpha: { value: 0 },
        },
      }),
    [],
  );

  const look = looks(variant, dark);
  const u = material.uniforms;
  u.uHole.value.set(look.hole);
  u.uRim.value.set(look.rim);
  u.uPlate.value.set(look.plate);
  u.uLine.value.set(look.line);
  u.uPlateAlpha.value = look.plateAlpha;
  u.uRimAlpha.value = look.rimAlpha;
  u.uLineAlpha.value = look.lineAlpha;

  useFrame(({ camera }) => {
    const target = controls?.target ?? camera.position;
    u.uCentre.value = [target.x, target.z];
    // follow the view on whole pitches, so the pattern never slides
    mesh.current?.position.set(
      Math.round(target.x / PITCH_MM) * PITCH_MM,
      0.4,
      Math.round(target.z / PITCH_MM) * PITCH_MM,
    );
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={-1}>
      <planeGeometry args={[SPAN_MM, SPAN_MM]} />
    </mesh>
  );
}
