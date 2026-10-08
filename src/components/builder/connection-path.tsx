"use client";

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

import { FIBER_STUBS } from "@/components/builder/component-models";
import {
  CONNECTION_KINDS,
  componentById,
  componentRadius,
  type BuilderComponent,
  type Connection,
  type ConnectionKind,
} from "@/components/builder/types";

const UP = new Vector3(0, 1, 0);
/** how much wider than the drawn tube a click may land and still pick it, mm */
const HIT_RADIUS_MM = 5;

/**
 * One end of a connection, from where it leaves its part down to where it
 * lands on the table, world mm. A fibre at a part with its own fibre stub
 * follows that stub. Anything else comes out of the part's side facing the
 * other end, droops and drops to the table, the way the stub does; between
 * two close parts the drop is squeezed so the landings never pass each other.
 */
function endPoints(part: BuilderComponent, other: BuilderComponent, kind: ConnectionKind, rest: number): Vector3[] {
  const [x, height, z] = part.position;
  const stub = CONNECTION_KINDS[kind].usesFiberStub ? FIBER_STUBS[part.type] : undefined;
  if (stub) {
    const yaw = (part.rotation * Math.PI) / 180;
    return stub(height).points.map((point) => point.clone().applyAxisAngle(UP, yaw).add(new Vector3(x, 0, z)));
  }

  const out = new Vector3(other.position[0] - x, 0, other.position[2] - z);
  const apart = out.length();
  if (apart < 1e-6) out.set(1, 0, 0);
  out.normalize();
  const reach = componentRadius(part) * 0.8;
  const squeeze = Math.min(1, (0.4 * apart) / (reach + 64));
  const along = (distance: number, y: number) => new Vector3(x, y, z).addScaledVector(out, distance * squeeze);
  return [
    along(0, height),
    along(reach, height - 3),
    along(reach + 16, height * 0.75),
    along(reach + 26, height * 0.4),
    along(reach + 36, Math.min(height, rest + 3)),
    along(reach + 64, rest),
  ];
}

/** The way an end's last stretch heads along the table, away from its part. */
function heading(points: Vector3[]): Vector3 {
  const direction = new Vector3().subVectors(points[points.length - 1], points[points.length - 2]).setY(0);
  return direction.lengthSq() < 1e-9 ? direction.set(1, 0, 0) : direction.normalize();
}

/**
 * The run along the table between the two landings: a Hermite curve that
 * leaves each landing the way its end was heading, so a cable that lands
 * facing away from the other part turns round in a wide bend instead of a
 * kink, bowed a little to one side so it lies loose rather than ruled.
 */
function tableRun(landA: Vector3, headA: Vector3, landB: Vector3, headB: Vector3, rest: number): Vector3[] {
  const span = new Vector3().subVectors(landB, landA).setY(0);
  const distance = span.length();
  if (distance < 1) return [];
  // never tighter than a fibre's bend, however close the landings
  const pull = Math.min(Math.max(distance * 0.6, 120), 300);
  const side = new Vector3(-span.z, 0, span.x).divideScalar(distance);
  const bow = Math.min(distance * 0.06, 30);
  const steps = Math.max(8, Math.round(distance / 10));
  const points: Vector3[] = [];
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    points.push(
      new Vector3()
        .addScaledVector(landA, 2 * t3 - 3 * t2 + 1)
        .addScaledVector(headA, pull * (t3 - 2 * t2 + t))
        .addScaledVector(landB, -2 * t3 + 3 * t2)
        // B's heading points away from B; the run arrives against it
        .addScaledVector(headB, -pull * (t3 - t2))
        .addScaledVector(side, bow * Math.sin(Math.PI * t))
        .setY(rest),
    );
  }
  return points;
}

/**
 * The route a fibre or cable takes: out of one part, down to the table, along
 * it, and up into the other. Where the spline would dip below the table it is
 * held on it, so the run between the parts rests on the table.
 */
export function connectionCurve(
  from: BuilderComponent,
  to: BuilderComponent,
  kind: ConnectionKind,
): CatmullRomCurve3 {
  const rest = CONNECTION_KINDS[kind].radius + 0.2;
  const start = endPoints(from, to, kind, rest);
  const end = endPoints(to, from, kind, rest);
  const table = tableRun(start[start.length - 1], heading(start), end[end.length - 1], heading(end), rest);

  const route = new CatmullRomCurve3([...start, ...table, ...end.reverse()], false, "centripetal");
  const samples = route.getSpacedPoints(Math.max(64, Math.round(route.getLength() / 6)));
  for (const point of samples) point.y = Math.max(point.y, rest);
  return new CatmullRomCurve3(samples, false, "centripetal");
}

/**
 * A connection drawn as a tube resting on the table: no arrows and no glow,
 * which is what tells it apart from a beam. A selected one is drawn thicker.
 * Its label, if it has one, sits at the middle of the run.
 */
export function ConnectionPath({
  connection,
  components,
  selected,
  showLabel,
  onPointerDown,
}: {
  connection: Connection;
  components: BuilderComponent[];
  selected: boolean;
  showLabel: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const from = componentById(components, connection.from);
  const to = componentById(components, connection.to);
  const { kind } = connection;
  const curve = useMemo(() => (from && to ? connectionCurve(from, to, kind) : null), [from, to, kind]);
  const middle = useMemo(() => curve?.getPointAt(0.5), [curve]);
  if (!curve || !middle) return null;

  const { radius } = CONNECTION_KINDS[kind];
  const segments = Math.max(64, Math.round(curve.getLength() / 4));
  const label = connection.label?.trim();

  return (
    <group>
      <mesh castShadow receiveShadow raycast={() => null}>
        <tubeGeometry args={[curve, segments, selected ? radius * 1.6 : radius, 12]} />
        <meshStandardMaterial color={connection.color} roughness={0.42} metalness={0} />
      </mesh>
      {/* a fatter, unseen tube catches the click: the drawn one is a few pixels wide */}
      <mesh onPointerDown={onPointerDown}>
        <tubeGeometry args={[curve, Math.round(segments / 2), HIT_RADIUS_MM, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {showLabel && label ? (
        <Html position={[middle.x, middle.y + 4, middle.z]} center zIndexRange={[0, 0]} className="builderHtmlLayer">
          <span className={`builderLabel${selected ? " is-selected" : ""}`}>{label}</span>
        </Html>
      ) : null}
    </group>
  );
}
