"use client";

import { Html, RoundedBox } from "@react-three/drei";
import {
  CatmullRomCurve3,
  DoubleSide,
  ExtrudeGeometry,
  Mesh,
  MeshPhysicalMaterial,
  Path,
  Shape,
  Vector2,
  Vector3,
  type Group,
  type Side,
} from "three";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { ThreeEvent } from "@react-three/fiber";

import type { ScenePalette } from "@/components/builder/scene-theme";
import {
  BLOCK_SIZE_MM,
  CAVITY_LENGTH_RANGE_MM,
  DEFAULT_BLOCK_COLOR,
  DEFAULT_CAVITY_LENGTH_MM,
  DEFAULT_FOCAL_LENGTH_MM,
  DEFAULT_MOUNT_COLOR,
  DEFAULT_OBJECTIVE_COLOR,
  DEFAULT_PARTICLE_COLOR,
  DEFAULT_PHOTODIODE_COLOR,
  DEFAULT_SAMPLE_COLOR,
  FOCAL_LENGTH_RANGE_MM,
  PARTICLE_RADIUS_MM,
  SAMPLE_OPACITY,
  clamp,
  componentDisplayName,
  componentRadius,
  componentTop,
  type BuilderComponent,
  type LensShape,
  type Vec3,
} from "@/components/builder/types";

const GLASS_BLUE = "#bfe3ff";
const GLASS_CYAN = "#9fd8e0";
const PLATE_AMBER = "#f4e2b0";
const FILTER_TEAL = "#79b5a4";
const EMITTER_RED = "#ff5c5c";
const SAMPLE_COPPER = "#c98a53";
const CERAMIC = "#f2eee6";
const FIBER_JACKET = "#f2c200";
const GOLD = "#d4a93c";
const SENSOR_SILICON = "#2c3a63";
const CRYSTAL_CLEAR = "#dff3f5";
const CRYSTAL_AMBER = "#f3d9a0";
/** the sound wavefronts drawn inside an AOM's crystal */
const ACOUSTIC_TEAL = "#2f7f86";
/** Light held in place — a cavity's mode and a trapped particle share it. */
const MODE_COLOR = "#ff5a36";

/** `axis` is the component's height: the model draws its optical centre there. */
type ModelProps = { palette: ScenePalette; color?: string; axis: number };

/**
 * Whether posts are drawn: the view's toggle, read by every post, riser and
 * post adapter. A context rather than a prop so the models don't each thread
 * it through to their `Pillar`.
 */
const PostsVisible = createContext(true);

/** Glow and the parts inside a host must not catch the pointer. */
const NO_RAYCAST = () => null;

/**
 * Each model is drawn around its component's height (`axis`): a base, a post
 * cut to reach it, then the optic centred on it. Raising a component lengthens
 * the post; the part itself never scales.
 *
 * The hardware drawn here is the lab's own: LIOP-TEC opto-mechanics (STAR /
 * PLANET series kinematic mounts, Optomechanics catalogue 2018). That means
 * rounded-square anodised plates roughly twice the optic across, a bored front
 * plate, and 170-TPI fine-thread adjusters standing proud of the back plate.
 * Dimensions below follow the SR100 (1 inch optic) sample drawing: 49 mm
 * plate, 25.4 mm clear bore. A mirror's mount is drawn from the lab's own
 * LIOP-TEC kinematic mount (photographed on the bench); the rotation mount
 * follows Radiant Dyes. Everything on a post stands on a pedestal pillar.
 */

/** Nominal optic size on this bench, mm — everything is drawn around 1 inch. */
const OPTIC_D = 25.4;
/** SR100 plate footprint, mm. Roughly 2x the optic. */
const PLATE = 49;

// ---------------------------------------------------------------------------
// Shared hardware
// ---------------------------------------------------------------------------

/**
 * A rounded square with a central bore, extruded — the front plate of a STAR
 * mount. Built once at module scope: geometry construction needs no GL
 * context, and every mount on the bench shares the same casting.
 */
function boredPlate(size: number, corner: number, bore: number, depth: number) {
  const half = size / 2;
  const shape = new Shape();
  shape.moveTo(-half + corner, -half);
  shape.lineTo(half - corner, -half);
  shape.quadraticCurveTo(half, -half, half, -half + corner);
  shape.lineTo(half, half - corner);
  shape.quadraticCurveTo(half, half, half - corner, half);
  shape.lineTo(-half + corner, half);
  shape.quadraticCurveTo(-half, half, -half, half - corner);
  shape.lineTo(-half, -half + corner);
  shape.quadraticCurveTo(-half, -half, -half + corner, -half);

  const hole = new Path();
  hole.absarc(0, 0, bore / 2, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  return new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 24,
  });
}

/** SR100 front plate: 49 mm square, 25.4 mm clear aperture, 8 mm thick. */
/** Filter holder: smaller plate, square window cut by a generous bore. */
const FILTER_PLATE_GEOMETRY = boredPlate(38, 5, 22, 6);

/** A flat ring, extruded along +z: mount bodies, dials, trap holders. */
function annulus(outerRadius: number, innerRadius: number, depth: number) {
  const shape = new Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 48,
  });
}

const ROTATION_BODY_GEOMETRY = annulus(24, OPTIC_D / 2 + 0.6, 10);
const ROTATION_DIAL_GEOMETRY = annulus(21, OPTIC_D / 2 + 1.2, 3);
const TRAP_HOLDER_GEOMETRY = annulus(15, 5, 3);
const MIRROR_RING_GEOMETRY = annulus(15.5, OPTIC_D / 2, 8);
const COLLIMATOR_PLATE_GEOMETRY = boredPlate(32, 4, 12, 8);

/** The fiber jacket: out of the collimator's back and down to the table. */
function fiberJacketCurve(axis: number) {
  return new CatmullRomCurve3([
    new Vector3(-44, axis, 0),
    new Vector3(-60, axis - 4, 0),
    new Vector3(-72, axis * 0.7, 6),
    new Vector3(-78, axis * 0.33, 14),
    new Vector3(-86, 4, 26),
    new Vector3(-104, 1.8, 40),
  ]);
}
/**
 * Everything that isn't bare steel or glass is drawn as glossy enamel: a
 * dielectric, so its colour stays saturated instead of being darkened by a
 * metallic term, with a tight highlight from the overhead ring lights.
 */
const ENAMEL_ROUGHNESS = 0.18;
const ENAMEL_METALNESS = 0.04;

function Enamel({ color, side }: { color: string; side?: Side }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={ENAMEL_ROUGHNESS}
      metalness={ENAMEL_METALNESS}
      side={side}
    />
  );
}

/** Mount plates: the anodised colour, carried in enamel. */
function Anodised({ color, side }: { color: string; side?: Side }) {
  return <Enamel color={color} side={side} />;
}

/**
 * Real transmission rather than alpha: the glass refracts what's behind it,
 * its edges pick up the ring lights, and its tint deepens with thickness
 * (attenuation). Coloured optics — waveplates, filters — are dense glass that
 * tints strongly; plain optics carry a faint body tint and a strong clearcoat
 * so a clear cube still reads as a block in front of a dark void.
 *
 * `thickness` sets how far the view behind is shifted, so it should match the
 * part: at the default a 2 mm plate refracts like a cube and pulls the parts
 * around it (a mount's dial ticks) into view as ghosts.
 */
