"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  Vector3,
} from "three";

import { BLUEPRINT_NEON } from "@/components/builder/scene-theme";

export const BLUEPRINT_STYLES = {
  light: { paper: "#ffffff", fill: "#ffffff", ink: "#111111", hullPx: 0.9 },
  // black of space with a neon outline; the canvas adds a glow (builder-canvas.tsx, Bloom)
  dark: { paper: "#000000", fill: "#000000", ink: BLUEPRINT_NEON, hullPx: 1.2 },
} as const;

export type BlueprintStyle = (typeof BLUEPRINT_STYLES)[keyof typeof BLUEPRINT_STYLES];

/** what drei's RoundedBox makes: an extruded square with a fine, many-step bevel */
const ROUNDED_BOX_MIN_BEVEL_SEGMENTS = 8;

/**
 * The lines a part's shape is drawn with. A crease sharper than 28° is an
 * edge. A rounded box has none: its corners turn in steps too small to count,
 * so only its outline would show. It is drawn as the box it rounds instead,
 * each edge along the middle of its round, where it lies on the surface.
 */
function featureEdges(geometry: BufferGeometry): EdgesGeometry {
  const options = geometry instanceof ExtrudeGeometry ? geometry.parameters.options : null;
  if (options?.bevelEnabled && (options.bevelSegments ?? 0) >= ROUNDED_BOX_MIN_BEVEL_SEGMENTS) {
    const radius = options.bevelThickness ?? 0;
    const inset = 2 * radius * (1 - Math.SQRT1_2);
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const sharp = new BoxGeometry(size.x - inset, size.y - inset, size.z - inset).translate(centre.x, centre.y, centre.z);
    const edges = new EdgesGeometry(sharp);
    sharp.dispose();
    return edges;
  }
  return new EdgesGeometry(geometry, 28);
}

type SavedMesh = {
  geometry: BufferGeometry;
  material: Material;
  castShadow: boolean;
  replacement: MeshBasicMaterial;
  extras: Object3D[];
};

export function BlueprintPass({ style }: { style: BlueprintStyle }) {
  const saved = useRef(new Map<Mesh, SavedMesh>());
  const invalidate = useThree((state) => state.invalidate);
  const hullOffset = useRef({ value: 1 });
  const materials = useMemo(() => {
    const fill = new MeshBasicMaterial({ color: style.fill, toneMapped: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const glass = new MeshBasicMaterial({ color: style.fill, toneMapped: false, transparent: true, opacity: 0, depthWrite: false });
    const line = new LineBasicMaterial({ color: style.ink, toneMapped: false });
    const hull = new MeshBasicMaterial({ color: style.ink, toneMapped: false, side: BackSide });
    hull.onBeforeCompile = (shader) => {
      shader.uniforms.uHull = hullOffset.current;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uHull;")
        .replace("#include <begin_vertex>", "vec3 transformed = position + normalize(normal) * uHull;");
    };
    return { fill, glass, line, hull };
  }, [style]);
  const edges = useRef(new Map<BufferGeometry, EdgesGeometry>());

  useEffect(() => {
    const map = saved.current;
    const cache = edges.current;
    return () => {
      for (const [mesh, original] of map) {
        mesh.material = original.material;
        mesh.castShadow = original.castShadow;
        for (const extra of original.extras) mesh.remove(extra);
      }
      map.clear();
      for (const geometry of cache.values()) geometry.dispose();
      cache.clear();
      for (const material of Object.values(materials)) material.dispose();
      invalidate();
    };
  }, [invalidate, materials]);

  useFrame(({ scene, camera }) => {
    if (camera instanceof OrthographicCamera) hullOffset.current.value = style.hullPx / camera.zoom;
    const map = saved.current;
    for (const [mesh] of map) if (!mesh.parent) map.delete(mesh);
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || object.userData.blueprintExtra) return;
      let previous = map.get(object);
      if (previous && (object.geometry !== previous.geometry ||
        object.material !== previous.replacement && !(object.material instanceof MeshStandardMaterial))) {
        for (const extra of previous.extras) object.remove(extra);
        if (object.material === previous.replacement) object.material = previous.material;
        object.castShadow = previous.castShadow;
        map.delete(object);
        previous = undefined;
      }
      if (previous) {
        if (object.material !== previous.replacement) {
          if (object.material instanceof MeshStandardMaterial) {
            previous.material = object.material;
            object.material = previous.replacement;
          }
        }
        return;
      }
      if (!(object.material instanceof MeshStandardMaterial)) return;
      const material = object.material;
      const seeThrough = material.transparent && material.opacity < 0.95;
      let geometry = edges.current.get(object.geometry);
      if (!geometry) {
        geometry = featureEdges(object.geometry);
        edges.current.set(object.geometry, geometry);
      }
      const lines = new LineSegments(geometry, materials.line);
      lines.userData.blueprintExtra = true;
      lines.raycast = () => {};
      const extras: Object3D[] = [lines];
      if (!seeThrough) {
        const hull = new Mesh(object.geometry, materials.hull);
        hull.userData.blueprintExtra = true;
        hull.raycast = () => {};
        extras.push(hull);
      }
      for (const extra of extras) object.add(extra);
      const replacement = seeThrough ? materials.glass : materials.fill;
      map.set(object, { geometry: object.geometry, material, castShadow: object.castShadow, replacement, extras });
      object.material = replacement;
      object.castShadow = false;
    });
  });

  return null;
}
