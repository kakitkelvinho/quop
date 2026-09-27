"use client";

// PROTOTYPE — throwaway. Round 2. Round 1 (commit 6aedcd4) picked the
// schematic look: a photodiode as a coloured dome with a fiber off its tip,
// AOM/EOM as bare crystals. That is now fixed here; what ?variant= switches
// on /experiment/builder is the photodiode's face, where the beam lands —
// three ways of setting a small, realistic sensor back into it instead of a
// bright green disc. Once one wins, the dome PD and the AOM/EOM are rewritten
// properly into component-models.tsx and this file stays on the branch.
//
//   A  PDA bore   — a black SM1 bore in the face, gold-ringed silicon at its bottom
//   B  Lens tube  — a short black tube out of the face, a TO-can deep inside
//   C  Cup + chip — a wide shallow cup, a square silicon chip in a gold frame

import { RoundedBox } from "@react-three/drei";
import { CatmullRomCurve3, DoubleSide, Vector3 } from "three";
import { createContext, useContext, useMemo } from "react";

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
  { key: "A", name: "PDA bore" },
  { key: "B", name: "Lens tube" },
  { key: "C", name: "Cup + chip" },
] as const;

export type PrototypeVariantKey = (typeof PROTOTYPE_VARIANTS)[number]["key"];

export const PrototypeVariant = createContext<PrototypeVariantKey>("A");

const SENSOR_SILICON = "#2c3a63";
const PD_DOME_RED = "#b3261e";
const FIBER_JACKET = "#f2c200";
const GOLD = "#d4a93c";
const BORE_BLACK = "#0e1116";
const CRYSTAL_CLEAR = "#dff3f5";
const CRYSTAL_AMBER = "#f3d9a0";
const AOM_TINT = "#2f7f86";

/** An SMA/BNC stub: a stainless body with a gold pin, pointing up from `at`. */
function Connector({ palette, at }: { palette: ModelProps["palette"]; at: [number, number, number] }) {
  return (
    <group position={at}>
      <mesh position={[0, 3.5, 0]}>
        <cylinderGeometry args={[3, 3, 7, 18]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[0, 7.6, 0]}>
        <cylinderGeometry args={[1, 1, 1.2, 10]} />
        <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.9} />
      </mesh>
    </group>
  );
}

/** A fiber from (x, y), out along +x and curling down to the table. */
function cableCurve(x: number, y: number) {
  return new CatmullRomCurve3([
    new Vector3(x, y, 0),
    new Vector3(x + 14, y - 2, 0),
    new Vector3(x + 26, y * 0.7, 6),
    new Vector3(x + 32, y * 0.33, 14),
    new Vector3(x + 40, 4, 26),
    new Vector3(x + 58, 1.8, 40),
  ]);
}

function Cable({ x, y, color }: { x: number; y: number; color: string }) {
  const curve = useMemo(() => cableCurve(x, y), [x, y]);
  return (
    <mesh>
      <tubeGeometry args={[curve, 48, 1.6, 10]} />
      <Enamel color={color} />
    </mesh>
  );
}

/** A flat part facing the beam (-x) at depth `x`. */
const FACE_BEAM = [0, -Math.PI / 2, 0] as const;
/** A cylinder turned to run along x. */
const ALONG_X = [0, 0, Math.PI / 2] as const;

// ---------------------------------------------------------------------------
// Photodiode: the dome is shared, the face is the variant
// ---------------------------------------------------------------------------

const PD_R = 13;
/** how deep the face plate is, mm; the dome starts behind it at x = 0 */
const PD_FACE_DEPTH = 4;

/** A: a black SM1 bore in the face, the sensor at its bottom behind a gold ring. */
function FacePdaBore({ palette }: ModelProps) {
  const plate = useMemo(() => annulus(PD_R, 6.5, PD_FACE_DEPTH), []);
  return (
    <group>
      <mesh geometry={plate} rotation={FACE_BEAM}>
        <Enamel color={palette.body} />
      </mesh>
      {/* the thread lip round the bore, and the bore's black wall */}
      <mesh position={[-PD_FACE_DEPTH - 0.05, 0, 0]} rotation={FACE_BEAM}>
        <ringGeometry args={[6.5, 8.5, 40]} />
        <meshStandardMaterial color={BORE_BLACK} roughness={0.6} />
      </mesh>
      <mesh position={[-PD_FACE_DEPTH / 2, 0, 0]} rotation={ALONG_X}>
        <cylinderGeometry args={[6.4, 6.4, PD_FACE_DEPTH, 40, 1, true]} />
        <meshBasicMaterial color={BORE_BLACK} side={DoubleSide} />
      </mesh>
      <mesh position={[-0.6, 0, 0]} rotation={FACE_BEAM}>
        <circleGeometry args={[6.5, 40]} />
        <meshStandardMaterial color={BORE_BLACK} roughness={0.7} />
      </mesh>
      <mesh position={[-0.7, 0, 0]} rotation={FACE_BEAM}>
        <ringGeometry args={[2.6, 3.8, 32]} />
        <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.9} />
      </mesh>
      <mesh position={[-0.75, 0, 0]} rotation={FACE_BEAM}>
        <circleGeometry args={[2.6, 32]} />
        <meshStandardMaterial color={SENSOR_SILICON} roughness={0.12} metalness={0.5} />
      </mesh>
    </group>
  );
}

