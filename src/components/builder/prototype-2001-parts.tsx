"use client";

// PROTOTYPE, throwaway: space-age touches on the 2001 theme's parts, switched
// by flags in html[data-proto2001] (see
// src/app/builder/tabletop/prototype-2001-switch.tsx):
//   eye    a HAL eye in every detector's opening
//   bands  a coloured accent band round each instrument box, like the
//          colour-coded panels of the film's spacecraft
// The acrylic slide labels and long text are CSS only.

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AdditiveBlending, BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, SRGBColorSpace } from "three";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-proto2001", "data-look", "data-theme"] });
  return () => observer.disconnect();
}

/** whether a prototype flag is on; only ever under the 2001 theme */
export function useProto2001(flag: "eye" | "bands" | "trace" | "tracewhite"): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      const root = document.documentElement;
      return root.dataset.look === "2001" && (root.dataset.proto2001 ?? "").split(" ").includes(flag);
    },
    () => false,
  );
}

let eyeTexture: CanvasTexture | null = null;

/** the lens: a pinpoint of yellow-white in a red iris, falling to black glass */
function halEyeTexture(): CanvasTexture {
  if (eyeTexture) return eyeTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const g = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "#fffbe0");
  g.addColorStop(0.05, "#ffd84a");
  g.addColorStop(0.14, "#ff3b0a");
  g.addColorStop(0.36, "#b30000");
  g.addColorStop(0.62, "#2a0000");
  g.addColorStop(0.86, "#050505");
  g.addColorStop(0.92, "#9aa1a8");
  g.addColorStop(0.96, "#e6e9ec");
  g.addColorStop(1, "#5d636a");
  context.fillStyle = g;
  context.fillRect(0, 0, 256, 256);
  eyeTexture = new CanvasTexture(canvas);
  eyeTexture.colorSpace = SRGBColorSpace;
  return eyeTexture;
}

/** a HAL eye facing -x, the way light comes in, centred on `x` */
export function HalEye({ x, radius }: { x: number; radius: number }) {
  return (
    <mesh position={[x, 0, 0]} rotation={[0, -Math.PI / 2, 0]} raycast={() => null}>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial map={halEyeTexture()} toneMapped={false} />
    </mesh>
  );
}

export const BAND = {
  source: "#e2531f",
  analyser: "#2b63b0",
  instrument: "#e0a21b",
} as const;

/**
 * A band of colour that runs round a box in a zigzag: up across one face, down
 * across the next, so it meets itself at every corner and closes. A hair proud
 * of the sides. Size and centre are the box's own; `fromTop` is mm from the
 * top face to the band's highest point.
 */
export function AccentBand({
  size,
  centre,
  color,
  fromTop = 5,
  height = 3.5,
}: {
  size: [number, number, number];
  centre: [number, number, number];
  color: string;
  fromTop?: number;
  height?: number;
}) {
  const [dx, dy, dz] = size;
  const geometry = useMemo(() => {
    const x = dx / 2 + 0.15;
    const z = dz / 2 + 0.15;
    const rise = Math.min(dy * 0.3, 10);
    const high = dy / 2 - fromTop - height / 2;
    const low = high - rise;
    // corners walked round the box; the band climbs and falls on alternate faces
    const corners: [number, number, number][] = [
      [-x, low, z], [x, high, z], [x, low, -z], [-x, high, -z], [-x, low, z],
    ];
    const positions: number[] = [];
    const index: number[] = [];
    for (let i = 0; i < 4; i++) {
      const [ax, ay, az] = corners[i];
      const [bx, by, bz] = corners[i + 1];
      const base = positions.length / 3;
      positions.push(ax, ay - height / 2, az, bx, by - height / 2, bz, bx, by + height / 2, bz, ax, ay + height / 2, az);
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.setIndex(index);
    result.computeVertexNormals();
    return result;
  }, [dx, dy, dz, fromTop, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={centre} raycast={() => null}>
      <meshStandardMaterial color={color} roughness={0.35} side={DoubleSide} />
    </mesh>
  );
}

/** the CRT trace colour asked for (flag `trace` yellow, `tracewhite` phosphor), or null */
export function useProto2001Trace(): string | null {
  const yellow = useProto2001("trace");
  const white = useProto2001("tracewhite");
  const day = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme !== "dark", () => true);
  // a phosphor colour vanishes on the day sweep: by day the same hue, darkened
  if (yellow) return day ? "#c08600" : "#ffd23f";
  if (white) return day ? "#1a1f24" : "#e8f1f5";
  return null;
}

/**
 * A ring drawn like a vector-display trace: a thin bright core and, round it,
 * a faint wider bloom added to what is behind, as phosphor glows.
 */
export function TraceRing({
  radius,
  color,
  core,
  glow,
  opacity = 0.95,
}: {
  radius: number;
  color: string;
  core: number;
  glow: number;
  opacity?: number;
}) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]}>
      <mesh raycast={() => null}>
        <ringGeometry args={[radius, radius + core, 72]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
      </mesh>
      {glow > 0 ? (
        <mesh raycast={() => null}>
          <ringGeometry args={[radius - 1.6, radius + core + 1.6, 72]} />
          <meshBasicMaterial color={color} transparent opacity={glow} depthWrite={false} toneMapped={false} blending={AdditiveBlending} />
        </mesh>
      ) : null}
    </group>
  );
}
