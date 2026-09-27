"use client";

// PROTOTYPE — throwaway. Four looks for the photodiode, AOM and EOM, switched
// with ?variant= on /experiment/builder (see prototype-switcher.tsx). Once a
// look wins it is rewritten properly into component-models.tsx and this file
// goes to the prototype branch, not main.
//
//   A  Schematic — the lab-diagram convention: PD as a disc and a dome with a
//      fiber off its tip, AOM/EOM as bare crystals with transducer/electrodes.
//   B  Housed    — real hardware: Thorlabs PDA box, G&H-style AOM housing,
//      cylindrical EOM housing.
//   C  Compact   — PD in an SM1 lens tube; AOM/EOM are just tinted blocks
//      (asks: is the generic block enough, no dedicated models?).
//   D  Current   — the photodiode as it is on main; AOM/EOM as in C.

import { RoundedBox } from "@react-three/drei";
import { CatmullRomCurve3, Vector3 } from "three";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  Anodised,
  Enamel,
  Glass,
  Hardware,
  Pillar,
  Stainless,
  annulus,
  type ModelProps,
} from "@/components/builder/component-models";

export const PROTOTYPE_VARIANTS = [
  { key: "A", name: "Schematic" },
  { key: "B", name: "Housed hardware" },
  { key: "C", name: "Compact" },
  { key: "D", name: "Current PD" },
] as const;

export type PrototypeVariantKey = (typeof PROTOTYPE_VARIANTS)[number]["key"];

export const PrototypeVariant = createContext<PrototypeVariantKey>("A");

const SENSOR_GREEN = "#7be08a";
const SENSOR_SILICON = "#3b4a7a";
const PD_DOME_RED = "#b3261e";
const FIBER_JACKET = "#f2c200";
const GOLD = "#d4a93c";
const CRYSTAL_CLEAR = "#dff3f5";
const CRYSTAL_AMBER = "#f3d9a0";
const AOM_TINT = "#2f7f86";
const EOM_TINT = "#b9822d";

/** An SMA/BNC stub: a stainless body with a gold pin, pointing up from `at`. */
function Connector({ palette, at, bnc = false }: ModelProps & { at: [number, number, number]; bnc?: boolean }) {
  const r = bnc ? 4.5 : 3;
  const h = bnc ? 10 : 7;
  return (
    <group position={at}>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[r, r, h, 18]} />
        <Stainless palette={palette} />
      </mesh>
      {bnc ? (
        <mesh position={[0, h * 0.35, 0]}>
          <torusGeometry args={[r + 0.6, 0.7, 8, 18]} />
          <Stainless palette={palette} />
        </mesh>
      ) : null}
      <mesh position={[0, h + 0.6, 0]}>
        <cylinderGeometry args={[r * 0.35, r * 0.35, 1.2, 10]} />
        <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.9} />
      </mesh>
    </group>
  );
}

/** A cable or fiber from `start`, out along +x and curling down to the table. */
function cableCurve(start: [number, number, number]) {
  const [x, y, z] = start;
  return new CatmullRomCurve3([
    new Vector3(x, y, z),
    new Vector3(x + 14, y - 2, z),
    new Vector3(x + 26, y * 0.7, z + 6),
    new Vector3(x + 32, y * 0.33, z + 14),
    new Vector3(x + 40, 4, z + 26),
    new Vector3(x + 58, 1.8, z + 40),
  ]);
}

