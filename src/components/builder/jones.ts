/**
 * Jones matrices for polarization (ADR 0002, #359). The tracer carries the
 * equivalent complex field in table coordinates, which stays transverse through
 * 3D turns; these matrices state the local waveplate convention and its laws.
 */

export type Complex = { re: number; im: number };
export type Jones = [[Complex, Complex], [Complex, Complex]];

const c = (re: number, im = 0): Complex => ({ re, im });

function mul(p: Complex, q: Complex): Complex {
  return c(p.re * q.re - p.im * q.im, p.re * q.im + p.im * q.re);
}

function addC(p: Complex, q: Complex): Complex {
  return c(p.re + q.re, p.im + q.im);
}

export const IDENTITY_JONES: Jones = [
  [c(1), c(0)],
  [c(0), c(1)],
];

export function multiplyJones(second: Jones, first: Jones): Jones {
  const entry = (row: 0 | 1, col: 0 | 1) => addC(mul(second[row][0], first[0][col]), mul(second[row][1], first[1][col]));
  return [
    [entry(0, 0), entry(0, 1)],
    [entry(1, 0), entry(1, 1)],
  ];
}

/** The conjugate transpose J†. */
export function adjoint(j: Jones): Jones {
  const conj = (z: Complex) => c(z.re, -z.im);
  return [
    [conj(j[0][0]), conj(j[1][0])],
    [conj(j[0][1]), conj(j[1][1])],
  ];
}

/** A turn of the polarisation plane by theta, which is what a Faraday rotator does. */
export function rotator(thetaRad: number): Jones {
  const cos = Math.cos(thetaRad);
  const sin = Math.sin(thetaRad);
  return [
    [c(cos), c(-sin)],
    [c(sin), c(cos)],
  ];
}

/** A waveplate with fast axis at theta and a phase delay of retardance between its axes (π/2 quarter-wave, π half-wave). */
export function waveplate(retardanceRad: number, thetaRad: number): Jones {
  const phase = (angle: number) => c(Math.cos(angle), Math.sin(angle));
  const axes: Jones = [
    [phase(-retardanceRad / 2), c(0)],
    [c(0), phase(retardanceRad / 2)],
  ];
  return multiplyJones(rotator(thetaRad), multiplyJones(axes, rotator(-thetaRad)));
}
