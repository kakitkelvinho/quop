import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type BuilderSceneData, parseScene, serializeScene } from "../builder/types.ts";
import { beamOptics } from "./beam-optics.ts";
import { DEFAULT_PARAMS, absorbedPerPulse, buildLadder, ladderParams, peakAndWidth, seriesFluences, takeCapture } from "./capture.ts";
import { EXAMPLE_SETUP } from "./example-setup.ts";
import { readOpenedFile, serializeState } from "./state-file.ts";

// The Dry Run prototype (#341): a setup's beam in, captures out.

const optics = (scene: BuilderSceneData, beamId: string, f = 0.02) =>
  beamOptics(scene, scene.beams.find((beam) => beam.id === beamId)!, { objectiveFocalLength: f });

describe("beamOptics", () => {
  it("finds the example's slit at a Fourier plane, 20 mm per rad", () => {
    const result = optics(EXAMPLE_SETUP, "beam-leakage");
    assert.ok(result.ok);
    assert.equal(result.classification.kind, "fourier");
    if (result.classification.kind === "fourier") assert.ok(Math.abs(Math.abs(result.classification.scale) - 0.02) < 1e-9);
    assert.deepEqual(
      result.stops.map((stop) => stop.type),
      ["sample", "objective", "beam-splitter", "lens", "lens", "spectrometer"],
    );
  });

  it("says plainly when the beam reaches no spectrometer", () => {
    const result = optics(EXAMPLE_SETUP, "beam-pump");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /no spectrometer/);
  });

  it("says plainly when the beam has no sample", () => {
    const scene: BuilderSceneData = {
      ...EXAMPLE_SETUP,
      beams: [{ id: "b", path: ["pump", "cube", "lens-1", "spectrometer"], color: "#000" }],
    };
    const result = optics(scene, "b");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /no sample/);
  });

  it("reads a beam drawn from the spectrometer back to the sample", () => {
    const leakage = EXAMPLE_SETUP.beams[1];
    const scene: BuilderSceneData = { ...EXAMPLE_SETUP, beams: [{ ...leakage, path: [...leakage.path].reverse() }] };
    const result = optics(scene, leakage.id);
    assert.ok(result.ok && result.classification.kind === "fourier");
  });

  it("reports how far off the Fourier plane a misplaced slit is", () => {
    const scene: BuilderSceneData = {
      ...EXAMPLE_SETUP,
      components: EXAMPLE_SETUP.components.map((c) => (c.id === "spectrometer" ? { ...c, position: [870, c.position[1], 0] } : c)),
    };
    const result = optics(scene, "beam-leakage");
    assert.ok(result.ok);
    assert.equal(result.classification.kind, "neither");
    if (result.classification.kind === "neither") assert.ok(Math.abs(result.classification.fourierDefocus! + 0.02) < 1e-6);
  });
});

describe("capture", () => {
  const params = { ...DEFAULT_PARAMS, lightModel: true, columns: 128, rows: 64 };
  const ladder = buildLadder({ ...ladderParams(params), bins: 10 });

  it("spaces the series evenly in log", () => {
    const f = seriesFluences({ ...params, seriesFrom: 0.1, seriesTo: 10, seriesPoints: 3 });
    assert.deepEqual(f.map((v) => Number(v.toPrecision(6))), [0.1, 1, 10]);
  });

  it("turns fluence into absorbed pump photons over the pumped spot", () => {
    // 1 µJ/cm² over 500 µm² is 5 pJ; a 400 nm photon is 4.97e-19 J.
    const n = absorbedPerPulse(DEFAULT_PARAMS, 1);
    assert.ok(Math.abs(n / 1.007e7 - 1) < 1e-3, String(n));
  });

  it("leaks more than proportionally across threshold, mostly from k = 0", () => {
    const optics = { fourierScale: 0.02 };
    const low = takeCapture(ladder, params, optics, 0.02);
    const high = takeCapture(ladder, params, optics, 2);
    assert.ok(high.leakage / low.leakage > 300, `${high.leakage / low.leakage}`);
    assert.ok(high.condensateLeakage / high.leakage > 0.9);
    assert.ok(low.condensateLeakage / low.leakage < 0.1);
    assert.equal(high.capture.width, 128);
    assert.equal(high.capture.height, 64);
    assert.equal(high.saturated, 0);
  });

  it("reads the peak and FWHM of a spectrum", () => {
    const x = Array.from({ length: 201 }, (_, i) => i / 10 - 10);
    const y = x.map((v) => 1 / (1 + (v - 1) ** 2));
    const { peak, fwhm } = peakAndWidth(y, x);
    assert.ok(Math.abs(peak - 1) < 1e-9);
    assert.ok(Math.abs(fwhm - 2) < 0.01, String(fwhm));
  });
});

describe("state file", () => {
  it("keeps a full copy of the setup, the beam and the parameters", () => {
    const text = serializeState({ setupName: "x", setup: EXAMPLE_SETUP, beamId: "beam-leakage", params: { ...DEFAULT_PARAMS, seriesPoints: 7 } });
    const opened = readOpenedFile(text, "dry-run.json");
    assert.equal(opened.kind, "state");
    if (opened.kind !== "state") return;
    assert.equal(opened.state.beamId, "beam-leakage");
    assert.equal(opened.state.params.seriesPoints, 7);
    assert.equal(serializeScene(opened.state.setup), serializeScene(parseScene(JSON.parse(serializeScene(EXAMPLE_SETUP)))!));
  });

  it("opens a plain setup file as a setup", () => {
    assert.equal(readOpenedFile(serializeScene(EXAMPLE_SETUP), "s.json").kind, "setup");
    assert.equal(readOpenedFile("{", "s.json").kind, "error");
  });
});
