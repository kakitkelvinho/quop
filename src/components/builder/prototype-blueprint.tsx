"use client";

// PROTOTYPE, throwaway: the Blueprint look on the Tabletop, picked by
// ?variant= (see src/app/builder/tabletop/prototype-blueprint-switch.tsx).
// Every lit material becomes a flat unlit fill with ink edges and an
// inverted-hull silhouette; lights, environment, shadows and AO are skipped
// in builder-canvas.tsx. Edges are built once per mesh, so a still view costs
// nothing and an orbit costs one cheap pass.

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  BackSide,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  OrthographicCamera,
} from "three";

export type BlueprintStyle = {
  paper: string;
  fill: string;
  ink: string;
  /** glass and other see-through parts: outline only */
  glassOpacity: number;
  /** px */
  hullPx: number;
  /** hand-drawn: each edge drawn twice, jittered and overshot */
  wobble: boolean;
};

export const BLUEPRINT_STYLES: Record<string, BlueprintStyle> = {
  // night: a deep cyanotype blue
  B: { paper: "#0a1f3d", fill: "#0d2648", ink: "#dce8f8", glassOpacity: 0, hullPx: 1.2, wobble: false },
  // day: a CAD assembly drawing, black hairlines on white for precision
  C: { paper: "#ffffff", fill: "#ffffff", ink: "#111111", glassOpacity: 0, hullPx: 0.9, wobble: false },
};

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-proto-blueprint"] });
  return () => observer.disconnect();
}

/** the blueprint style the prototype switch asks for, or null for the lit scene */
export function useProtoBlueprint(): BlueprintStyle | null {
  const key = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.protoBlueprint ?? "",
    () => "",
  );
  return BLUEPRINT_STYLES[key] ?? null;
}

type Saved = { material: Material; extras: Object3D[] };

function wobbleEdges(edges: BufferGeometry, seed: number): BufferGeometry {
  const src = edges.getAttribute("position");
  const out: number[] = [];
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < src.count; i += 2) {
    const a = [src.getX(i), src.getY(i), src.getZ(i)];
    const b = [src.getX(i + 1), src.getY(i + 1), src.getZ(i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const j = Math.min(0.6, len * 0.02);
    for (let pass = 0; pass < 2; pass++) {
      const over = 0.04 * (1 + rand() * 0.5);
      for (const [p, q] of [[a, b], [b, a]]) {
        for (let k = 0; k < 3; k++) out.push(p[k] + (p[k] - q[k]) * over + rand() * j);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(out, 3));
  return geometry;
}

export function BlueprintPass({ style }: { style: BlueprintStyle }) {
  const saved = useRef(new Map<Mesh, Saved>());
  // beams (drei Line, a LineMaterial): no colour on the drawing, just ink
  const inked = useRef(new Map<Material, { color: Color; vertexColors: boolean; linewidth: number; dashed: boolean; dashSize: number; gapSize: number }>());
  const hullOffset = useMemo(() => ({ value: 1 }), []);
  const mats = useMemo(() => {
    const fill = new MeshBasicMaterial({ color: style.fill, toneMapped: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const glass = new MeshBasicMaterial({ color: style.fill, toneMapped: false, transparent: true, opacity: style.glassOpacity, depthWrite: false });
    const line = new LineBasicMaterial({ color: style.ink, toneMapped: false });
    const hull = new MeshBasicMaterial({ color: style.ink, toneMapped: false, side: BackSide });
    hull.onBeforeCompile = (shader) => {
      shader.uniforms.uHull = hullOffset;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uHull;")
        .replace("#include <begin_vertex>", "vec3 transformed = position + normalize(normal) * uHull;");
    };
    return { fill, glass, line, hull };
  }, [style, hullOffset]);

  useEffect(() => {
    const map = saved.current;
    return () => {
      for (const [mesh, s] of map) {
        mesh.material = s.material;
        for (const extra of s.extras) mesh.remove(extra);
      }
      map.clear();
      for (const [material, was] of inked.current) {
        const m = material as Material & { color: Color; vertexColors: boolean; linewidth: number; dashed: boolean; dashSize: number; gapSize: number };
        m.color.copy(was.color);
        m.vertexColors = was.vertexColors;
        m.linewidth = was.linewidth;
        m.dashed = was.dashed;
        m.dashSize = was.dashSize;
        m.gapSize = was.gapSize;
        m.needsUpdate = true;
      }
      inked.current.clear();
      for (const m of Object.values(mats)) m.dispose();
    };
  }, [mats]);

  useFrame(({ scene, camera }) => {
    if (camera instanceof OrthographicCamera) hullOffset.value = style.hullPx / camera.zoom;
    const map = saved.current;
    for (const [mesh] of map) if (!mesh.parent) map.delete(mesh);
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || map.has(object) || object.userData.blueprintExtra) return;
      const material = object.material as Material & { isMeshStandardMaterial?: boolean; isLineMaterial?: boolean; transparent?: boolean; opacity?: number; color?: Color; vertexColors?: boolean; linewidth?: number; dashed?: boolean; dashSize?: number; gapSize?: number };
      if (Array.isArray(material)) return;
      if (material.isLineMaterial && material.color && !inked.current.has(material)) {
        inked.current.set(material, {
          color: material.color.clone(), vertexColors: !!material.vertexColors, linewidth: material.linewidth ?? 1,
          dashed: !!material.dashed, dashSize: material.dashSize ?? 1, gapSize: material.gapSize ?? 1,
        });
        // light is drawn as a thin dashed line, so it never reads as a part
        material.color.set(style.ink);
        material.vertexColors = false;
        material.linewidth = 1;
        material.dashed = true;
        material.dashSize = 6;
        material.gapSize = 4;
        (object as Mesh & { computeLineDistances?: () => void }).computeLineDistances?.();
        material.needsUpdate = true;
        return;
      }
      if (!material.isMeshStandardMaterial) return;
      const see = material.transparent && (material.opacity ?? 1) < 0.95;
      const extras: Object3D[] = [];
      const edges = new EdgesGeometry(object.geometry, 28);
      const lines = new LineSegments(style.wobble ? wobbleEdges(edges, object.id + 7) : edges, mats.line);
      lines.userData.blueprintExtra = true;
      lines.raycast = () => {};
      extras.push(lines);
      if (!see) {
        const hull = new Mesh(object.geometry, mats.hull);
        hull.userData.blueprintExtra = true;
        hull.raycast = () => {};
        extras.push(hull);
      }
      for (const extra of extras) object.add(extra);
      map.set(object, { material, extras });
      object.material = see ? mats.glass : mats.fill;
      object.castShadow = false;
    });
  });

  return <color attach="background" args={[new Color(style.paper)]} />;
}