function Glass({
  tint,
  dense = false,
  thickness = 12,
}: {
  tint: string;
  dense?: boolean;
  thickness?: number;
}) {
  return (
    <meshPhysicalMaterial
      color={tint}
      metalness={0}
      roughness={0.03}
      transmission={0.96}
      ior={1.5}
      thickness={thickness}
      attenuationColor={tint}
      attenuationDistance={dense ? 8 : 18}
      specularIntensity={1}
      clearcoat={1}
      clearcoatRoughness={0.02}
      envMapIntensity={2}
    />
  );
}

function Stainless({ palette }: { palette: ScenePalette }) {
  return (
    <meshStandardMaterial
      color={palette.metal}
      roughness={0.3}
      metalness={0.85}
    />
  );
}

/**
 * Posts and pedestals are stainless too, but there is a lot of them — left at
 * full brightness they out-shout the optics, which is the opposite of how a
 * bench reads. Knurled screw heads keep the brighter `Stainless`.
 */
function Hardware({ palette }: { palette: ScenePalette }) {
  return (
    <meshStandardMaterial
      color={palette.mode === "dark" ? "#6b727e" : "#a7aeb8"}
      roughness={0.42}
      metalness={0.75}
    />
  );
}

/**
 * A pedestal pillar: a flanged base clamped to the breadboard and a plain
 * pillar up to `top`, in the post grey rather than the body enamel: a thin
 * stroke needs more contrast than a plate. Drawn at about 3/4 of a real
 * 1-inch pillar, so the posts read as strokes under the parts rather than
 * columns as wide as them. Raising a component lengthens the pillar only; the
 * base never changes. The clamping fork and tapped hole are left out.
 */
const PILLAR_RADIUS = 9;
const PILLAR_BASE_HEIGHT = 6;

function Pillar({ palette, top }: { palette: ScenePalette; top: number }) {
  const length = Math.max(1, top - PILLAR_BASE_HEIGHT);
  if (!useContext(PostsVisible)) return null;
  return (
    <group>
      <mesh position={[0, PILLAR_BASE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[13, 14.5, PILLAR_BASE_HEIGHT, 36]} />
        <Enamel color={palette.post} />
      </mesh>
      <mesh position={[0, PILLAR_BASE_HEIGHT + length / 2, 0]}>
        <cylinderGeometry args={[PILLAR_RADIUS, PILLAR_RADIUS, length, 32]} />
        <Enamel color={palette.post} />
      </mesh>
    </group>
  );
}

/**
 * A lens stands on a slim rod with a small pedestal instead: a holder would
 * hide the glass, and the rod still makes the height read as a post.
 */
function SlimRod({ palette, top }: { palette: ScenePalette; top: number }) {
  if (!useContext(PostsVisible)) return null;
  return (
    <group>
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[9.5, 11, 5, 28]} />
        <Hardware palette={palette} />
      </mesh>
      <mesh position={[0, top / 2, 0]}>
        <cylinderGeometry args={[3, 3, top, 16]} />
        <Hardware palette={palette} />
      </mesh>
      {/* the collar that grips the lens edge */}
      <mesh position={[0, top - 2, 0]}>
        <cylinderGeometry args={[4.6, 4.6, 6, 16]} />
        <Stainless palette={palette} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** thickness of the laser's mounting plates, along the laser */
const LASER_FOOT_MM = 6;

function LaserSource({ palette, axis }: ModelProps) {
  const posts = useContext(PostsVisible);
  const feet = Math.max(1, axis - 18);
  return (
    <group>
      {/* head sits on two thin plates across its width, like mounting
          brackets; raising the laser lengthens them */}
      {posts
        ? [-34, 34].map((x) => (
            <mesh key={x} position={[x, feet / 2, 0]}>
              <boxGeometry args={[LASER_FOOT_MM, feet, 40]} />
              <Enamel color={palette.post} />
            </mesh>
          ))
        : null}
      <RoundedBox
        args={[96, 40, 40]}
        radius={0.8}
        smoothness={3}
        position={[0, axis, 0]}
      >
        <Enamel color={palette.body} />
      </RoundedBox>
      <mesh position={[50, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[7, 7, 12, 22]} />
        <meshStandardMaterial
          color={EMITTER_RED}
          emissive={EMITTER_RED}
          emissiveIntensity={0.6}
          roughness={ENAMEL_ROUGHNESS}
        />
      </mesh>
      {/* the +x arrow: which way this source fires */}
      <mesh position={[64, axis, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[5, 12, 16]} />
        <meshStandardMaterial
          color={EMITTER_RED}
          emissive={EMITTER_RED}
          emissiveIntensity={0.35}
          roughness={ENAMEL_ROUGHNESS}
        />
      </mesh>
    </group>
  );
}

/**
 * Front plate: black anodised, 49 mm square with two opposite corners cut
 * off, and a plain 1-inch bore the mirror sits in.
 */
function chamferedPlate(size: number, chamfer: number, bore: number, depth: number) {
  const half = size / 2;
  const r = 2;
  const shape = new Shape();
  shape.moveTo(-half + chamfer, -half);
  shape.lineTo(half - r, -half);
  shape.quadraticCurveTo(half, -half, half, -half + r);
  shape.lineTo(half, half - chamfer);
  shape.lineTo(half - chamfer, half);
  shape.lineTo(-half + r, half);
  shape.quadraticCurveTo(-half, half, -half, half - r);
  shape.lineTo(-half, -half + chamfer);
  shape.closePath();
  const hole = new Path();
  hole.absarc(0, 0, bore / 2, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.8,
    bevelSize: 0.8,
    bevelSegments: 2,
    curveSegments: 32,
  });
}

/** Back frame: an L of anodised aluminium down one side and along the bottom. */
function lFrame(size: number, arm: number, depth: number) {
  const half = size / 2;
  const shape = new Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, half);
  shape.lineTo(half - arm, half);
  shape.lineTo(half - arm, -half + arm);
  shape.lineTo(-half, -half + arm);
  shape.closePath();
  return new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: LIOP_FRAME_BEVEL,
    bevelSize: LIOP_FRAME_BEVEL,
    bevelSegments: 3,
  });
}

const LIOP_FRONT_GEOMETRY = chamferedPlate(PLATE - 2, 7, OPTIC_D + 1, 7);
const LIOP_FRAME_ARM = 14;
const LIOP_FRAME_HALF = (PLATE - 3) / 2;
const LIOP_FRAME_BEVEL = 1.4;
const LIOP_FRAME_GEOMETRY = lFrame(PLATE - 3, LIOP_FRAME_ARM, 11);
const MIRROR_BOW = 60;
const MIRROR_CAP = Math.asin((OPTIC_D / 2 - 1.1) / MIRROR_BOW);