function Cable({ x, y, color, radius = 1.6 }: { x: number; y: number; color: string; radius?: number }) {
  const curve = useMemo(() => cableCurve([x, y, 0]), [x, y]);
  return (
    <mesh>
      <tubeGeometry args={[curve, 48, radius, 10]} />
      <Enamel color={color} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Photodiode
// ---------------------------------------------------------------------------

/** A: the diagram symbol — a flat sensor disc facing the beam, a dome behind, a fiber off the tip. */
function PdSchematic({ palette, color, axis }: ModelProps) {
  const dome = color ?? PD_DOME_RED;
  const R = 13;
  return (
    <group>
      <Pillar palette={palette} top={axis - R} />
      {/* the sensor disc the beam lands on */}
      <mesh position={[-1, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[R, R, 2, 40]} />
        <Enamel color={palette.body} />
      </mesh>
      <mesh position={[-2.05, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[R * 0.6, R * 0.6, 0.2, 32]} />
        <meshStandardMaterial color={SENSOR_GREEN} emissive={SENSOR_GREEN} emissiveIntensity={0.4} roughness={0.3} />
      </mesh>
      {/* the dome, bulging away from the beam (+x) */}
      <mesh position={[0, axis, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry args={[R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Enamel color={dome} />
      </mesh>
      <mesh position={[R + 2, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[2.4, 2.4, 5, 14]} />
        <Hardware palette={palette} />
      </mesh>
      <Cable x={R + 4} y={axis} color={FIBER_JACKET} />
    </group>
  );
}

/** B: a Thorlabs PDA-series amplified detector — black box, SM1 bore on the axis, BNC on top. */
function PdHoused({ palette, axis }: ModelProps) {
  const w = 44;
  const h = 52;
  const d = 20;
  const bore = useMemo(() => annulus(12.5, 6, 3), []);
  return (
    <group>
      <Pillar palette={palette} top={axis - h / 2 + 6} />
      <RoundedBox args={[d, h, w]} radius={3} smoothness={4} position={[d / 2 - 2, axis + 6, 0]}>
        <meshStandardMaterial color={palette.anodise} roughness={0.55} metalness={0.3} />
      </RoundedBox>
      {/* SM1-threaded front bore, the sensor set back in it */}
      <mesh geometry={bore} position={[-2, axis, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <meshStandardMaterial color="#0e1116" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[-2.2, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[5.5, 5.5, 0.4, 28]} />
        <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.9} />
      </mesh>
      <mesh position={[-2.5, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[3.2, 3.2, 0.4, 24]} />
        <meshStandardMaterial color={SENSOR_SILICON} roughness={0.15} metalness={0.4} />
      </mesh>
      {/* the white panel line and model text band */}
      <mesh position={[-2.05, axis + 22, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[30, 3]} />
        <meshBasicMaterial color="#d8dde4" />
      </mesh>
      <Connector palette={palette} axis={axis} bnc at={[d / 2 - 2, axis + 6 + h / 2, -8]} />
      <Connector palette={palette} axis={axis} at={[d / 2 - 2, axis + 6 + h / 2, 8]} />
    </group>
  );
}

/** C: a bare photodiode at the back of an SM1 lens tube, held in a ring on the post, cable out the back. */
function PdLensTube({ palette, axis }: ModelProps) {
  const ring = useMemo(() => annulus(20, 17.6, 8), []);
  return (
    <group>
      <Pillar palette={palette} top={axis - 20} />
      <mesh geometry={ring} position={[4, axis, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <Anodised color={palette.anodise} />
      </mesh>
      <mesh position={[0, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[17.5, 17.5, 36, 40, 1, true]} />
        <meshStandardMaterial color="#12161d" roughness={0.5} metalness={0.3} side={2} />
      </mesh>
      {/* back cap with the TO-can sensor on its inside face */}
      <mesh position={[18, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[17.5, 17.5, 3, 40]} />
        <meshStandardMaterial color="#12161d" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[15.5, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[4.5, 4.5, 2, 20]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[14.3, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[2.4, 2.4, 0.4, 20]} />
        <meshStandardMaterial color={SENSOR_GREEN} emissive={SENSOR_GREEN} emissiveIntensity={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[23, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[4, 4, 8, 16]} />
        <Stainless palette={palette} />
      </mesh>
      <Cable x={27} y={axis} color="#1b1f26" radius={2} />
    </group>
  );
}

export function PrototypePhotodiode(props: ModelProps & { fallback: ReactNode }) {
  const variant = useContext(PrototypeVariant);
  if (variant === "A") return <PdSchematic {...props} />;
  if (variant === "B") return <PdHoused {...props} />;
  if (variant === "C") return <PdLensTube {...props} />;
  return <>{props.fallback}</>;
}

// ---------------------------------------------------------------------------
// AOM
// ---------------------------------------------------------------------------

/** A tinted block with a dark aperture on each beam face and a stub on top — the C/D look. */
function TaggedBlock({
  palette,
  axis,
  tint,
  size,
}: ModelProps & { tint: string; size: [number, number, number] }) {
  const [dx, dy, dz] = size;
  return (
    <group>
      <Pillar palette={palette} top={axis - dy / 2} />
      <RoundedBox args={size} radius={1.2} smoothness={3} position={[0, axis, 0]}>
        <Enamel color={tint} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * dx) / 2 + side * 0.05, axis, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
          <circleGeometry args={[Math.min(4, dy / 3, dz / 3), 24]} />
          <meshStandardMaterial color="#12161d" roughness={0.4} />
        </mesh>
      ))}
      <Connector palette={palette} axis={axis} at={[0, axis + dy / 2, 0]} />
    </group>
  );
}

/**
 * A: the bare crystal, beam along x, a piezo transducer bonded on top that
 * launches the sound wave down through it; the wavefronts are drawn as faint
 * sheets so the grating the beam diffracts off can be seen.
 */
function AomSchematic({ palette, axis }: ModelProps) {
  const L = 30;
  const H = 14;
  const W = 12;
  return (
    <group>
      <Pillar palette={palette} top={axis - H / 2 - 4} />
      <RoundedBox args={[L + 10, 4, W + 12]} radius={0.8} smoothness={2} position={[0, axis - H / 2 - 2, 0]}>
        <Anodised color={palette.anodise} />
      </RoundedBox>
      <mesh position={[0, axis, 0]}>
        <boxGeometry args={[L, H, W]} />
        <Glass tint={CRYSTAL_CLEAR} thickness={W} />
      </mesh>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh key={index} position={[0, axis - H / 2 + ((index + 1) * H) / 6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[L - 2, W - 2]} />
          <meshBasicMaterial color={AOM_TINT} transparent opacity={0.22} depthWrite={false} side={2} />
        </mesh>
      ))}
      {/* transducer: gold electrode and the black piezo slab */}
      <mesh position={[0, axis + H / 2 + 0.3, 0]}>
        <boxGeometry args={[L * 0.6, 0.6, W]} />
        <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, axis + H / 2 + 2, 0]}>
        <boxGeometry args={[L * 0.6, 3, W]} />
        <Enamel color="#1b1f26" />
      </mesh>
      <Connector palette={palette} axis={axis} at={[0, axis + H / 2 + 3.5, 0]} />
    </group>
  );
}

/** B: an AOM in its housing (G&H / AA Opto style) — a milled block with apertures, RF SMA off the side, on a tilt plate. */
function AomHoused({ palette, axis }: ModelProps) {
  const L = 44;
  const H = 26;
  const W = 30;
  return (
    <group>
      <Pillar palette={palette} top={axis - H / 2 - 5} />
      <RoundedBox args={[L + 8, 5, W + 6]} radius={0.8} smoothness={2} position={[0, axis - H / 2 - 2.5, 0]}>
        <Anodised color={palette.anodise} />
      </RoundedBox>
      <RoundedBox args={[L, H, W]} radius={1.5} smoothness={3} position={[0, axis, 0]}>
        <meshStandardMaterial color="#c3c9d1" roughness={0.35} metalness={0.8} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * L) / 2 + side * 0.05, axis, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
          <circleGeometry args={[3, 20]} />
          <meshStandardMaterial color="#0e1116" roughness={0.4} />
        </mesh>
      ))}
      <group position={[0, axis, W / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <Connector palette={palette} axis={axis} at={[0, 0, 0]} />
      </group>
      {/* the heat-sink fins on top */}
      {[-12, -6, 0, 6, 12].map((x) => (
        <mesh key={x} position={[x, axis + H / 2 + 2, 0]}>
          <boxGeometry args={[1.5, 4, W - 4]} />
          <Hardware palette={palette} />
        </mesh>
      ))}
    </group>
  );
}

export function PrototypeAom(props: ModelProps) {
  const variant = useContext(PrototypeVariant);
  if (variant === "A") return <AomSchematic {...props} />;
  if (variant === "B") return <AomHoused {...props} />;
  return <TaggedBlock {...props} tint={props.color ?? AOM_TINT} size={[36, 22, 26]} />;
}

// ---------------------------------------------------------------------------
// EOM
// ---------------------------------------------------------------------------

/** A: a long crystal bar along the beam, gold electrodes on top and bottom, wire to an SMA. */
function EomSchematic({ palette, axis }: ModelProps) {
  const L = 44;
  const S = 9;
  return (
    <group>
      <Pillar palette={palette} top={axis - S / 2 - 5} />
      <RoundedBox args={[L + 10, 4, S + 14]} radius={0.8} smoothness={2} position={[0, axis - S / 2 - 3, 0]}>
        <Anodised color={palette.anodise} />
      </RoundedBox>
      <mesh position={[0, axis, 0]}>
        <boxGeometry args={[L, S, S]} />
        <Glass tint={CRYSTAL_AMBER} dense thickness={S} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, axis + side * (S / 2 + 0.4), 0]}>
          <boxGeometry args={[L - 4, 0.8, S]} />
          <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, axis + S / 2 + 3, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 5, 8]} />
        <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.9} />
      </mesh>
      <Connector palette={palette} axis={axis} at={[0, axis + S / 2 + 5.5, 0]} />
    </group>
  );
}

/** B: a Thorlabs/Qubig-style EOM — a cylindrical housing with aperture caps, an SMA on top, clamped on a post. */
function EomHoused({ palette, axis }: ModelProps) {
  const R = 16;
  const L = 70;
  return (
    <group>
      <Pillar palette={palette} top={axis - R - 4} />
      <RoundedBox args={[16, 8, 2 * R + 4]} radius={0.8} smoothness={2} position={[0, axis - R, 0]}>
        <Anodised color={palette.anodise} />
      </RoundedBox>
      <mesh position={[0, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[R, R, L, 48]} />
        <meshStandardMaterial color={palette.anodise} roughness={0.5} metalness={0.35} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (L / 2 + 1.5), axis, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[R - 3, R - 3, 3, 40]} />
            <Stainless palette={palette} />
          </mesh>
          <mesh position={[side * (L / 2 + 3.05), axis, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
            <circleGeometry args={[2.5, 20]} />
            <meshStandardMaterial color="#0e1116" roughness={0.4} />
          </mesh>
        </group>
      ))}
      <Connector palette={palette} axis={axis} at={[10, axis + R - 1, 0]} />
    </group>
  );
}

export function PrototypeEom(props: ModelProps) {
  const variant = useContext(PrototypeVariant);
  if (variant === "A") return <EomSchematic {...props} />;
  if (variant === "B") return <EomHoused {...props} />;
  return <TaggedBlock {...props} tint={props.color ?? EOM_TINT} size={[50, 20, 20]} />;
}
