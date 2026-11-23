import { add, cross, dot, length, normalize, scale, type Vec3 } from "./quaternion.ts";
import type { Complex } from "./jones.ts";

export type Field = [Complex, Complex, Complex];

const complex = (re: number, im = 0): Complex => ({ re, im });
const plus = (a: Complex, b: Complex): Complex => complex(a.re + b.re, a.im + b.im);
const times = (a: Complex, b: Complex): Complex => complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const scaled = (a: Complex, factor: number): Complex => complex(a.re * factor, a.im * factor);
const magnitude2 = (a: Complex): number => a.re * a.re + a.im * a.im;
const phase = (radians: number): Complex => complex(Math.cos(radians), Math.sin(radians));

export function component(field: Field, axis: Vec3): Complex {
  return plus(plus(scaled(field[0], axis[0]), scaled(field[1], axis[1])), scaled(field[2], axis[2]));
}

export function along(axis: Vec3, amplitude: Complex): Field {
  return [scaled(amplitude, axis[0]), scaled(amplitude, axis[1]), scaled(amplitude, axis[2])];
}

function sum(a: Field, b: Field): Field {
  return [plus(a[0], b[0]), plus(a[1], b[1]), plus(a[2], b[2])];
}

function multiply(field: Field, factor: Complex): Field {
  return [times(field[0], factor), times(field[1], factor), times(field[2], factor)];
}

export function norm2(field: Field): number {
  return magnitude2(field[0]) + magnitude2(field[1]) + magnitude2(field[2]);
}

export function normalized(field: Field): Field {
  const value = norm2(field);
  if (!(value > 0)) throw new Error("polarization field must be nonzero");
  return multiply(field, complex(1 / Math.sqrt(value)));
}

export function sourceField(horizontal: Vec3, vertical: Vec3, angleDeg: number): Field {
  const angle = angleDeg * Math.PI / 180;
  return normalized(sum(along(horizontal, complex(Math.cos(angle))), along(vertical, complex(Math.sin(angle)))));
}

function transverseAxis(direction: Vec3, axis: Vec3): Vec3 {
  const projected = add(axis, scale(direction, -dot(axis, direction)));
  return length(projected) > 1e-10 ? normalize(projected) : normalize(cross(direction, Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]));
}

function incidenceAxes(direction: Vec3, normal: Vec3): { s: Vec3; p: Vec3 } {
  const side = cross(direction, normal);
  const s = length(side) > 1e-10 ? normalize(side) : transverseAxis(direction, [0, 1, 0]);
  return { s, p: cross(s, direction) };
}

export function waveplateField(field: Field, direction: Vec3, fastAxis: Vec3, retardanceRad: number): Field {
  const fast = transverseAxis(direction, fastAxis);
  const slow = cross(direction, fast);
  return normalized(sum(
    along(fast, times(component(field, fast), phase(-retardanceRad / 2))),
    along(slow, times(component(field, slow), phase(retardanceRad / 2))),
  ));
}

export function polarizerField(field: Field, direction: Vec3, axis: Vec3): { field: Field | null; fraction: number } {
  const pass = transverseAxis(direction, axis);
  const projected = component(field, pass);
  const fraction = magnitude2(projected);
  return { field: fraction > 1e-12 ? normalized(along(pass, projected)) : null, fraction };
}

export function mirrorField(field: Field, incoming: Vec3, outgoing: Vec3, normal: Vec3, phaseDeg = 0): Field {
  const { s, p } = incidenceAxes(incoming, normal);
  const pOut = cross(s, outgoing);
  const half = phaseDeg * Math.PI / 360;
  return normalized(sum(
    along(s, times(component(field, s), phase(-half))),
    along(pOut, times(component(field, p), phase(half))),
  ));
}

export function pbsFields(field: Field, incoming: Vec3, normal: Vec3): {
  through: { field: Field; fraction: number } | null;
  reflected: { field: Field; fraction: number } | null;
} {
  const { s, p } = incidenceAxes(incoming, normal);
  const sAmplitude = component(field, s);
  const pAmplitude = component(field, p);
  const sPower = magnitude2(sAmplitude);
  const pPower = magnitude2(pAmplitude);
  return {
    through: pPower > 1e-12 ? { field: normalized(along(p, pAmplitude)), fraction: pPower } : null,
    reflected: sPower > 1e-12 ? { field: normalized(along(s, sAmplitude)), fraction: sPower } : null,
  };
}

function turnField(field: Field, axis: Vec3, angle: number): Field {
  const co = Math.cos(angle);
  const si = Math.sin(angle);
  const sideways: Field = [
    plus(scaled(field[2], axis[1]), scaled(field[1], -axis[2])),
    plus(scaled(field[0], axis[2]), scaled(field[2], -axis[0])),
    plus(scaled(field[1], axis[0]), scaled(field[0], -axis[1])),
  ];
  const axial = component(field, axis);
  return normalized([
    plus(plus(scaled(field[0], co), scaled(sideways[0], si)), scaled(axial, axis[0] * (1 - co))),
    plus(plus(scaled(field[1], co), scaled(sideways[1], si)), scaled(axial, axis[1] * (1 - co))),
    plus(plus(scaled(field[2], co), scaled(sideways[2], si)), scaled(axial, axis[2] * (1 - co))),
  ]);
}

export function transportField(field: Field, incoming: Vec3, outgoing: Vec3): Field {
  const turn = cross(incoming, outgoing);
  const sine = length(turn);
  if (sine < 1e-12) return field;
  return turnField(field, scale(turn, 1 / sine), Math.atan2(sine, dot(incoming, outgoing)));
}

export function faradayField(field: Field, direction: Vec3, magneticAxis: Vec3, angleDeg: number): Field {
  // A reverse-going beam gets the opposite angle about its own direction,
  // so both passes rotate in the same lab-frame sense.
  const angle = Math.sign(dot(direction, magneticAxis)) * angleDeg * Math.PI / 180;
  return turnField(field, direction, angle);
}

export function polarizationLabel(field: Field, direction: Vec3): string {
  const vertical = transverseAxis(direction, [0, 1, 0]);
  const horizontal = cross(vertical, direction);
  const h = component(field, horizontal);
  const v = component(field, vertical);
  const hPower = magnitude2(h);
  const vPower = magnitude2(v);
  const circularity = 2 * (h.re * v.im - h.im * v.re);
  if (hPower > 1 - 1e-6) return "horizontal";
  if (vPower > 1 - 1e-6) return "vertical";
  if (Math.abs(circularity) > 1 - 1e-6) return "circular";
  if (Math.abs(circularity) > 1e-6) return "elliptical";
  const diagonal = h.re * v.re + h.im * v.im;
  const angle = Math.atan2(2 * diagonal, hPower - vPower) * 90 / Math.PI;
  return `linear ${Math.round(angle)}°`;
}
