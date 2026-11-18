/**
 * Vectors and unit quaternions for a Component's orientation (ADR 0002, #358).
 * Pure: no React, no three.js, so the beam trace can run it off the main thread.
 *
 * Axes are the table's: y is up, and a part's optical axis is its local x.
 * Yaw, pitch and roll are applied in that order (Euler order YZX, as three.js
 * names it): yaw turns about the table vertical, pitch about the part's own z,
 * which tips its optical axis up or down, and roll about its optical axis.
 * Order YXZ would make the second angle a turn about the beam itself.
 */

export type Vec3 = [x: number, y: number, z: number];
export type Quat = [x: number, y: number, z: number, w: number];

export type YawPitchRoll = { yawDeg: number; pitchDeg: number; rollDeg: number };

export const IDENTITY: Quat = [0, 0, 0, 1];

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale(v: Vec3, k: number): Vec3 {
  return [k * v[0], k * v[1], k * v[2]];
}

export function length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  if (len === 0) throw new Error("cannot normalize a zero vector");
  return scale(v, 1 / len);
}

/**
 * The stored form of a rotation: unit length, with w ≥ 0. q and −q are the
 * same rotation; picking one keeps a Setup saved twice byte-identical.
 */
export function canonical(q: Quat): Quat {
  const [x, y, z, w] = q;
  const len = Math.hypot(x, y, z, w);
  if (len === 0 || !Number.isFinite(len)) throw new Error("not a rotation: " + JSON.stringify(q));
  let sign = w < 0 ? -1 : 1;
  if (w === 0) {
    // A half turn has w = 0, so q and −q need another rule to store the same.
    const first = x !== 0 ? x : y !== 0 ? y : z;
    if (first < 0) sign = -1;
  }
  // A value already stored as unit length must survive a second parse byte for
  // byte; re-normalising it can change the final bit of a component.
  const k = Math.abs(len - 1) < 1e-12 ? sign : sign / len;
  // + 0 turns −0 into 0: deepStrictEqual tells them apart.
  return [x * k + 0, y * k + 0, z * k + 0, w * k + 0];
}

/** The rotation that applies `second` after `first` (the Hamilton product second ⊗ first). */
export function compose(second: Quat, first: Quat): Quat {
  const [ax, ay, az, aw] = second;
  const [bx, by, bz, bw] = first;
  return canonical([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]);
}

export function invert(q: Quat): Quat {
  return canonical([-q[0], -q[1], -q[2], q[3]]);
}

/** v turned by q: q v q*. */
export function rotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, q[3])), cross(u, t));
}

function turnAbout(axis: 0 | 1 | 2, degrees: number): Quat {
  const half = (degrees * Math.PI) / 360;
  const q: Quat = [0, 0, 0, Math.cos(half)];
  q[axis] = Math.sin(half);
  return q;
}

/** A turn about the table vertical; yaw 90 takes local +x to world −z, as `rotation` always has. */
export function fromYawDeg(yawDeg: number): Quat {
  return canonical(turnAbout(1, yawDeg));
}

export function fromYawPitchRollDeg({ yawDeg, pitchDeg, rollDeg }: YawPitchRoll): Quat {
  return compose(compose(turnAbout(1, yawDeg), turnAbout(2, pitchDeg)), turnAbout(0, rollDeg));
}

/**
 * Yaw in [0, 360), pitch in [−90, 90], roll in (−180, 180]. Pointing straight up
 * or down, yaw and roll turn about the same line and can't be told apart: roll
 * is then 0 and the whole turn is yaw.
 */
export function toYawPitchRollDeg(q: Quat): YawPitchRoll {
  const [x, y, z, w] = canonical(q);
  const m11 = 1 - 2 * (y * y + z * z);
  const m13 = 2 * (x * z + y * w);
  const m21 = 2 * (x * y + z * w);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - x * w);
  const m31 = 2 * (x * z - y * w);
  const m33 = 1 - 2 * (x * x + y * y);
  const locked = Math.abs(m21) >= 1 - 1e-12;
  // asin(m21) loses half its digits near ±1; atan2 against the axis's level reach doesn't.
  const pitch = locked ? Math.sign(m21) * (Math.PI / 2) : Math.atan2(m21, Math.hypot(m11, m31));
  const yaw = locked ? Math.atan2(m13, m33) : Math.atan2(-m31, m11);
  const roll = locked ? 0 : Math.atan2(-m23, m22);
  return { yawDeg: wrapDeg360(degrees(yaw)), pitchDeg: degrees(pitch) + 0, rollDeg: wrapDeg180(degrees(roll)) };
}

/** Inspector angles in three.js Euler order YXZ: yaw about table Y. */
export function fromEulerYXZDeg({ yawDeg, pitchDeg, rollDeg }: YawPitchRoll): Quat {
  return compose(compose(turnAbout(1, yawDeg), turnAbout(0, pitchDeg)), turnAbout(2, rollDeg));
}

export function toEulerYXZDeg(q: Quat): YawPitchRoll {
  const [x, y, z, w] = canonical(q);
  const m11 = 1 - 2 * (y * y + z * z);
  const m13 = 2 * (x * z + y * w);
  const m21 = 2 * (x * y + z * w);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - x * w);
  const m31 = 2 * (x * z - y * w);
  const m33 = 1 - 2 * (x * x + y * y);
  const locked = Math.abs(m23) >= 1 - 1e-12;
  const pitch = Math.asin(Math.max(-1, Math.min(1, -m23)));
  const yaw = locked ? Math.atan2(-m31, m11) : Math.atan2(m13, m33);
  const roll = locked ? 0 : Math.atan2(m21, m22);
  return { yawDeg: wrapDeg360(degrees(yaw)), pitchDeg: degrees(pitch) + 0, rollDeg: wrapDeg180(degrees(roll)) };
}

function degrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function wrapDeg360(deg: number): number {
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped === 360 ? 0 : wrapped + 0;
}

function wrapDeg180(deg: number): number {
  const wrapped = wrapDeg360(deg);
  return wrapped > 180 ? wrapped - 360 : wrapped;
}
