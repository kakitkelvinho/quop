"use client";

// The 2001 theme's touches on the parts (issue #421): colour and light only,
// never a change of a part's shape.

import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from "three";

const EYE_TEXTURE_PX = 256;
let eyeTexture: CanvasTexture | null = null;

/** HAL's lens: a yellow-white pinpoint in a red iris, falling to black glass, in a thin steel bezel */
function halEyeTexture(): CanvasTexture {
  if (eyeTexture) return eyeTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = EYE_TEXTURE_PX;
  const context = canvas.getContext("2d")!;
  const half = EYE_TEXTURE_PX / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "#fffbe0");
  gradient.addColorStop(0.05, "#ffd84a");
  gradient.addColorStop(0.14, "#ff3b0a");
  gradient.addColorStop(0.36, "#b30000");
  gradient.addColorStop(0.62, "#2a0000");
  gradient.addColorStop(0.86, "#050505");
  gradient.addColorStop(0.92, "#9aa1a8");
  gradient.addColorStop(0.96, "#e6e9ec");
  gradient.addColorStop(1, "#5d636a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, EYE_TEXTURE_PX, EYE_TEXTURE_PX);
  eyeTexture = new CanvasTexture(canvas);
  eyeTexture.colorSpace = SRGBColorSpace;
  return eyeTexture;
}

/**
 * A HAL eye in a detector's opening, facing -x, where the light comes from.
 * Unlit and not tone mapped, so it glows the same in day and night.
 */
export function HalEye({ xMm, radiusMm }: { xMm: number; radiusMm: number }) {
  return (
    <mesh position={[xMm, 0, 0]} rotation={[0, -Math.PI / 2, 0]} raycast={() => null}>
      <circleGeometry args={[radiusMm, 48]} />
      <meshBasicMaterial map={halEyeTexture()} toneMapped={false} />
    </mesh>
  );
}

/** how far the selection bloom spreads either side of the core */
const BLOOM_SPREAD_MM = 1.6;
const BLOOM_OPACITY = 0.22;

/**
 * A selection or hover ring drawn as a vector-display trace: a thin core and,
 * with `bloom`, a faint wider glow added to what is behind, as phosphor glows.
 */
export function TraceRing({
  radiusMm,
  coreMm,
  color,
  opacity,
  bloom,
  liftMm,
}: {
  radiusMm: number;
  coreMm: number;
  color: string;
  opacity: number;
  bloom: boolean;
  liftMm: number;
}) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, liftMm, 0]}>
      <mesh raycast={() => null}>
        <ringGeometry args={[radiusMm, radiusMm + coreMm, 72]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
      </mesh>
      {bloom ? (
        <mesh raycast={() => null}>
          <ringGeometry args={[radiusMm - BLOOM_SPREAD_MM, radiusMm + coreMm + BLOOM_SPREAD_MM, 72]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={BLOOM_OPACITY}
            depthWrite={false}
            toneMapped={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ) : null}
    </group>
  );
}
