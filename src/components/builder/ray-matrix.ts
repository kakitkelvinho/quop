/**
 * Ray-transfer (ABCD) matrices for the paraxial trace (ADR 0002, #359).
 * Acts on (height y, slope θ). When the index changes across an element,
 * det = n₁/n₂, which is 1 in air.
 */

export type RayMatrix = { a: number; b: number; c: number; d: number };

export function multiply(second: RayMatrix, first: RayMatrix): RayMatrix {
  return {
    a: second.a * first.a + second.b * first.c,
    b: second.a * first.b + second.b * first.d,
    c: second.c * first.a + second.d * first.c,
    d: second.c * first.b + second.d * first.d,
  };
}

export function determinant(m: RayMatrix): number {
  return m.a * m.d - m.b * m.c;
}

export function freeSpace(distanceMm: number): RayMatrix {
  return { a: 1, b: distanceMm, c: 0, d: 1 };
}

export function thinLens(focalLengthMm: number): RayMatrix {
  return { a: 1, b: 0, c: -1 / focalLengthMm, d: 1 };
}

/** A flat boundary from index n₁ into n₂. */
export function flatInterface(n1: number, n2: number): RayMatrix {
  return { a: 1, b: 0, c: 0, d: n1 / n2 };
}

/** A boundary of radius R (positive when its centre lies beyond it) from index n₁ into n₂. */
export function curvedInterface(n1: number, n2: number, radiusMm: number): RayMatrix {
  return { a: 1, b: 0, c: (n1 - n2) / (n2 * radiusMm), d: n1 / n2 };
}
