import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRandom, logGamma } from "./random.ts";

function moments(draw: () => number, n: number): { mean: number; variance: number } {
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const x = draw();
    s += x;
    s2 += x * x;
  }
  const mean = s / n;
  return { mean, variance: s2 / n - mean * mean };
}

describe("createRandom", () => {
  it("repeats for the same seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    for (let i = 0; i < 10; i++) assert.equal(a.uniform(), b.uniform());
    assert.notEqual(createRandom(1).uniform(), createRandom(2).uniform());
  });

  it("draws uniforms inside (0, 1) and standard normals", () => {
    const r = createRandom(1);
    for (let i = 0; i < 1000; i++) {
      const u = r.uniform();
      assert.ok(u > 0 && u < 1);
    }
    const { mean, variance } = moments(r.normal, 100000);
    assert.ok(Math.abs(mean) < 0.02 && Math.abs(variance - 1) < 0.02);
  });

  it("draws Poisson counts with mean and variance equal to the mean, small or large", () => {
    const r = createRandom(5);
    for (const mu of [0.5, 4, 12, 50, 1e4, 1e7]) {
      const { mean, variance } = moments(() => r.poisson(mu), 100000);
      assert.ok(Math.abs(mean / mu - 1) < 0.02, `mean ${mean} for ${mu}`);
      assert.ok(Math.abs(variance / mu - 1) < 0.03, `variance ${variance} for ${mu}`);
    }
    assert.equal(r.poisson(0), 0);
    assert.ok(Number.isInteger(r.poisson(1e5)));
  });
});

describe("logGamma", () => {
  it("matches log factorials", () => {
    assert.ok(Math.abs(logGamma(5) - Math.log(24)) < 1e-12);
    assert.ok(Math.abs(logGamma(0.5) - 0.5 * Math.log(Math.PI)) < 1e-12);
  });
});