/** B: a short black lens tube out of the face, a TO-can photodiode deep inside. */
const TUBE_LENGTH = 11;

function FaceLensTube({ palette }: ModelProps) {
  const lip = useMemo(() => annulus(8.5, 7.2, 1.2), []);
  return (
    <group>
      <mesh position={[-1, 0, 0]} rotation={ALONG_X}>
        <cylinderGeometry args={[PD_R, PD_R, 2, 40]} />
        <Enamel color={palette.body} />
      </mesh>
      <mesh position={[-2 - TUBE_LENGTH / 2, 0, 0]} rotation={ALONG_X}>
        <cylinderGeometry args={[8.5, 8.5, TUBE_LENGTH, 40, 1, true]} />
        <meshBasicMaterial color={BORE_BLACK} side={DoubleSide} />
      </mesh>
      <mesh geometry={lip} position={[-2 - TUBE_LENGTH + 1.2, 0, 0]} rotation={FACE_BEAM}>
        <meshStandardMaterial color={BORE_BLACK} roughness={0.55} metalness={0.3} />
      </mesh>
      <mesh position={[-2.05, 0, 0]} rotation={FACE_BEAM}>
        <circleGeometry args={[8.5, 40]} />
        <meshStandardMaterial color={BORE_BLACK} roughness={0.7} />
      </mesh>
      {/* the TO-can: a steel cap with the sensor behind its window */}
      <mesh position={[-3.2, 0, 0]} rotation={ALONG_X}>
        <cylinderGeometry args={[3.2, 3.2, 2.4, 24]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[-4.45, 0, 0]} rotation={FACE_BEAM}>
        <circleGeometry args={[1.8, 24]} />
        <meshStandardMaterial color={SENSOR_SILICON} roughness={0.12} metalness={0.5} />
      </mesh>
    </group>
  );
}

/** C: a wide, shallow cup in the face, a square silicon chip in a gold frame at its centre. */
function FaceCupChip({ palette }: ModelProps) {
  const plate = useMemo(() => annulus(PD_R, 9.5, PD_FACE_DEPTH), []);
  return (
    <group>
      <mesh geometry={plate} rotation={FACE_BEAM}>
        <Enamel color={palette.body} />
      </mesh>
      <mesh position={[-PD_FACE_DEPTH / 2, 0, 0]} rotation={ALONG_X}>
        <cylinderGeometry args={[9.4, 9.4, PD_FACE_DEPTH, 48, 1, true]} />
        <meshBasicMaterial color="#20252d" side={DoubleSide} />
      </mesh>
      <mesh position={[-1.5, 0, 0]} rotation={FACE_BEAM}>
        <circleGeometry args={[9.5, 48]} />
        <meshStandardMaterial color="#20252d" roughness={0.6} />
      </mesh>
      <mesh position={[-1.75, 0, 0]}>
        <boxGeometry args={[0.5, 6, 6]} />
        <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.9} />
      </mesh>
      <mesh position={[-2.05, 0, 0]}>
        <boxGeometry args={[0.2, 4.4, 4.4]} />
        <meshStandardMaterial color={SENSOR_SILICON} roughness={0.12} metalness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * The lab-diagram photodiode: a face the beam lands on, a coloured dome
 * bulging away from the beam (+x), and a fiber off the dome's tip.
 */
export function PrototypePhotodiode(props: ModelProps) {
  const variant = useContext(PrototypeVariant);
  const { palette, color, axis } = props;
  const dome = color ?? PD_DOME_RED;
  return (
    <group>
      <Pillar palette={palette} top={axis - PD_R} />
      <group position={[0, axis, 0]}>
        {variant === "A" ? <FacePdaBore {...props} /> : null}
        {variant === "B" ? <FaceLensTube {...props} /> : null}
        {variant === "C" ? <FaceCupChip {...props} /> : null}
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <sphereGeometry args={[PD_R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Enamel color={dome} />
        </mesh>
        <mesh position={[PD_R + 2, 0, 0]} rotation={ALONG_X}>
          <cylinderGeometry args={[2.4, 2.4, 5, 14]} />
          <Hardware palette={palette} />
        </mesh>
      </group>
      <Cable x={PD_R + 4} y={axis} color={FIBER_JACKET} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// AOM and EOM — the schematic look, chosen in round 1
// ---------------------------------------------------------------------------

/**
 * The bare crystal, beam along x, a piezo transducer bonded on top that
 * launches the sound wave down through it; the wavefronts are drawn as faint
 * sheets so the grating the beam diffracts off can be seen.
 */
export function PrototypeAom({ palette, axis }: ModelProps) {
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
          <meshBasicMaterial color={AOM_TINT} transparent opacity={0.22} depthWrite={false} side={DoubleSide} />
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
      <Connector palette={palette} at={[0, axis + H / 2 + 3.5, 0]} />
    </group>
  );
}

/** A long crystal bar along the beam, gold electrodes on top and bottom, wire to an SMA. */
export function PrototypeEom({ palette, axis }: ModelProps) {
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
      <Connector palette={palette} at={[0, axis + S / 2 + 5.5, 0]} />
    </group>
  );
}