/** A black knurled knob on a stainless shaft, pointing out the back (-x). */
function KnurledKnob({
  palette,
  position,
}: {
  palette: ScenePalette;
  position: [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh position={[-3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[2.4, 2.4, 6, 12]} />
        <Stainless palette={palette} />
      </mesh>
      {/* 28 flat-shaded facets read as knurling from bench distance */}
      <mesh position={[-10, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[6, 6, 8, 28]} />
        <meshStandardMaterial
          color={palette.anodise}
          roughness={0.55}
          metalness={0.3}
          flatShading
        />
      </mesh>
    </group>
  );
}

/**
 * The lab's LIOP-TEC kinematic mirror mount, as photographed on the bench: a
 * black front plate holding the mirror, an L-shaped frame behind it in the
 * mount colour, and two black knurled adjusters out the back.
 */
function MirrorMount({ palette, color, axis }: ModelProps) {
  const frame = color ?? DEFAULT_MOUNT_COLOR;
  const corner = LIOP_FRAME_HALF - LIOP_FRAME_ARM / 2;
  return (
    <group>
      {/* flush with the underside of the frame, not sunk into it */}
      <Pillar palette={palette} top={axis - LIOP_FRAME_HALF - LIOP_FRAME_BEVEL} />
      {/* front plate, x = +4 .. -3 */}
      <mesh
        geometry={LIOP_FRONT_GEOMETRY}
        position={[4, axis, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <meshStandardMaterial
          color={palette.anodise}
          roughness={0.5}
          metalness={0.35}
        />
      </mesh>
      {/* the L frame behind it, in the mount colour, satin anodised */}
      <mesh
        geometry={LIOP_FRAME_GEOMETRY}
        position={[-5, axis, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <meshStandardMaterial color={frame} roughness={0.36} metalness={0.4} />
      </mesh>
      {/* the two adjusters: top of the upright arm, far end of the bottom arm */}
      <KnurledKnob palette={palette} position={[-17, axis + corner, corner]} />
      <KnurledKnob palette={palette} position={[-17, axis - corner, -corner]} />
      {/* the mirror: a green-edged substrate in the bore, and a silvered face
          bowed very slightly (R = 60 mm) so it catches the ring lights across
          its width instead of reflecting one flat grey */}
      <mesh position={[0.2, axis, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[OPTIC_D / 2, OPTIC_D / 2, 5, 48]} />
        {/* side and front: the green substrate; back: plain ground glass */}
        {[0, 1].map((slot) => (
          <meshStandardMaterial
            key={slot}
            attach={`material-${slot}`}
            color="#9fe6b4"
            emissive="#3fbf6a"
            emissiveIntensity={0.6}
            roughness={0.15}
            metalness={0}
          />
        ))}
        <meshStandardMaterial
          attach="material-2"
          color="#c9ced6"
          roughness={0.6}
          metalness={0.2}
        />
      </mesh>
      <mesh
        position={[4 - MIRROR_BOW, axis, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <sphereGeometry
          args={[MIRROR_BOW, 48, 8, 0, Math.PI * 2, 0, MIRROR_CAP]}
        />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.04}
          metalness={1}
          envMapIntensity={3.2}
        />
      </mesh>
      {/* the substrate's edge, lit through the glass: a thin green ring */}
      <mesh position={[3.6, axis, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[OPTIC_D / 2 - 1.1, OPTIC_D / 2, 48]} />
        <meshBasicMaterial color="#7de8a0" toneMapped={false} />
      </mesh>
    </group>
  );
}

const CUBE_COATING_MM = 1.2;

function BeamSplitter({ palette, color, axis }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  const cube = 25.4;
  return (
    <group>
      <Pillar palette={palette} top={axis - cube / 2 - 6} />
      {/* cube platform: a plain anodised plate, the way a PBS actually sits */}
      <RoundedBox
        args={[44, 8, 44]}
        radius={0.8}
        smoothness={3}
        position={[0, axis - cube / 2 - 4, 0]}
      >
        <Anodised color={mount} />
      </RoundedBox>
      <mesh position={[0, axis, 0]}>
        <boxGeometry args={[cube, cube, cube]} />
        <Glass tint={GLASS_CYAN} />
      </mesh>
      {/* the coating on the cemented diagonal, corner to corner; polarizing or
          not, it looks the same. It runs along local x = z, so a beam arriving
          along +x turns to +z. Opaque, because the glass's transmission pass
          leaves transparent objects out, and a little thick so it still reads
          edge-on from top-down. Shortened so its ends stay inside the glass. */}
      <group position={[0, axis, 0]} rotation={[0, -Math.PI / 4, 0]}>
        <mesh>
          <boxGeometry args={[cube * Math.SQRT2 - 2.4, cube - 0.6, CUBE_COATING_MM]} />
          <meshStandardMaterial color="#2a9fb3" roughness={0.15} metalness={0.5} />
        </mesh>
        {/* where the coating meets the top face: a bright hairline corner to
            corner, laid on the glass rather than seen through it (the
            transmission pass blurs one that thin away), so the diagonal
            reads from any side and in either theme */}
        <mesh position={[0, cube / 2 + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[cube * Math.SQRT2 - 2.4, CUBE_COATING_MM]} />
          <meshBasicMaterial color="#8ff0ff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The lens profile, revolved: a flat or curved face each side of a thin edge.
 * Curvature follows the lensmaker's equation (n = 1.5): a face's real sag is
 * about a²/2R. The sag, not the radius, is exaggerated (threefold, because a
 * real f = 100 mm lens bulges by under 2 mm) and eased toward LENS_MAX_SAG, so
 * it shrinks smoothly with focal length and never jumps. Exaggerating the
 * radius instead hit a hemisphere cap: every short lens drew the same dome,
 * then the bulge fell off a cliff just past it.
 */
const LENS_SAG_GAIN = 3;
const LENS_MAX_SAG = 8;

function lensProfile(shape: LensShape, focalLength: number): Vector2[] {
  const a = OPTIC_D / 2;
  const f = clamp(focalLength, FOCAL_LENGTH_RANGE_MM);
  const curvedFaces = shape === "biconvex" ? 2 : 1;
  const realRadius = 0.5 * f * curvedFaces;
  const realSag = (a * a) / (2 * realRadius);
  const sag = LENS_MAX_SAG * (1 - Math.exp((-LENS_SAG_GAIN * realSag) / LENS_MAX_SAG));
  // the sphere through the rim and that sag
  const radius = (a * a + sag * sag) / (2 * sag);
  const edge = 1;
  const steps = 16;
  const face = (sign: 1 | -1) =>
    Array.from({ length: steps + 1 }, (_, index) => {
      const r = (a * index) / steps;
      const y = edge + sag - (radius - Math.sqrt(radius * radius - r * r));
      return new Vector2(r, sign * y);
    });
  const front = face(1).reverse();
  const back =
    shape === "biconvex"
      ? face(-1)
      : [new Vector2(0, -edge), new Vector2(a, -edge)];
  // bottom (back face) to top (front face) keeps the lathe's normals outward
  return [...back, ...front];
}

function Lens({
  palette,
  axis,
  shape,
  focalLength,
}: ModelProps & { shape: LensShape; focalLength: number }) {
  const profile = useMemo(
    () => lensProfile(shape, focalLength),
    [shape, focalLength],
  );
  return (
    <group>
      <SlimRod palette={palette} top={axis - OPTIC_D / 2 + 1} />
      <mesh position={[0, axis, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry args={[profile, 48]} />
        <Glass tint={GLASS_BLUE} />
      </mesh>
    </group>
  );
}

/** Every 10 degrees; every 30th tick runs longer. */
const DIAL_TICKS = Array.from({ length: 36 }, (_, index) => ({
  angle: (index * Math.PI) / 18,
  major: index % 3 === 0,
}));

/**
 * A Radiant Dyes-style rotation mount: a round body on the pillar, a
 * graduated dial on its face, and the waveplate dropped in the 1-inch bore.
 * The dial is drawn, not a setting; note the angle in the label.
 */
function Waveplate({ palette, color, axis }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  const tickColor = palette.mode === "dark" ? "#e9e4d8" : "#1b1f26";
  const posts = useContext(PostsVisible);
  return (
    <group>
      <Pillar palette={palette} top={axis - 30} />
      {posts ? (
        <mesh position={[0, axis - 26, 0]}>
          <boxGeometry args={[12, 8, 20]} />
          <Anodised color={mount} />
        </mesh>
      ) : null}
      <mesh
        geometry={ROTATION_BODY_GEOMETRY}
        position={[5, axis, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Anodised color={mount} />
      </mesh>
      <mesh
        geometry={ROTATION_DIAL_GEOMETRY}
        position={[8, axis, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Enamel color={palette.body} />
      </mesh>
      {DIAL_TICKS.map(({ angle, major }) => {
        const length = major ? 4 : 2.2;
        const r = 21 - length / 2 - 0.4;
        return (
          <mesh
            key={angle}
            position={[8.2, axis + r * Math.sin(angle), r * Math.cos(angle)]}
            rotation={[-angle, 0, 0]}
          >
            <boxGeometry args={[0.4, 0.6, length]} />
            <meshBasicMaterial color={tickColor} />
          </mesh>
        );
      })}
      {/* index mark on the body, and the locking screw on top */}
      <mesh position={[5.5, axis + 22.5, 0]}>
        <boxGeometry args={[1, 3, 1.2]} />
        <meshBasicMaterial color={tickColor} />
      </mesh>
      <mesh position={[0, axis + 26, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 5, 14]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[2, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[OPTIC_D / 2, OPTIC_D / 2, 2, 32]} />
        {/* plain tint, not Glass: at this size refraction only drew a ghost rim */}
        <meshStandardMaterial
          color={PLATE_AMBER}
          roughness={0.2}
          metalness={0}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Filter({ palette, color, axis }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  return (
    <group>
      <Pillar palette={palette} top={axis - 19} />
      <mesh
        geometry={FILTER_PLATE_GEOMETRY}
        position={[3, axis, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Anodised color={mount} />
      </mesh>
      <mesh position={[0, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[12, 12, 3, 32]} />
        <Glass tint={FILTER_TEAL} dense thickness={3} />
      </mesh>
    </group>
  );
}

/** from the ring's tube (radius 15–20) out to 28 mm, clear of the name tag at 32 */
const IRIS_LEVER_LENGTH = 11;
const IRIS_LEVER_MID = 17 + IRIS_LEVER_LENGTH / 2;
const IRIS_LEVER_TILT = Math.PI / 6;

function Iris({ palette, color, axis }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  const posts = useContext(PostsVisible);
  return (
    <group>
      <Pillar palette={palette} top={axis - 21} />
      <mesh position={[0, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[15, 5, 12, 36]} />
        <Anodised color={mount} />
      </mesh>
      {/* blade stack seen through the aperture: six segments make the hole a
          hexagon, as closing blades leave it; the outer edge hides in the ring */}
      <mesh position={[0, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <ringGeometry args={[5, 15, 6]} />
        <meshStandardMaterial
          color={palette.mode === "dark" ? "#7b828e" : "#b3b9c3"}
          roughness={0.45}
          metalness={0.7}
          side={DoubleSide}
        />
      </mesh>
      {/* the closing lever — every iris on the bench has one sticking out. It
          leaves the rim radially, in the ring's plane, 30° off the top; its
          root is buried in the ring's tube */}
      <mesh
        position={[
          IRIS_LEVER_MID * Math.sin(IRIS_LEVER_TILT),
          axis + IRIS_LEVER_MID * Math.cos(IRIS_LEVER_TILT),
          0,
        ]}
        rotation={[0, 0, -IRIS_LEVER_TILT]}
      >
        <cylinderGeometry args={[1.5, 1.5, IRIS_LEVER_LENGTH, 16]} />
        <Stainless palette={palette} />
      </mesh>
      {/* the post adapter under the ring */}
      {posts ? (
        <mesh position={[0, axis - 19, 0]}>
          <boxGeometry args={[14, 8, 14]} />
          <Anodised color={mount} />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * The sample: a thin, tinted slab, floating on the axis and facing the beam
 * like a lens. The real one is 10 x 10 x 1 mm, too small to see, so it is
 * drawn at beam-cube size. Its colour and opacity are the user's: plain
 * alpha rather than transmission, so the opacity slider means what it says.
 */
function Sample({
  axis,
  color,
  opacity,
}: {
  axis: number;
  color: string;
  opacity: number;
}) {
  return (
    <mesh position={[0, axis, 0]}>
      <boxGeometry args={[3, OPTIC_D, OPTIC_D]} />
      <meshPhysicalMaterial
        color={color}
        metalness={0}
        roughness={0.35}
        clearcoat={0.6}
        clearcoatRoughness={0.2}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </mesh>
  );
}

/**
 * A fiber collimator: the barrel through a small plate on the pillar, its
 * connector out the back and the jacket curling down to the table. A beam can
 * start here (fiber out) or end here (fiber in).
 */
function FiberCollimator({ palette, color, axis }: ModelProps) {
  const mount = color ?? DEFAULT_MOUNT_COLOR;
  const jacket = useMemo(() => fiberJacketCurve(axis), [axis]);
  return (
    <group>
      <Pillar palette={palette} top={axis - 16 + 2} />
      <mesh
        geometry={COLLIMATOR_PLATE_GEOMETRY}
        position={[4, axis, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Anodised color={mount} />
      </mesh>
      <mesh position={[-6, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[6, 6, 32, 24]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[10.2, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[4.5, 4.5, 0.6, 24]} />
        <Enamel color="#1b1f26" />
      </mesh>
      <mesh position={[-27, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[4, 4, 10, 18]} />
        <Hardware palette={palette} />
      </mesh>
      <mesh position={[-38, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[2.2, 3, 12, 14]} />
        <Enamel color={FIBER_JACKET} />
      </mesh>
      <mesh>
        <tubeGeometry args={[jacket, 48, 1.6, 10]} />
        <Enamel color={FIBER_JACKET} />
      </mesh>
    </group>
  );
}

/** Rod offset from the trap axis, mm — a schematic size, not a real trap's. */
const TRAP_ROD_OFFSET = 8;
const TRAP_ROD_LENGTH = 56;
const TRAP_ENDCAP_GAP = 12;

/**
 * An Innsbruck-style linear Paul trap, floating: four rods along +Y (the trap
 * axis), a ring endcap above and below the centre, and a ceramic holder at
 * each end. Drawn about the size of a cryostat so it can be seen; the centre,
 * where a particle sits, is on the component's height.
 */
function PaulTrap({ palette, axis }: ModelProps) {
  const holderY = TRAP_ROD_LENGTH / 2;
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[sx * TRAP_ROD_OFFSET, axis, sz * TRAP_ROD_OFFSET]}
          >
            <cylinderGeometry args={[1.6, 1.6, TRAP_ROD_LENGTH, 16]} />
            <Stainless palette={palette} />
          </mesh>
        )),
      )}
      {[-1, 1].map((side) => (
        <mesh
          key={`cap${side}`}
          position={[0, axis + side * TRAP_ENDCAP_GAP, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={NO_RAYCAST}
        >
          <torusGeometry args={[4.5, 1.1, 12, 36]} />
          <meshStandardMaterial
            color={SAMPLE_COPPER}
            roughness={0.3}
            metalness={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The cavity's mode: a TEM00 Gaussian envelope between the mirrors, its waist
 * at the centre. Schematic widths; it is a glow, not a beam.
 */
function modeProfile(length: number, radius: number): Vector2[] {
  const half = length / 2 - 3;
  const waist = 1.4 * radius;
  const edge = 4 * radius;
  const rayleigh = half / Math.sqrt((edge / waist) ** 2 - 1);
  const steps = 32;
  const points = [new Vector2(0, -half)];
  for (let index = 0; index <= steps; index += 1) {
    const x = -half + (2 * half * index) / steps;
    points.push(new Vector2(waist * Math.sqrt(1 + (x / rayleigh) ** 2), x));
  }
  points.push(new Vector2(0, half));
  return points;
}

/**
 * A cavity mirror, revolved: flat back, concave face. The cavity is drawn
 * concentric, so each face's radius is half the cavity length and its centre
 * of curvature sits on the other mirror's side of the waist. That is clamped
 * to keep the dip visible: below a 44 mm cavity a 1-inch mirror would be
 * deeper than it is thick, and past ~110 mm the sag drops under 1.5 mm.
 */
const CAVITY_MIRROR_THICKNESS = 7;
const CAVITY_SAG_RANGE_MM: [number, number] = [1.5, 4];

function cavityMirrorProfile(length: number): Vector2[] {
  const a = OPTIC_D / 2;
  const radiusFor = (sag: number) => (a * a + sag * sag) / (2 * sag);
  const [minSag, maxSag] = CAVITY_SAG_RANGE_MM;
  const radius = clamp(length / 2, [radiusFor(maxSag), radiusFor(minSag)]);
  const sag = radius - Math.sqrt(radius * radius - a * a);
  const half = CAVITY_MIRROR_THICKNESS / 2;
  const steps = 16;
  const face = Array.from({ length: steps + 1 }, (_, index) => {
    const r = a * (1 - index / steps);
    const depth = sag - (radius - Math.sqrt(radius * radius - r * r));
    return new Vector2(r, half - depth);
  });
  // back (bottom) out to the rim, up the edge, then the face in to the axis:
  // the lathe's normals come out pointing outward
  return [new Vector2(0, -half), new Vector2(a, -half), ...face];
}

/** Two facing concave mirrors along local x, floating, with the mode between. */
function Cavity({ color, axis, length }: ModelProps & { length: number }) {
  const span = clamp(length, CAVITY_LENGTH_RANGE_MM);
  const halo = useMemo(() => modeProfile(span, 1), [span]);
  const core = useMemo(() => modeProfile(span, 0.45), [span]);
  const mirror = useMemo(() => cavityMirrorProfile(span), [span]);
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[(side * span) / 2, axis, 0]}>
          {/* the concave face turned in, toward the waist */}
          <mesh rotation={[0, 0, (side * Math.PI) / 2]}>
            <latheGeometry args={[mirror, 48]} />
            <meshStandardMaterial
              color="#e8eef5"
              roughness={0.05}
              metalness={0.95}
            />
          </mesh>
        </group>
      ))}
      <mesh
        position={[0, axis, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        raycast={NO_RAYCAST}
      >
        <latheGeometry args={[halo, 32]} />
        <meshBasicMaterial
          color={MODE_COLOR}
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        position={[0, axis, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        raycast={NO_RAYCAST}
      >
        <latheGeometry args={[core, 24]} />
        <meshBasicMaterial
          color={MODE_COLOR}
          transparent
          opacity={0.75}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Below this a particle is hard to click, so an unseen sphere this size catches the pointer. */
const PARTICLE_HIT_MM = 6;

/**
 * A particle: a sphere of the user's colour and radius, so the same part can
 * stand for a silica bead, an ion or a droplet. It glows faintly so it still
 * reads inside a dark trap. In a host it sits at the host's centre; alone it
 * floats on the axis.
 */
function Particle({ axis, color, radius }: { axis: number; color: string; radius: number }) {
  return (
    <group position={[0, axis, 0]}>
      <mesh>
        <sphereGeometry args={[radius, 32, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.3}
          metalness={0}
        />
      </mesh>
      {radius < PARTICLE_HIT_MM ? (
        <mesh>
          <sphereGeometry args={[PARTICLE_HIT_MM, 12, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * A Thorlabs LB1-style beam block: a stack of thin black-anodised fins between
 * a top and a bottom plate, its broad face to the beam (-x). The fin edges
 * show as bare aluminium down each end; a cap screw and two pins sit on top.
 */
const BLOCK_FINS_X = 24;
const BLOCK_FINS_Y = 26;
const BLOCK_FINS_Z = 50;
const BLOCK_PLATE_MM = 1.6;

function BeamBlock({ palette, axis }: ModelProps) {
  const plateY = BLOCK_FINS_Y / 2 + BLOCK_PLATE_MM / 2;
  const black = palette.mode === "dark" ? "#15181d" : "#1b1f26";
  return (
    <group>
      <Pillar palette={palette} top={axis - plateY - BLOCK_PLATE_MM / 2} />
      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          args={[BLOCK_FINS_X + 6, BLOCK_PLATE_MM, BLOCK_FINS_Z + 8]}
          radius={0.6}
          smoothness={2}
          position={[0, axis + side * plateY, 0]}
        >
          <meshStandardMaterial color={black} roughness={0.5} metalness={0.35} />
        </RoundedBox>
      ))}
      <mesh position={[0, axis, 0]}>
        <boxGeometry args={[BLOCK_FINS_X, BLOCK_FINS_Y, BLOCK_FINS_Z]} />
        <meshStandardMaterial color={black} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* the fin stack's grooves across the front face */}
      {Array.from({ length: 9 }, (_, index) => (
        <mesh
          key={index}
          position={[-BLOCK_FINS_X / 2 - 0.05, axis - BLOCK_FINS_Y / 2 + (index + 1) * (BLOCK_FINS_Y / 10), 0]}
        >
          <boxGeometry args={[0.1, 0.35, BLOCK_FINS_Z - 1]} />
          <meshBasicMaterial color="#3a414c" />
        </mesh>
      ))}
      {/* bare fin edges at each end */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, axis, side * (BLOCK_FINS_Z / 2 + 1)]}>
          <boxGeometry args={[BLOCK_FINS_X - 2, BLOCK_FINS_Y, 2]} />
          <Hardware palette={palette} />
        </mesh>
      ))}
      <mesh position={[0, axis + plateY + 2.5, 0]}>
        <cylinderGeometry args={[3.2, 3.2, 4, 16]} />
        <meshStandardMaterial color={black} roughness={0.45} metalness={0.4} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, axis + plateY + 1.3, side * 16]}>
          <cylinderGeometry args={[3, 3, 1.4, 20]} />
          <Stainless palette={palette} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A generic infinity-corrected microscope objective, beam in from -x and the
 * tip toward the focus (+x): a brass RMS thread screwed into a small plate on
 * the post, a satin barrel with a black band, and a taper down to the front
 * lens. The barrel takes the component colour, so it can be chrome, champagne
 * or gunmetal like the real ones.
 */
const OBJECTIVE_BRASS = "#c9a24a";
const OBJECTIVE_PLATE_GEOMETRY = boredPlate(36, 4, 20, 6);
/** the plate's middle along the beam: drawn at x = -23 and extruded 6 mm back */
const OBJECTIVE_PLATE_X = -26;

function Objective({ palette, color, axis }: ModelProps) {
  const barrel = color ?? DEFAULT_OBJECTIVE_COLOR;
  const satin = (
    <meshStandardMaterial color={barrel} roughness={0.28} metalness={0.85} />
  );
  return (
    <group>
      {/* the post stands under the plate the thread screws into, not under the barrel */}
      <group position={[OBJECTIVE_PLATE_X, 0, 0]}>
        <Pillar palette={palette} top={axis - 18} />
      </group>
      <mesh
        geometry={OBJECTIVE_PLATE_GEOMETRY}
        position={[-23, axis, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Anodised color={palette.anodise} />
      </mesh>
      <mesh position={[-26, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[10, 10, 8, 32]} />
        <meshStandardMaterial color={OBJECTIVE_BRASS} roughness={0.35} metalness={0.9} />
      </mesh>
      <mesh position={[-21, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[14, 14, 4, 40]} />
        {satin}
      </mesh>
      <mesh position={[-4, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[16, 16, 30, 48]} />
        {satin}
      </mesh>
      <mesh position={[-8, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[16.15, 16.15, 1.6, 48]} />
        <meshStandardMaterial color="#12161d" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* the taper, the spring-loaded nose and the front lens */}
      <mesh position={[16, axis, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[6, 16, 10, 48]} />
        {satin}
      </mesh>
      <mesh position={[23, axis, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[4.2, 6, 4, 32]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[25.05, axis, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[2.4, 2.4, 0.2, 24]} />
        <meshStandardMaterial color="#3a4a5c" roughness={0.05} metalness={0.2} />
      </mesh>
    </group>
  );
}

/**
 * A plain box for any part the builder doesn't draw: the user sets its
 * dimensions, colour and label. A Faraday rotator is this block between two
 * beam cubes.
 */
function GenericBlock({ palette, color, axis, size }: ModelProps & { size: Vec3 }) {
  const [dx, dy, dz] = size;
  return (
    <group>
      <Pillar palette={palette} top={axis - dy / 2} />
      <RoundedBox
        args={[dx, dy, dz]}
        radius={Math.min(1.2, Math.min(dx, dy, dz) / 4)}
        smoothness={3}
        position={[0, axis, 0]}
      >
        <Enamel color={color ?? DEFAULT_BLOCK_COLOR} />
      </RoundedBox>
      {/* the clear aperture on each beam face */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[(side * dx) / 2 + side * 0.05, axis, 0]}
          rotation={[0, (side * Math.PI) / 2, 0]}
        >
          <circleGeometry args={[Math.min(5, dy / 3, dz / 3), 28]} />
          <meshStandardMaterial color="#12161d" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** An SMA stub pointing up from `at`: a stainless body and a gold pin. */
function SmaConnector({
  palette,
  at,
}: {
  palette: ScenePalette;
  at: [number, number, number];
}) {
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

/**
 * The photodiode as lab diagrams draw it: a face the beam lands on (-x), a
 * dome in the component colour bulging away from the beam, and a fiber off
 * the dome's tip curling down to the table. The face is set back into a wide,
 * shallow cup with the real, small active area in it: a square silicon chip
 * in a gold frame. Colour the dome to tell detectors apart.
 */
const PD_RADIUS = 13;
const PD_FACE_DEPTH = 4;
const PD_CUP_RADIUS = 9.5;
const PD_CUP_BLACK = "#20252d";
const PD_FACE_GEOMETRY = annulus(PD_RADIUS, PD_CUP_RADIUS, PD_FACE_DEPTH);

/** The fiber out of the dome's tip (+x) and down to the table. */
function photodiodeFiberCurve(axis: number) {
  const x = PD_RADIUS + 4;
  return new CatmullRomCurve3([
    new Vector3(x, axis, 0),
    new Vector3(x + 14, axis - 2, 0),
    new Vector3(x + 26, axis * 0.7, 6),
    new Vector3(x + 32, axis * 0.33, 14),
    new Vector3(x + 40, 4, 26),
    new Vector3(x + 58, 1.8, 40),
  ]);
}

function Photodiode({ palette, color, axis }: ModelProps) {
  const fiber = useMemo(() => photodiodeFiberCurve(axis), [axis]);
  return (
    <group>
      <Pillar palette={palette} top={axis - PD_RADIUS} />
      <group position={[0, axis, 0]}>
        {/* the face plate, extruded from x = 0 toward the beam */}
        <mesh geometry={PD_FACE_GEOMETRY} rotation={[0, -Math.PI / 2, 0]}>
          <Enamel color={palette.body} />
        </mesh>
        {/* the cup's wall and floor. Unlit, and the wall a hair inside the
            plate's bore so the two surfaces never fight */}
        <mesh position={[-PD_FACE_DEPTH / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[PD_CUP_RADIUS - 0.1, PD_CUP_RADIUS - 0.1, PD_FACE_DEPTH, 48, 1, true]} />
          <meshBasicMaterial color={PD_CUP_BLACK} side={DoubleSide} />
        </mesh>
        <mesh position={[-1.5, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[PD_CUP_RADIUS, 48]} />
          <meshStandardMaterial color={PD_CUP_BLACK} roughness={0.6} />
        </mesh>
        <mesh position={[-1.75, 0, 0]}>
          <boxGeometry args={[0.5, 6, 6]} />
          <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.9} />
        </mesh>
        <mesh position={[-2.05, 0, 0]}>
          <boxGeometry args={[0.2, 4.4, 4.4]} />
          <meshStandardMaterial color={SENSOR_SILICON} roughness={0.12} metalness={0.5} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <sphereGeometry args={[PD_RADIUS, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Enamel color={color ?? DEFAULT_PHOTODIODE_COLOR} />
        </mesh>
        <mesh position={[PD_RADIUS + 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[2.4, 2.4, 5, 14]} />
          <Hardware palette={palette} />
        </mesh>
      </group>
      <mesh>
        <tubeGeometry args={[fiber, 48, 1.6, 10]} />
        <Enamel color={FIBER_JACKET} />
      </mesh>
    </group>
  );
}

/**
 * An acousto-optic modulator, drawn bare: the crystal with the beam along x
 * and a piezo transducer bonded on top that launches the sound wave down
 * through it. The wavefronts are faint sheets, so the grating the beam
 * diffracts off can be seen.
 */
const AOM_CRYSTAL: [number, number, number] = [30, 14, 12];

function Aom({ palette, axis }: ModelProps) {
  const [length, height, width] = AOM_CRYSTAL;
  const top = axis + height / 2;
  return (
    <group>
      <Pillar palette={palette} top={axis - height / 2 - 4} />
      <RoundedBox
        args={[length + 10, 4, width + 12]}
        radius={0.8}
        smoothness={2}
        position={[0, axis - height / 2 - 2, 0]}
      >
        <Anodised color={palette.anodise} />
      </RoundedBox>
      <mesh position={[0, axis, 0]}>
        <boxGeometry args={AOM_CRYSTAL} />
        <Glass tint={CRYSTAL_CLEAR} thickness={width} />
      </mesh>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh
          key={index}
          position={[0, axis - height / 2 + ((index + 1) * height) / 6, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={NO_RAYCAST}
        >
          <planeGeometry args={[length - 2, width - 2]} />
          <meshBasicMaterial
            color={ACOUSTIC_TEAL}
            transparent
            opacity={0.22}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ))}
      {/* the transducer: a gold electrode under the black piezo slab */}
      <mesh position={[0, top + 0.3, 0]}>
        <boxGeometry args={[length * 0.6, 0.6, width]} />
        <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, top + 2, 0]}>
        <boxGeometry args={[length * 0.6, 3, width]} />
        <Enamel color="#1b1f26" />
      </mesh>
      <SmaConnector palette={palette} at={[0, top + 3.5, 0]} />
    </group>
  );
}

/**
 * An electro-optic modulator, drawn bare: a long crystal bar along the beam
 * between gold electrodes top and bottom, wired up to an SMA.
 */
const EOM_LENGTH = 44;
const EOM_SIDE = 9;

function Eom({ palette, axis }: ModelProps) {
  const top = axis + EOM_SIDE / 2;
  return (
    <group>
      <Pillar palette={palette} top={axis - EOM_SIDE / 2 - 5} />
      <RoundedBox
        args={[EOM_LENGTH + 10, 4, EOM_SIDE + 14]}
        radius={0.8}
        smoothness={2}
        position={[0, axis - EOM_SIDE / 2 - 3, 0]}
      >
        <Anodised color={palette.anodise} />
      </RoundedBox>
      <mesh position={[0, axis, 0]}>
        <boxGeometry args={[EOM_LENGTH, EOM_SIDE, EOM_SIDE]} />
        <Glass tint={CRYSTAL_AMBER} dense thickness={EOM_SIDE} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, axis + side * (EOM_SIDE / 2 + 0.4), 0]}>
          <boxGeometry args={[EOM_LENGTH - 4, 0.8, EOM_SIDE]} />
          <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, top + 3, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 5, 8]} />
        <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.9} />
      </mesh>
      <SmaConnector palette={palette} at={[0, top + 5.5, 0]} />
    </group>
  );
}

/**
 * A scientific CMOS camera: a flat box, shallow along the beam, with the
 * C-mount on the axis in the middle of the front face (-x).
 */
const CAMERA_DEPTH_MM = 25;
const CAMERA_HALF_MM = 25;
const CAMERA_FRONT_X = -9;

function CameraBody({ palette, axis }: ModelProps) {
  return (
    <group>
      {/* flush with the body's underside, not sunk into it */}
      <Pillar palette={palette} top={axis - CAMERA_HALF_MM} />
      <RoundedBox
        args={[CAMERA_DEPTH_MM, 2 * CAMERA_HALF_MM, 2 * CAMERA_HALF_MM]}
        radius={0.8}
        smoothness={3}
        position={[CAMERA_FRONT_X + CAMERA_DEPTH_MM / 2, axis, 0]}
      >
        <Enamel color={palette.body} />
      </RoundedBox>
      {/* C-mount barrel on the axis */}
      <mesh position={[-12, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[13, 15, 20, 28]} />
        <Hardware palette={palette} />
      </mesh>
      <mesh position={[-22, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[11, 11, 2, 28]} />
        <Enamel color="#12161d" />
      </mesh>
    </group>
  );
}

function Spectrometer({ palette, axis }: ModelProps) {
  const body = axis + 20;
  return (
    <group>
      <mesh position={[0, body / 2, 0]}>
        <boxGeometry args={[110, body, 80]} />
        <Enamel color={palette.body} />
      </mesh>
      {/* input slit / fibre port, on the shared axis */}
      <mesh position={[-57, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[7, 7, 10, 20]} />
        <Enamel color="#1b1f26" />
      </mesh>
      <mesh position={[0, body + 1, 0]}>
        <boxGeometry args={[100, 2, 70]} />
        <Hardware palette={palette} />
      </mesh>
    </group>
  );
}

/**
 * A fiber-coupled single-photon counter, drawn as the real ones look: a black
 * module on a post, so it never reads as the white camera. An FC receptacle on
 * the face (-x) takes the fiber, and each count leaves as a pulse on one of two
 * SMA jacks out the back (+x). Fibers and cables are drawn as connections, not
 * as part of the module.
 */
const SPCM_FACE_X = -20;
const SPCM_DEPTH_MM = 48;
const SPCM_HALF_MM = 17;
const SPCM_WIDTH_MM = 30;
const SPCM_JACK_DROP_MM = 6;
const SPCM_JACK_Z_MM = [-7, 7];
const FC_FLANGE_MM = 13;
const FC_FLANGE_DEPTH_MM = 1.5;
const FC_BARREL_RADIUS_MM = 4.5;
const FC_BARREL_LENGTH_MM = 7;
const FC_TIP_RADIUS_MM = 2.8;
const FC_TIP_LENGTH_MM = 2;
/** where the thread ridges sit on the barrel, mm out from the flange */
const FC_THREAD_MM = [1.5, 3.5, 5.5];

function SinglePhotonDetector({ palette, axis }: ModelProps) {
  const flangeOut = SPCM_FACE_X - FC_FLANGE_DEPTH_MM;
  const barrelEnd = flangeOut - FC_BARREL_LENGTH_MM;
  const tipEnd = barrelEnd - FC_TIP_LENGTH_MM;
  return (
    <group>
      <Pillar palette={palette} top={axis - SPCM_HALF_MM} />
      <RoundedBox
        args={[SPCM_DEPTH_MM, 2 * SPCM_HALF_MM, SPCM_WIDTH_MM]}
        radius={0.8}
        smoothness={3}
        position={[SPCM_FACE_X + SPCM_DEPTH_MM / 2, axis, 0]}
      >
        <Enamel color={palette.anodise} />
      </RoundedBox>
      {/* the FC receptacle: a square flange flat on the face, a threaded
          barrel, and the ceramic sleeve with the dark bore the fiber meets */}
      <mesh position={[SPCM_FACE_X - FC_FLANGE_DEPTH_MM / 2, axis, 0]}>
        <boxGeometry args={[FC_FLANGE_DEPTH_MM, FC_FLANGE_MM, FC_FLANGE_MM]} />
        <Stainless palette={palette} />
      </mesh>
      <mesh position={[flangeOut - FC_BARREL_LENGTH_MM / 2, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[FC_BARREL_RADIUS_MM, FC_BARREL_RADIUS_MM, FC_BARREL_LENGTH_MM, 24]} />
        <Stainless palette={palette} />
      </mesh>
      {FC_THREAD_MM.map((out) => (
        <mesh key={out} position={[flangeOut - out, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[FC_BARREL_RADIUS_MM + 0.4, FC_BARREL_RADIUS_MM + 0.4, 0.7, 24]} />
          <Stainless palette={palette} />
        </mesh>
      ))}
      <mesh position={[barrelEnd - FC_TIP_LENGTH_MM / 2, axis, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[FC_TIP_RADIUS_MM, FC_TIP_RADIUS_MM, FC_TIP_LENGTH_MM, 20]} />
        <Enamel color={CERAMIC} />
      </mesh>
      <mesh position={[tipEnd - 0.05, axis, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <circleGeometry args={[1.1, 16]} />
        <Enamel color="#12161d" />
      </mesh>
      {/* the pulse outputs: two SMA jacks out the back, a little below the axis */}
      {SPCM_JACK_Z_MM.map((z) => (
        <group
          key={z}
          position={[SPCM_FACE_X + SPCM_DEPTH_MM, axis - SPCM_JACK_DROP_MM, z]}
          rotation={[0, 0, -Math.PI / 2]}
        >
          <SmaConnector palette={palette} at={[0, 0, 0]} />
        </group>
      ))}
    </group>
  );
}

/**
 * A bench-top time tagger: a dark case on four feet, sitting on the table,
 * with a row of SMA inputs across its front panel (-x) at its fixed height and
 * a status light at one end. Cables from the detectors end here.
 */
const TAGGER_DEPTH_MM = 150;
const TAGGER_HALF_MM = 23;
const TAGGER_WIDTH_MM = 200;
const TAGGER_PANEL_MM = 1.5;
const TAGGER_INPUTS = 8;
const TAGGER_PITCH_MM = 18;
/** the row of inputs is shifted toward +z, leaving the -z end for the status light */
const TAGGER_ROW_Z_MM = 22;
const TAGGER_LED_Z_MM = -78;
const TAGGER_LED = "#36c26b";
const TAGGER_FOOT_INSET_MM = 18;
const TAGGER_VENTS_X_MM = [24, 32, 40, 48, 56];

function TimeTagger({ palette, axis }: ModelProps) {
  const front = -TAGGER_DEPTH_MM / 2;
  const panel = front - TAGGER_PANEL_MM;
  const underside = axis - TAGGER_HALF_MM;
  const footX = TAGGER_DEPTH_MM / 2 - TAGGER_FOOT_INSET_MM;
  const footZ = TAGGER_WIDTH_MM / 2 - TAGGER_FOOT_INSET_MM;
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * footX, underside / 2, sz * footZ]}>
            <cylinderGeometry args={[6, 6, Math.max(1, underside), 20]} />
            <Enamel color="#12161d" />
          </mesh>
        )),
      )}
      <RoundedBox
        args={[TAGGER_DEPTH_MM, 2 * TAGGER_HALF_MM, TAGGER_WIDTH_MM]}
        radius={2}
        smoothness={3}
        position={[0, axis, 0]}
      >
        <Enamel color={palette.anodise} />
      </RoundedBox>
      <mesh position={[front - TAGGER_PANEL_MM / 2, axis, 0]}>
        <boxGeometry args={[TAGGER_PANEL_MM, 2 * TAGGER_HALF_MM - 6, TAGGER_WIDTH_MM - 6]} />
        <Hardware palette={palette} />
      </mesh>
      {Array.from({ length: TAGGER_INPUTS }, (_, index) => {
        const z = TAGGER_ROW_Z_MM + (index - (TAGGER_INPUTS - 1) / 2) * TAGGER_PITCH_MM;
        return (
          <group key={index} position={[panel, axis, z]} rotation={[0, 0, Math.PI / 2]}>
            {/* the bulkhead nut, then the jack */}
            <mesh position={[0, 0.75, 0]}>
              <cylinderGeometry args={[4.2, 4.2, 1.5, 6]} />
              <Stainless palette={palette} />
            </mesh>
            <SmaConnector palette={palette} at={[0, 1.5, 0]} />
          </group>
        );
      })}
      <mesh position={[panel - 0.6, axis, TAGGER_LED_Z_MM]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[2, 2, 1.2, 16]} />
        <Enamel color={TAGGER_LED} />
      </mesh>
      {TAGGER_VENTS_X_MM.map((x) => (
        <mesh key={x} position={[x, axis + TAGGER_HALF_MM + 0.05, 0]}>
          <boxGeometry args={[3, 0.2, TAGGER_WIDTH_MM - 60]} />
          <Enamel color="#12161d" />
        </mesh>
      ))}
    </group>
  );
}

function SelectionRing({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]}>
      <ringGeometry args={[radius, radius + 3, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </mesh>
  );
}

function HoverRing({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 0]}>
      <ringGeometry args={[radius, radius + 1.6, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Small index chip shown on a component while a beam is being drawn. */
function BeamOrderBadge({ order, height }: { order: number; height: number }) {
  // Two things this Html must not do: scale with distance (distanceFactor is a
  // perspective idea — under an orthographic camera it inflates the element to
  // thousands of pixels), and swallow pointer events (drei's wrapper div sits
  // over the canvas and would eat every click meant for a part; the
  // builderHtmlLayer class disables that).
  return (
    <Html
      position={[0, height + 26, 0]}
      center
      zIndexRange={[0, 0]}
      className="builderHtmlLayer"
    >
      <span className="builderOrderBadge">{order}</span>
    </Html>
  );
}

export type ComponentMeshProps = {
  component: BuilderComponent;
  palette: ScenePalette;
  selected: boolean;
  hovered: boolean;
  showLabel: boolean;
  /** draw posts, risers and post adapters (the view's posts toggle) */
  showPosts: boolean;
  /** 1-based position in the beam currently being drawn, if any */
  beamOrder?: number;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (event: ThreeEvent<PointerEvent>) => void;
};

export function ComponentMesh({
  component,
  palette,
  selected,
  hovered,
  showLabel,
  showPosts,
  beamOrder,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}: ComponentMeshProps) {
  const top = componentTop(component);
  const radius = componentRadius(component);
  const [x, axis, z] = component.position;
  const modelProps = useMemo<ModelProps>(
    () => ({ palette, color: component.color, axis }),
    [palette, component.color, axis],
  );

  // Every solid part casts and catches the key light's shadow; glass and the
  // flat selection rings don't (a transmissive optic throwing a solid shadow
  // is exactly the fake look the glass is there to avoid).
  const group = useRef<Group>(null);
  useLayoutEffect(() => {
    group.current?.traverse((object) => {
      if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
      const solid =
        !(object.material instanceof MeshPhysicalMaterial) &&
        !object.material.transparent;
      object.castShadow = solid;
      object.receiveShadow = solid;
    });
  }, [component, showPosts]);

  return (
    <PostsVisible.Provider value={showPosts}>
    <group
      ref={group}
      // the group stands on the table; the model reaches up to its height
      position={[x, 0, z]}
      rotation={[0, (component.rotation * Math.PI) / 180, 0]}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {component.type === "laser-source" ? (
        <LaserSource {...modelProps} />
      ) : null}
      {component.type === "fiber-collimator" ? (
        <FiberCollimator {...modelProps} />
      ) : null}
      {component.type === "mirror-mount" ? (
        <MirrorMount {...modelProps} />
      ) : null}
      {component.type === "beam-splitter" ? (
        <BeamSplitter {...modelProps} />
      ) : null}
      {component.type === "lens" ? (
        <Lens
          {...modelProps}
          shape={component.lensShape ?? "plano-convex"}
          focalLength={component.focalLength ?? DEFAULT_FOCAL_LENGTH_MM}
        />
      ) : null}
      {component.type === "waveplate" ? <Waveplate {...modelProps} /> : null}
      {component.type === "filter" ? <Filter {...modelProps} /> : null}
      {component.type === "iris" ? <Iris {...modelProps} /> : null}
      {component.type === "sample" ? (
        <Sample
          axis={axis}
          color={component.color ?? DEFAULT_SAMPLE_COLOR}
          opacity={component.opacity ?? SAMPLE_OPACITY}
        />
      ) : null}
      {component.type === "paul-trap" ? <PaulTrap {...modelProps} /> : null}
      {component.type === "cavity" ? (
        <Cavity
          {...modelProps}
          length={component.cavityLength ?? DEFAULT_CAVITY_LENGTH_MM}
        />
      ) : null}
      {component.type === "particle" ? (
        <Particle
          axis={axis}
          color={component.color ?? DEFAULT_PARTICLE_COLOR}
          radius={component.particleRadius ?? PARTICLE_RADIUS_MM}
        />
      ) : null}
      {component.type === "photodiode" ? <Photodiode {...modelProps} /> : null}
      {component.type === "beam-block" ? <BeamBlock {...modelProps} /> : null}
      {component.type === "objective" ? <Objective {...modelProps} /> : null}
      {component.type === "block" ? (
        <GenericBlock {...modelProps} size={component.size ?? BLOCK_SIZE_MM} />
      ) : null}
      {component.type === "aom" ? <Aom {...modelProps} /> : null}
      {component.type === "eom" ? <Eom {...modelProps} /> : null}
      {component.type === "camera" ? <CameraBody {...modelProps} /> : null}
      {component.type === "spectrometer" ? (
        <Spectrometer {...modelProps} />
      ) : null}
      {component.type === "single-photon-detector" ? (
        <SinglePhotonDetector {...modelProps} />
      ) : null}
      {component.type === "time-tagger" ? <TimeTagger {...modelProps} /> : null}

      {hovered && !selected ? (
        <HoverRing radius={radius} color={palette.hover} />
      ) : null}
      {selected ? (
        <SelectionRing radius={radius} color={palette.accent} />
      ) : null}
      {beamOrder ? (
        <BeamOrderBadge order={beamOrder} height={axis + top} />
      ) : null}

      {showLabel && !component.host ? (
        <Html
          position={[0, axis + top + 12, 0]}
          center
          zIndexRange={[0, 0]}
          className="builderHtmlLayer"
        >
          <span className={`builderLabel${selected ? " is-selected" : ""}`}>
            {componentDisplayName(component)}
          </span>
        </Html>
      ) : null}
    </group>
    </PostsVisible.Provider>
  );
}
