// Paraxial ray-transfer (ABCD) matrices for the detection path.
// A ray is (x, θ): height in metres, angle in radians. All lengths are metres.
// The output ray is [[A, B], [C, D]] · (x, θ): A and D are dimensionless,
// B is in metres, C in 1/metres.

export type RayMatrix = { A: number; B: number; C: number; D: number };

/** One step along the beam: a thin lens (focal length f, m) or free space (length d, m). */
export type RelayElement = { kind: "lens"; f: number } | { kind: "space"; d: number };

export const IDENTITY: RayMatrix = { A: 1, B: 0, C: 0, D: 1 };

/** Free space of length d (m). */
export function freeSpace(d: number): RayMatrix {
  return { A: 1, B: d, C: 0, D: 1 };
}

/** Thin lens of focal length f (m); positive converges. f = ±Infinity is a flat window. */
export function thinLens(f: number): RayMatrix {
  if (f === 0 || Number.isNaN(f)) throw new RangeError(`focal length must be non-zero, got ${f}`);
  return { A: 1, B: 0, C: -1 / f, D: 1 };
}

/** `second · first`: the system that applies `first`, then `second`. */
export function multiply(second: RayMatrix, first: RayMatrix): RayMatrix {
  return {
    A: second.A * first.A + second.B * first.C,
    B: second.A * first.B + second.B * first.D,
    C: second.C * first.A + second.D * first.C,
    D: second.C * first.B + second.D * first.D,
  };
}

/** Compose matrices given in beam order (first met first) into one system matrix. */
export function compose(matrices: readonly RayMatrix[]): RayMatrix {
  return matrices.reduce((system, m) => multiply(m, system), IDENTITY);
}

export function elementMatrix(element: RelayElement): RayMatrix {
  return element.kind === "lens" ? thinLens(element.f) : freeSpace(element.d);
}

export function determinant(m: RayMatrix): number {
  return m.A * m.D - m.B * m.C;
}

/**
 * What the output plane is, relative to the input plane.
 * - image: B = 0, every point maps to a point; x_out = magnification · x_in.
 * - fourier: A = 0, every angle maps to a point; x_out = scale · θ_in (scale in m/rad).
 * - neither.
 * Every case also reports how much extra free space after the system (m) would
 * make B or A zero: appending space δ gives B' = B + δD and A' = A + δC, so
 * imageDefocus = −B/D and fourierDefocus = −A/C. Positive means the plane lies
 * past the output plane. null when no amount of space reaches it (D = 0 or C = 0).
 */
export type Classification =
  | { kind: "image"; magnification: number; imageDefocus: number; fourierDefocus: number | null }
  | { kind: "fourier"; scale: number; imageDefocus: number | null; fourierDefocus: number }
  | { kind: "neither"; imageDefocus: number | null; fourierDefocus: number | null };

export type ClassifyOptions = {
  /** Length that sets what "zero" means, m. Default 1 m; relayFromPath uses the path's own size. */
  lengthScale?: number;
  /** Relative tolerance. Default 1e-9. */
  tolerance?: number;
};

export const DEFAULT_TOLERANCE = 1e-9;

/**
 * Classify the output plane. B (or A) counts as zero when the defocus needed to
 * zero it, |B/D| (or |A/C|), is within tolerance · lengthScale. Measuring it as a
 * distance makes the test independent of units and of the system's magnification.
 * If both hold (only in extreme systems), the smaller defocus wins.
 */
export function classify(m: RayMatrix, options: ClassifyOptions = {}): Classification {
  const lengthScale = options.lengthScale ?? 1;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const limit = tolerance * Math.abs(lengthScale);

  const imageDefocus = m.D === 0 ? null : -m.B / m.D;
  const fourierDefocus = m.C === 0 ? null : -m.A / m.C;
  // An exactly-zero entry is zero however the other one is.
  const isImage = m.B === 0 || (imageDefocus !== null && Math.abs(imageDefocus) <= limit);
  const isFourier = m.A === 0 || (fourierDefocus !== null && Math.abs(fourierDefocus) <= limit);

  const imageFirst = isImage && (!isFourier || Math.abs(imageDefocus ?? 0) <= Math.abs(fourierDefocus ?? 0));
  if (imageFirst) return { kind: "image", magnification: m.A, imageDefocus: imageDefocus ?? 0, fourierDefocus };
  if (isFourier) return { kind: "fourier", scale: m.B, imageDefocus, fourierDefocus: fourierDefocus ?? 0 };
  return { kind: "neither", imageDefocus, fourierDefocus };
}

/** Size of a path for the zero tolerance: total |d| plus total finite |f|, m. */
export function pathLengthScale(elements: readonly RelayElement[]): number {
  let total = 0;
  for (const e of elements) {
    const v = e.kind === "lens" ? e.f : e.d;
    if (Number.isFinite(v)) total += Math.abs(v);
  }
  return total > 0 ? total : 1;
}

/**
 * The system matrix of lenses and spaces in beam order (lengths in metres) and
 * what its output plane is. Spaces are distances between reference points.
 */
export function relayFromPath(
  elements: readonly RelayElement[],
  options: { tolerance?: number } = {},
): { matrix: RayMatrix; classification: Classification } {
  const matrix = compose(elements.map(elementMatrix));
  const classification = classify(matrix, { lengthScale: pathLengthScale(elements), tolerance: options.tolerance });
  return { matrix, classification };
}

/**
 * Largest emission angle (rad, measured in the sample's medium) the objective
 * collects: NA = n·sin θ, so θ_max = asin(NA / n). n is the immersion index,
 * 1 for an objective in air. NA must lie in [0, n].
 */
export function maxEmissionAngle(numericalAperture: number, immersionIndex = 1): number {
  if (!(immersionIndex > 0)) throw new RangeError(`immersion index must be positive, got ${immersionIndex}`);
  if (!(numericalAperture >= 0 && numericalAperture <= immersionIndex)) {
    throw new RangeError(`NA must be in [0, ${immersionIndex}], got ${numericalAperture}`);
  }
  return Math.asin(numericalAperture / immersionIndex);
}

/** Whether a ray at angle θ (rad, in the sample's medium) gets through the objective's aperture. */
export function passesAperture(theta: number, numericalAperture: number, immersionIndex = 1): boolean {
  return Math.abs(theta) <= maxEmissionAngle(numericalAperture, immersionIndex);
}
