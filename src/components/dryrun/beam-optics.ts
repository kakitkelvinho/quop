// Reads the optics of one beam of a Tabletop setup for the Dry Run: the run
// from the sample to the spectrometer's entrance slit, as ray matrices, and
// what the slit sees of the sample (its image, its Fourier plane, or neither).
// Prototype for #341. SI units out (m, rad); the setup is in mm.
//
// Assumptions, said plainly in the page:
// - The sample sits at the objective's front focus, so the drawn distance
//   from the sample to the objective is replaced by the objective's focal
//   length. A setup file does not give an objective a focal length, so it is
//   one of the Dry Run's own parameters.
// - Every other leg is the drawn distance between reference points. Lenses act
//   as thin lenses of their focal length; mirrors, beam cubes, filters,
//   waveplates and irises pass the light on unchanged.

import {
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  componentById,
  fieldValue,
} from "../builder/types.ts";
import { type Classification, type RelayElement, relayFromPath } from "../simulator/ray-transfer.ts";

/** Parts the light passes without being imaged or redirected in a way that matters here. */
const PASS_THROUGH: ReadonlySet<ComponentType> = new Set([
  "mirror-mount",
  "beam-splitter",
  "filter",
  "waveplate",
  "iris",
  "periscope",
  "periscope-top",
]);

export type BeamOpticsOptions = {
  /** Objective focal length, m. */
  objectiveFocalLength: number;
  /**
   * How close (m) the slit must be to an image or Fourier plane to count as
   * one. Drawn setups are placed by hand to the millimetre. Default 2 mm.
   */
  planeTolerance?: number;
};

export type BeamStop = { id: string; type: ComponentType; label: string };

export type BeamOptics =
  | {
      ok: true;
      /** Sample to spectrometer, inclusive, in the order the light goes. */
      stops: BeamStop[];
      elements: RelayElement[];
      classification: Classification;
    }
  | { ok: false; reason: string };

/** A part's name for the page: its label, or its kind and id. */
export function stopName(component: BuilderComponent): string {
  return component.label?.trim() || `${component.type.replace(/-/g, " ")} (${component.id})`;
}

/** A one-line name for a beam: its label, or its first and last stops. */
export function beamName(scene: BuilderSceneData, beam: Beam): string {
  if (beam.label?.trim()) return beam.label.trim();
  const ends = [beam.path[0], beam.path[beam.path.length - 1]]
    .map((id) => componentById(scene.components, id))
    .map((component) => (component ? stopName(component) : "?"));
  return `${ends[0]} → ${ends[1]}`;
}

/**
 * The optics from the sample to the spectrometer along `beam`, or the plain
 * reason there is nothing to simulate. The beam may be drawn either way round.
 */
export function beamOptics(scene: BuilderSceneData, beam: Beam, options: BeamOpticsOptions): BeamOptics {
  const stops = beam.path
    .map((id) => componentById(scene.components, id))
    .filter((component): component is BuilderComponent => Boolean(component));
  const samples = stops.flatMap((component, index) => (component.type === "sample" ? [index] : []));
  const spectrometers = stops.flatMap((component, index) => (component.type === "spectrometer" ? [index] : []));
  if (samples.length === 0 && spectrometers.length === 0) {
    return { ok: false, reason: "This beam passes no sample and reaches no spectrometer, so there is nothing to simulate on it." };
  }
  if (samples.length === 0) return { ok: false, reason: "This beam has no sample on it: there is nothing to leak light into it." };
  if (spectrometers.length === 0) return { ok: false, reason: "This beam reaches no spectrometer, so no capture can be taken along it." };

  // The shortest run from a sample to a spectrometer, whichever way round it is drawn.
  let best: [number, number] | null = null;
  for (const s of samples) {
    for (const d of spectrometers) {
      if (!best || Math.abs(d - s) < Math.abs(best[1] - best[0])) best = [s, d];
    }
  }
  const [from, to] = best!;
  const run = from < to ? stops.slice(from, to + 1) : stops.slice(to, from + 1).reverse();

  const objectives = run.filter((component) => component.type === "objective");
  if (objectives.length === 0) {
    return { ok: false, reason: "There is no objective between the sample and the spectrometer, so no leakage is collected." };
  }
  if (run[1].type !== "objective") {
    return {
      ok: false,
      reason: `The first part after the sample is ${stopName(run[1])}, not an objective. The Dry Run needs the objective to collect the leakage first.`,
    };
  }
  const blocker = run.slice(1, -1).find((component) => !PASS_THROUGH.has(component.type) && component.type !== "lens" && component.type !== "objective");
  if (blocker) {
    return {
      ok: false,
      reason: `${stopName(blocker)} (a ${blocker.type.replace(/-/g, " ")}) sits between the sample and the spectrometer, and the Dry Run cannot pass light through it.`,
    };
  }
  if (objectives.length > 1) {
    return { ok: false, reason: "There is more than one objective between the sample and the spectrometer; the Dry Run handles one." };
  }

  const fObj = options.objectiveFocalLength;
  const elements: RelayElement[] = [{ kind: "space", d: fObj }, { kind: "lens", f: fObj }];
  let gap = 0;
  for (let index = 2; index < run.length; index += 1) {
    const [ax, ay, az] = run[index - 1].position;
    const [bx, by, bz] = run[index].position;
    gap += Math.hypot(bx - ax, by - ay, bz - az) / 1000;
    const component = run[index];
    if (component.type === "lens") {
      elements.push({ kind: "space", d: gap }, { kind: "lens", f: fieldValue(component, "focalLength") / 1000 });
      gap = 0;
    }
  }
  elements.push({ kind: "space", d: gap });

  const { matrix, classification: strict } = relayFromPath(elements);
  // Loosen "is a plane" to a distance a hand-placed setup can hit.
  const tolerance = options.planeTolerance ?? 2e-3;
  let classification: Classification = strict;
  if (strict.kind === "neither") {
    const { imageDefocus, fourierDefocus } = strict;
    const nearImage = imageDefocus !== null && Math.abs(imageDefocus) <= tolerance;
    const nearFourier = fourierDefocus !== null && Math.abs(fourierDefocus) <= tolerance;
    if (nearFourier && (!nearImage || Math.abs(fourierDefocus!) <= Math.abs(imageDefocus!))) {
      classification = { kind: "fourier", scale: matrix.B + fourierDefocus! * matrix.D, imageDefocus, fourierDefocus: fourierDefocus! };
    } else if (nearImage) {
      classification = { kind: "image", magnification: matrix.A + imageDefocus! * matrix.C, imageDefocus: imageDefocus!, fourierDefocus };
    }
  }

  return {
    ok: true,
    stops: run.map((component) => ({ id: component.id, type: component.type, label: stopName(component) })),
    elements,
    classification,
  };
}
