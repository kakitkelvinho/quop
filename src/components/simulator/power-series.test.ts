import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HC } from "./spectrometer.ts";
import { buildLadder, EV, ladderThreshold } from "./ladder.ts";
import { EXAMPLE_POWER_SERIES, inspectRelay, simulatePowerSeries } from "./power-series.ts";

const sum = (a: ArrayLike<number>) => Array.from(a).reduce((s, x) => s + x, 0);

describe("headless power series", () => {
  it("gives a Fourier relay with the objective's sine-angle scale", () => {
    const report = inspectRelay(EXAMPLE_POWER_SERIES);
    assert.equal(report.classification.kind, "fourier");
    assert.ok(Math.abs(report.angleScale + 8e-3) < 1e-12);
    assert.equal(report.numericalAperture, 0.42);
  });

  it("reports a real-space image rather than rendering one", () => {
    const config = {
      ...EXAMPLE_POWER_SERIES,
      relay: [{ kind: "space" as const, d: 0.15 }, { kind: "lens" as const, f: 0.15 }, { kind: "space" as const, d: 0.15 }],
    };
    const result = simulatePowerSeries(config);
    assert.equal(result.status, "unsupported-relay");
    assert.equal(result.relay.classification.kind, "image");
  });

  it("clips the thermal branch at the objective's NA", () => {
    const config = { ...EXAMPLE_POWER_SERIES, objective: { ...EXAMPLE_POWER_SERIES.objective, numericalAperture: 0.08 }, pumpRates: [EXAMPLE_POWER_SERIES.pumpRates[0]] };
    const result = simulatePowerSeries(config);
    assert.equal(result.status, "ok");
    const frame = result.points[0].frame;
    for (let row = 0; row < frame.height; row++) {
      if (Math.abs(frame.positions[row] / result.relay.angleScale) <= 0.08) continue;
      assert.equal(sum(frame.pixels.subarray(row * frame.width, (row + 1) * frame.width)), 0);
    }
    const emitted = sum(result.points[0].populations.emission);
    const captured = sum(frame.pixels) / (config.collectionEfficiency * config.exposure * config.quantumEfficiency);
    assert.ok(captured < emitted * 0.5);
  });

  it("shows a dim branch below threshold and a bright narrow ground-state spot above it", () => {
    const result = simulatePowerSeries(EXAMPLE_POWER_SERIES);
    assert.equal(result.status, "ok");
    const groundEnergy = buildLadder(EXAMPLE_POWER_SERIES.model).energy[0];
    const spotFraction = (index: number) => {
      const frame = result.points[index].frame;
      let all = 0;
      let spot = 0;
      let outerBranch = 0;
      for (let row = 0; row < frame.height; row++) {
        const angle = Math.asin(frame.positions[row] / result.relay.angleScale);
        for (let col = 0; col < frame.width; col++) {
          const value = frame.pixels[row * frame.width + col];
          const energy = HC / frame.wavelengths[col];
          all += value;
          if (Math.abs(angle) < 0.012 && Math.abs(energy - groundEnergy) < 0.8e-3 * EV) spot += value;
          if (Math.abs(angle) > 0.08 && Math.abs(angle) < 0.12 && energy > groundEnergy) outerBranch += value;
        }
      }
      return { spot: spot / all, branch: outerBranch / all };
    };
    const below = spotFraction(0);
    const above = spotFraction(29);
    assert.ok(below.branch > 0.1, `below-threshold branch fraction ${below.branch}`);
    assert.ok(above.spot > 10 * below.spot, `${below.spot} → ${above.spot}`);
    assert.ok(above.spot > 0.5, `above-threshold spot fraction ${above.spot}`);
  });

  it("preserves the input-output curve up to the fixed collection and camera factors", () => {
    const result = simulatePowerSeries(EXAMPLE_POWER_SERIES);
    assert.equal(result.status, "ok");
    const scale = EXAMPLE_POWER_SERIES.collectionEfficiency * EXAMPLE_POWER_SERIES.exposure * EXAMPLE_POWER_SERIES.quantumEfficiency;
    for (const point of result.points) {
      const expected = sum(point.populations.emission) * scale;
      const counts = sum(point.frame.pixels);
      assert.ok(Math.abs(counts / expected - 1) < 1e-5, `${point.pump}: ${counts} vs ${expected}`);
      assert.equal(point.populations.pump, point.pump);
    }
    const threshold = ladderThreshold(buildLadder(EXAMPLE_POWER_SERIES.model));
    assert.ok(result.points[0].pump < threshold);
    assert.ok(result.points[29].pump > threshold);
  });

  it("runs 30 frames at 512 × 512 in under one second", () => {
    const start = performance.now();
    const result = simulatePowerSeries(EXAMPLE_POWER_SERIES);
    const elapsed = performance.now() - start;
    assert.equal(result.status, "ok");
    assert.equal(result.points.length, 30);
    assert.equal(result.points[0].frame.pixels.length, 512 * 512);
    assert.ok(elapsed < 1000, `30 frames took ${elapsed.toFixed(0)} ms`);
  });
});
