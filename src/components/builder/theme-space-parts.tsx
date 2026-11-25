"use client";

// The Space theme's touches on the parts (issue #421): mostly colour and
// light. The laser is the exception: a round head with a HAL eye for an output.

import { AdditiveBlending, CanvasTexture, Color, SRGBColorSpace } from "three";

const EYE_TEXTURE_PX = 256;
/** HAL's own red; an eye given no iris colour keeps it */
const HAL_RED = "#ff3b0a";
const eyeTextures = new Map<string, CanvasTexture>();

function shade(hex: string, lightness: number): string {
  const color = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  return `#${color.setHSL(hsl.h, Math.min(1, hsl.s * 1.1), lightness).getHexString()}`;
}

/**
 * HAL's lens: a pale pinpoint in a bright iris, falling to black glass, in a
 * thin steel bezel. The iris takes `iris`, so a laser's eye glows its beam's colour.
 */
function halEyeTexture(iris: string): CanvasTexture {
  const cached = eyeTextures.get(iris);
  if (cached) return cached;
  const red = iris === HAL_RED;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = EYE_TEXTURE_PX;
  const context = canvas.getContext("2d")!;
  const half = EYE_TEXTURE_PX / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "#fffbe0");
  gradient.addColorStop(0.05, red ? "#ffd84a" : shade(iris, 0.8));
  gradient.addColorStop(0.14, iris);
  gradient.addColorStop(0.36, red ? "#b30000" : shade(iris, 0.32));
  gradient.addColorStop(0.62, red ? "#2a0000" : shade(iris, 0.08));
  gradient.addColorStop(0.86, "#050505");
  gradient.addColorStop(0.92, "#9aa1a8");
  gradient.addColorStop(0.96, "#e6e9ec");
  gradient.addColorStop(1, "#5d636a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, EYE_TEXTURE_PX, EYE_TEXTURE_PX);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  eyeTextures.set(iris, texture);
  return texture;
}

/**
 * A HAL eye looking along `facing` x: -x in a detector's opening, where the
 * light comes from; +x on a laser, where it leaves.
 * Unlit and not tone mapped, so it glows the same in day and night.
 */
export function HalEye({
  xMm,
  yMm = 0,
  radiusMm,
  facing = -1,
  iris = HAL_RED,
}: {
  xMm: number;
  yMm?: number;
  radiusMm: number;
  facing?: 1 | -1;
  iris?: string;
}) {
  return (
    <mesh position={[xMm, yMm, 0]} rotation={[0, (facing * Math.PI) / 2, 0]} raycast={() => null}>
      <circleGeometry args={[radiusMm, 48]} />
      <meshBasicMaterial map={halEyeTexture(iris)} toneMapped={false} />
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
