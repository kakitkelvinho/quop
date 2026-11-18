import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";

import { adjoint, IDENTITY_JONES, type Jones, multiplyJones, rotator, waveplate } from "./jones.ts";

const angle = fc.double({ min: -2 * Math.PI, max: 2 * Math.PI, noNaN: true });

function assertIdentity(j: Jones, tolerance = 1e-12) {
  for (const row of [0, 1] as const) {
    for (const col of [0, 1] as const) {
      assert.ok(Math.abs(j[row][col].re - IDENTITY_JONES[row][col].re) <= tolerance, `re[${row}][${col}] = ${j[row][col].re}`);
      assert.ok(Math.abs(j[row][col].im) <= tolerance, `im[${row}][${col}] = ${j[row][col].im}`);
    }
  }
}

function assertSame(a: Jones, b: Jones, tolerance = 1e-12) {
  for (const row of [0, 1] as const) {
    for (const col of [0, 1] as const) {
      assert.ok(Math.abs(a[row][col].re - b[row][col].re) <= tolerance);
      assert.ok(Math.abs(a[row][col].im - b[row][col].im) <= tolerance);
    }
  }
}

describe("Jones matrices", () => {
  it("a rotator is lossless: J†J = I", () => {
    fc.assert(fc.property(angle, (t) => assertIdentity(multiplyJones(adjoint(rotator(t)), rotator(t)))));
  });

  it("a waveplate of any retardance and angle is lossless: J†J = I", () => {
    fc.assert(
      fc.property(angle, angle, (retardance, t) => {
        const j = waveplate(retardance, t);
        assertIdentity(multiplyJones(adjoint(j), j));
      }),
    );
  });

  it("losslessness survives a stack of them", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(angle, angle), { minLength: 1, maxLength: 6 }), (plates) => {
        const stack = plates.reduce<Jones>((acc, [r, t]) => multiplyJones(waveplate(r, t), acc), IDENTITY_JONES);
        assertIdentity(multiplyJones(adjoint(stack), stack), 1e-10);
      }),
    );
  });

  it("a waveplate with no retardance does nothing", () => {
    fc.assert(fc.property(angle, (t) => assertSame(waveplate(0, t), IDENTITY_JONES)));
  });

  it("two quarter-wave plates at the same angle make a half-wave plate", () => {
    fc.assert(
      fc.property(angle, (t) => {
        assertSame(multiplyJones(waveplate(Math.PI / 2, t), waveplate(Math.PI / 2, t)), waveplate(Math.PI, t));
      }),
    );
  });

  it("a half-wave plate at θ turns linear polarisation at φ into one at 2θ − φ", () => {
    fc.assert(
      fc.property(angle, angle, (t, phi) => {
        const j = waveplate(Math.PI, t);
        const out = { x: j[0][0].re * Math.cos(phi) + j[0][1].re * Math.sin(phi), y: j[1][0].re * Math.cos(phi) + j[1][1].re * Math.sin(phi) };
        // Up to a global phase the half-wave plate is a reflection of the polarisation plane; its entries are all imaginary.
        const im = { x: j[0][0].im * Math.cos(phi) + j[0][1].im * Math.sin(phi), y: j[1][0].im * Math.cos(phi) + j[1][1].im * Math.sin(phi) };
        assert.ok(Math.hypot(out.x, out.y) < 1e-12);
        const sign = Math.sign(im.x * Math.cos(2 * t - phi) + im.y * Math.sin(2 * t - phi));
        assert.ok(Math.abs(im.x - sign * Math.cos(2 * t - phi)) < 1e-9);
        assert.ok(Math.abs(im.y - sign * Math.sin(2 * t - phi)) < 1e-9);
      }),
    );
  });

  it("a rotator is its own undoing run backwards, and a Faraday rotator is not: two passes turn twice", () => {
    fc.assert(
      fc.property(angle, (t) => {
        assertIdentity(multiplyJones(rotator(-t), rotator(t)));
        // Light reflected back through a Faraday rotator turns the same way again, in the beam's own frame.
        assertSame(multiplyJones(rotator(t), rotator(t)), rotator(2 * t));
      }),
    );
  });
});
