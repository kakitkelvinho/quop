"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, type Mesh, ShaderMaterial, Vector2 } from "three";

import type { ScenePalette } from "@/components/builder/scene-theme";
import { GRID_SIZE_MM } from "@/components/builder/types";

/** an M6 tapped hole reads as about 6 mm across from above */
const HOLE_RADIUS_MM = 3;
/** the countersink's bright ring, mm out past the hole's edge */
const RIM_MM = 1.2;
/** the plane under the view, mm: past the fade on every side */
const SPAN_MM = 20000;
/** how far from the view's centre the grid has faded out, mm: past the edge of the widest zoom */
const FADE_MM = 9000;
/** the grid lies on the table, just above it (the beam-line snap guide sits at 0.8 mm) */
const GRID_Y_MM = 0.4;

const vertexShader = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Holes sit on multiples of the pitch, where parts snap, so a snapped part
// stands on a hole and a beam between snapped parts runs along a row. Edges
// are anti-aliased with fwidth; once a pitch shrinks to a few pixels the holes
// and rows give way to the plate, so a far zoom shows no moiré.
const fragmentShader = /* glsl */ `
  uniform vec3 uPlate;
  uniform float uPlateOpacity;
  uniform vec3 uHole;
  uniform vec3 uRim;
  uniform vec3 uRow;
  uniform float uPitch;
  uniform float uRadius;
  uniform float uRimWidth;
  uniform float uFade;
  uniform vec2 uCentre;
  varying vec2 vWorld;

  void main() {
    vec2 local = (fract(vWorld / uPitch + 0.5) - 0.5) * uPitch; // mm from the nearest hole
    float d = length(local);
    float px = fwidth(d);
    vec2 pxPerMm = max(fwidth(vWorld), vec2(1e-4));

    float hole = 1.0 - smoothstep(uRadius - px, uRadius + px, d);
    float rim = (1.0 - smoothstep(uRadius + uRimWidth - px, uRadius + uRimWidth + px, d)) * (1.0 - hole);
    vec2 rowPx = abs(local) / pxPerMm;
    float row = 1.0 - min(min(rowPx.x, rowPx.y), 1.0);

    float detail = smoothstep(4.0, 12.0, uPitch / max(pxPerMm.x, pxPerMm.y));
    float near = 1.0 - smoothstep(uFade * 0.4, uFade, length(vWorld - uCentre));

    vec3 colour = mix(uPlate, uRow, row * 0.9 * detail);
    colour = mix(colour, uRim, rim * 0.9 * detail);
    colour = mix(colour, uHole, hole * detail);
    float opacity = max(uPlateOpacity, hole * detail);

    gl_FragColor = vec4(colour, opacity * near);
    if (gl_FragColor.a < 0.003) discard;
  }
`;

/**
 * The optical table's hole pattern: a steel plate with M6 holes on the 25 mm
 * grid, a countersink round each and faint rows through them to line a beam
 * up on. It follows the view and fades out away from it, so it has no edge.
 */
export default function HoleGrid({ palette }: { palette: ScenePalette }) {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uPlate: { value: new Color() },
          uPlateOpacity: { value: 1 },
          uHole: { value: new Color() },
          uRim: { value: new Color() },
          uRow: { value: new Color() },
          uPitch: { value: GRID_SIZE_MM },
          uRadius: { value: HOLE_RADIUS_MM },
          uRimWidth: { value: RIM_MM },
          uFade: { value: FADE_MM },
          uCentre: { value: new Vector2() },
        },
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const { plate, plateOpacity, hole, rim, row } = palette.holeGrid;
  useEffect(() => {
    const uniforms = (mesh.current?.material as ShaderMaterial | undefined)?.uniforms;
    if (!uniforms) return;
    uniforms.uPlate.value.set(plate);
    uniforms.uPlateOpacity.value = plateOpacity;
    uniforms.uHole.value.set(hole);
    uniforms.uRim.value.set(rim);
    uniforms.uRow.value.set(row);
  }, [plate, plateOpacity, hole, rim, row]);

  useFrame(({ camera, controls }) => {
    const plane = mesh.current;
    if (!plane) return;
    const target = (controls as { target?: { x: number; z: number } } | null)?.target ?? camera.position;
    (plane.material as ShaderMaterial).uniforms.uCentre.value.set(target.x, target.z);
    // follow the view a whole pitch at a time, so the pattern never slides
    plane.position.set(
      Math.round(target.x / GRID_SIZE_MM) * GRID_SIZE_MM,
      GRID_Y_MM,
      Math.round(target.z / GRID_SIZE_MM) * GRID_SIZE_MM,
    );
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[SPAN_MM, SPAN_MM]} />
    </mesh>
  );
}
