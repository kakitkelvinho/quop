import {
  delaySetting,
  fieldValue,
  lengthToPicoseconds,
  referencePoint,
  type Beam,
  type BuilderComponent,
  type Vec3,
} from "./types.ts";

export type BeamMeasurement = {
  points: Vec3[];
  legLengthsMm: number[];
  lengthMm: number;
  timeOfFlightPs: number;
  laserInternalMm: number;
  delayLineMm: number;
};

type ResolvedStop = { component: BuilderComponent; pathIndex: number };

/** Resolve the ordered stops once, retaining path positions for internal paths. */
function resolveStops(components: BuilderComponent[], path: string[]): ResolvedStop[] {
  const byId = new Map(components.map((component) => [component.id, component]));
  return path.flatMap((id, pathIndex) => {
    const component = byId.get(id);
    return component ? [{ component, pathIndex }] : [];
  });
}

/** Reference points for an unfinished Beam draft, which has no saved Beam yet. */
export function beamPoints(components: BuilderComponent[], path: string[]): Vec3[] {
  return resolveStops(components, path).map(({ component }) => referencePoint(component));
}

/** Measure a saved Beam's path, internal distances, leg labels and flight time. */
export function measureBeam(components: BuilderComponent[], beam: Beam): BeamMeasurement {
  const stops = resolveStops(components, beam.path);
  const points = stops.map(({ component }) => referencePoint(component));
  const first = stops[0];
  const laserInternalMm = first?.pathIndex === 0 && first.component.type === "laser-source"
    ? fieldValue(first.component, "internalPathMm") : 0;
  let delayLineMm = 0;
  let straightMm = 0;
  const legLengthsMm: number[] = [];

  for (let index = 0; index < stops.length; index += 1) {
    const { component, pathIndex } = stops[index];
    const interiorDelay = pathIndex > 0 && pathIndex < beam.path.length - 1 && component.type === "delay-line";
    const setting = interiorDelay ? delaySetting(component) : undefined;
    if (setting) delayLineMm += setting.path;
    if (index === 0) continue;

    const [ax, ay, az] = points[index - 1];
    const [bx, by, bz] = points[index];
    const distance = Math.hypot(bx - ax, by - ay, bz - az);
    straightMm += distance;
    // Labels use surviving points, even when a missing stop shortens the drawn path.
    const labelDelay = index < stops.length - 1 && component.type === "delay-line"
      ? (setting ?? delaySetting(component)).minPath : 0;
    legLengthsMm.push(distance + labelDelay);
  }

  const lengthMm = straightMm + laserInternalMm + delayLineMm;
  return {
    points,
    legLengthsMm,
    lengthMm,
    timeOfFlightPs: lengthToPicoseconds(lengthMm),
    laserInternalMm,
    delayLineMm,
  };
}
