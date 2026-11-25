import type { Field } from "./polarization.ts";
import { cross, dot, length, normalize, scale, add, type Vec3 } from "./quaternion.ts";
import type { TraceResult, TraceSegment } from "./trace-scene.ts";

/**
 * Small polarization marks drawn on the traced guides just before and after
 * each Component: a double arrow for linear light, an ellipse or circle with
 * one arrowhead for elliptical or circular light. Each lies across the beam,
 * in the plane the field oscillates in, so a horizontal mark lies along the
 * table and a vertical one stands up from it.
 */
export type PolarizationShape = "linear" | "elliptical";

/** a mark's width across its widest direction: a sixth of a mirror mount, the least that keeps its arrowheads readable */
export const POLARIZATION_MARK_MM = 8;
/** how far from a Component's surface a mark sits along its guide */
const MARK_OFFSET_MM = 18;
/** below this minor-to-major ratio the light is drawn as linear */
const LINEAR_RATIO = 0.08;
const ELLIPSE_STEPS = 36;
const ARROWHEAD_FRACTION = 0.4;

export type PolarizationEllipse = {
  shape: PolarizationShape;
  /** the field's widest swing, unit length, across the beam */
  major: Vec3;
  /** the swing a quarter period later, scaled by minor/major; zero for linear light */
  minor: Vec3;
};

const re = (field: Field): Vec3 => [field[0].re, field[1].re, field[2].re];
const im = (field: Field): Vec3 => [field[0].im, field[1].im, field[2].im];

/**
 * The ellipse the real field traces, E(t) = Re(E e^{-iωt}) = a cos ωt + b sin ωt,
 * the sign convention polarization.ts uses (a slow axis gains phase). `major`
 * then `minor` follow the field's turning sense.
 */
export function polarizationEllipse(field: Field): PolarizationEllipse | null {
  const a = re(field);
  const b = im(field);
  const theta = 0.5 * Math.atan2(2 * dot(a, b), dot(a, a) - dot(b, b));
  const along = (angle: number): Vec3 => add(scale(a, Math.cos(angle)), scale(b, Math.sin(angle)));
  const major = along(theta);
  const minor = along(theta + Math.PI / 2);
  const majorLength = length(major);
  if (!(majorLength > 1e-9)) return null;
  const ratio = length(minor) / majorLength;
  if (ratio < LINEAR_RATIO) return { shape: "linear", major: scale(major, 1 / majorLength), minor: [0, 0, 0] };
  return { shape: "elliptical", major: scale(major, 1 / majorLength), minor: scale(minor, 1 / majorLength) };
}

/** Line-segment pairs, in mm, drawing one mark centred on `centre`. */
export function polarizationMarkSegments(ellipse: PolarizationEllipse, centre: Vec3, direction: Vec3, sizeMm = POLARIZATION_MARK_MM): Vec3[] {
  const half = sizeMm / 2;
  const at = (offset: Vec3): Vec3 => add(centre, scale(offset, half));
  const points: Vec3[] = [];
  const segment = (from: Vec3, to: Vec3) => points.push(at(from), at(to));
  const head = ARROWHEAD_FRACTION;

  if (ellipse.shape === "linear") {
    const u = ellipse.major;
    const side = normalize(cross(direction, u));
    segment(scale(u, -1), u);
    for (const end of [1, -1]) {
      const tip = scale(u, end);
      const back = add(tip, scale(u, -end * head));
      segment(tip, add(back, scale(side, head * 0.6)));
      segment(tip, add(back, scale(side, -head * 0.6)));
    }
    return points;
  }

  const { major, minor } = ellipse;
  const on = (angle: number): Vec3 => add(scale(major, Math.cos(angle)), scale(minor, Math.sin(angle)));
  for (let step = 0; step < ELLIPSE_STEPS; step++) {
    segment(on((2 * Math.PI * step) / ELLIPSE_STEPS), on((2 * Math.PI * (step + 1)) / ELLIPSE_STEPS));
  }
  // the arrowhead at the end of the major axis, pointing the way the field turns
  const tip = on(0);
  const tangent = normalize(minor);
  const outward = major;
  const back = add(tip, scale(tangent, -head));
  segment(tip, add(back, scale(outward, head * 0.55)));
  segment(tip, add(back, scale(outward, -head * 0.55)));
  return points;
}

export type PolarizationMarkGeometry = { positions: Float32Array; laserIds: string[] };

/**
 * Marks where light leaves and where it meets a Component, from each traced
 * segment's field. `skip` leaves out segments that are not drawn, such as a
 * hidden Beam's.
 */
export function polarizationMarkGeometry(trace: TraceResult, skip: (segment: TraceSegment) => boolean = () => false): PolarizationMarkGeometry {
  const positions: number[] = [];
  const laserIds: string[] = [];
  for (const tree of trace.trees) {
    for (const segment of tree.segments) {
      if (!segment.field || skip(segment)) continue;
      const delta: Vec3 = [segment.toMm[0] - segment.fromMm[0], segment.toMm[1] - segment.fromMm[1], segment.toMm[2] - segment.fromMm[2]];
      const span = length(delta);
      if (!(span > 0)) continue;
      const ellipse = polarizationEllipse(segment.field);
      if (!ellipse) continue;
      const direction = scale(delta, 1 / span);
      const offset = Math.min(MARK_OFFSET_MM, span / 3);
      const centres: Vec3[] = [add(segment.fromMm, scale(direction, offset))];
      if (segment.toId) centres.push(add(segment.toMm, scale(direction, -offset)));
      for (const centre of centres) {
        for (const point of polarizationMarkSegments(ellipse, centre, direction)) {
          positions.push(...point);
          laserIds.push(tree.laserId);
        }
      }
    }
  }
  return { positions: new Float32Array(positions), laserIds };
}
