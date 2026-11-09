import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type RayMatrix,
  type RelayElement,
  classify,
  compose,
  determinant,
  freeSpace,
  maxEmissionAngle,
  passesAperture,
  relayFromPath,
  thinLens,
} from "./ray-transfer.ts";

// Paraxial ABCD matrices for the detection path, in metres and radians.

const mm = 1e-3;
const near = (actual: number, expected: number, eps = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
const lens = (f: number): RelayElement => ({ kind: "lens", f });
const space = (d: number): RelayElement => ({ kind: "space", d });

// Every case below, for the det M = 1 check at the end.
const paths: RelayElement[][] = [];
const track = (path: RelayElement[]) => (paths.push(path), relayFromPath(path));

describe("compose", () => {
  it("applies matrices in beam order", () => {
    // Space then lens: a ray at height 0, angle 1 rises to d, then bends by -d/f.
    const m = compose([freeSpace(0.2), thinLens(0.1)]);
    assert.deepEqual(m, { A: 1, B: 0.2, C: -10, D: -1 });
  });

  it("is the identity for an empty path", () => {
    assert.deepEqual(compose([]), { A: 1, B: 0, C: 0, D: 1 });
  });

  it("rejects a zero focal length", () => {
    assert.throws(() => thinLens(0), RangeError);
  });
});

describe("relayFromPath", () => {
  it("images through a 4f relay with magnification -f2/f1", () => {
    const f1 = 50 * mm;
    const f2 = 200 * mm;
    const { matrix, classification } = track([space(f1), lens(f1), space(f1 + f2), lens(f2), space(f2)]);
    near(matrix.B, 0);
    near(matrix.A, -f2 / f1);
    assert.equal(classification.kind, "image");
    if (classification.kind === "image") near(classification.magnification, -4);
  });

  it("puts a single lens's back focal plane at A = 0 with x = f θ", () => {
    const f = 150 * mm;
    const { matrix, classification } = track([space(f), lens(f), space(f)]);
    assert.equal(matrix.A, 0);
    near(matrix.B, f);
    assert.equal(classification.kind, "fourier");
    if (classification.kind === "fourier") near(classification.scale, f);
  });

  // Objective f_o = 10 mm with the sample at its front focus; its back focal
  // plane sits f_o behind it. A 100 mm lens 150 mm past that plane images it
  // 300 mm further on (1/150 + 1/300 = 1/100), magnification -2.
  const fo = 10 * mm;
  const ft = 100 * mm;
  const objectiveThen = (u: number, v: number) => [space(fo), lens(fo), space(fo + u), lens(ft), space(v)];

  it("classifies the imaged back focal plane as a Fourier plane, -20 mm per radian", () => {
    const { classification } = track(objectiveThen(150 * mm, 300 * mm));
    assert.equal(classification.kind, "fourier");
    if (classification.kind === "fourier") {
      near(classification.scale, -2 * fo); // magnification × f_o
      near(classification.fourierDefocus, 0);
    }
  });

  it("reports the defocus when the lens moves 3 mm toward the detector", () => {
    // Now u = 153 mm, so the image forms at 153·100/53 = 288.68 mm, while the
    // detector is 297 mm away: the plane lies 8.32 mm before the detector.
    const { classification } = track(objectiveThen(153 * mm, 297 * mm));
    assert.equal(classification.kind, "neither");
    const expected = (153 * 100) / 53 - 297; // mm
    assert.ok(classification.fourierDefocus !== null);
    near(classification.fourierDefocus / mm, expected, 1e-9);
    near(expected, -8.3208, 1e-4);
  });

  it("reports the defocus with the opposite sign when the lens moves away", () => {
    // u = 147 mm: image at 147·100/47 = 312.77 mm, detector at 303 mm.
    const { classification } = track(objectiveThen(147 * mm, 303 * mm));
    assert.ok(classification.fourierDefocus !== null);
    near(classification.fourierDefocus / mm, (147 * 100) / 47 - 303, 1e-9);
    assert.ok(classification.fourierDefocus > 0);
  });

  it("reports the image defocus of a slightly long 4f relay", () => {
    // Detector 5 mm past the image plane: δ = -5 mm brings it back.
    const { classification } = track([space(50 * mm), lens(50 * mm), space(100 * mm), lens(50 * mm), space(55 * mm)]);
    assert.equal(classification.kind, "neither");
    assert.ok(classification.imageDefocus !== null);
    near(classification.imageDefocus / mm, -5, 1e-9);
    assert.equal(classification.fourierDefocus, null); // afocal: C = 0
  });

  it("has det M = 1 for every composed system", () => {
    const extra: RelayElement[][] = [
      [space(0.3), lens(-0.05), space(0.07), lens(0.2), lens(Infinity), space(1.1)],
      [lens(0.01), lens(0.02), space(0.003)],
    ];
    for (const path of [...paths, ...extra]) near(determinant(relayFromPath(path).matrix), 1, 1e-9);
  });
});

describe("classify", () => {
  it("handles C = 0 and D = 0", () => {
    const afocalOff: RayMatrix = { A: 2, B: 0.01, C: 0, D: 0.5 };
    assert.deepEqual(classify(afocalOff), { kind: "neither", imageDefocus: -0.02, fourierDefocus: null });
    const focus: RayMatrix = { A: 1, B: 0.1, C: -10, D: 0 };
    assert.deepEqual(classify(focus), { kind: "neither", imageDefocus: null, fourierDefocus: 0.1 });
  });

  it("scales the zero test with the length scale", () => {
    // Detector 1 µm past a 1 mm lens's back focal plane: fourierDefocus = -1 µm.
    const m = compose([freeSpace(1e-3), thinLens(1e-3), freeSpace(1e-3 + 1e-6)]);
    near(classify(m).fourierDefocus ?? NaN, -1e-6, 1e-15);
    assert.equal(classify(m).kind, "neither");
    assert.equal(classify(m, { tolerance: 1e-5 }).kind, "fourier");
    assert.equal(classify(m, { lengthScale: 1e-3, tolerance: 1e-5 }).kind, "neither");
  });
});

describe("maxEmissionAngle", () => {
  it("is asin(NA) in air", () => {
    near(maxEmissionAngle(0.5), Math.PI / 6);
    near(maxEmissionAngle(1), Math.PI / 2);
  });

  it("divides by the immersion index", () => {
    near(maxEmissionAngle(1.4, 1.518), Math.asin(1.4 / 1.518));
  });

  it("rejects an NA above the index", () => {
    assert.throws(() => maxEmissionAngle(1.2), RangeError);
    assert.throws(() => maxEmissionAngle(-0.1), RangeError);
  });

  it("clips rays outside the cone", () => {
    assert.ok(passesAperture(0.5, 0.5));
    assert.ok(!passesAperture(0.53, 0.5));
    assert.ok(passesAperture(-0.52, 0.5));
  });
});
