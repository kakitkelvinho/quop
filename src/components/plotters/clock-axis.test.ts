import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clockTicks, formatClock, formatClockPoint, hasSeconds } from "./clock-axis.ts";

describe("formatClock", () => {
  it("writes seconds of the day as a clock time", () => {
    assert.equal(formatClock(11 * 3600 + 48 * 60), "11:48");
    assert.equal(formatClock(23 * 3600), "23:00");
    assert.equal(formatClock(11 * 3600 + 48 * 60 + 35, true), "11:48:35");
  });

  it("marks a time past midnight with +1d", () => {
    assert.equal(formatClock(86400), "00:00 +1d");
    assert.equal(formatClock(2 * 86400 + 3600), "01:00 +2d");
  });

  it("keeps fractional seconds", () => {
    assert.equal(formatClock(42515.25, true), "11:48:35.25");
  });
});

describe("clockTicks", () => {
  it("ticks on whole hours across an evening into the next day", () => {
    const ticks = clockTicks(20 * 3600 + 600, 27 * 3600);

    assert.deepEqual(
      ticks.map((tick) => formatClock(tick)),
      ["21:00", "22:00", "23:00", "00:00 +1d", "01:00 +1d", "02:00 +1d", "03:00 +1d"],
    );
  });

  it("ticks on seconds over a short span", () => {
    assert.deepEqual(clockTicks(100, 130), [100, 105, 110, 115, 120, 125, 130]);
  });

  it("gives nothing for an empty span", () => {
    assert.deepEqual(clockTicks(5, 5), []);
  });
});

describe("hasSeconds", () => {
  it("is true only when a reading falls between whole minutes", () => {
    assert.equal(hasSeconds([60, 120, 180]), false);
    assert.equal(hasSeconds([60, 125]), true);
  });
});

describe("formatClockPoint", () => {
  it("writes a point's x as a clock time", () => {
    assert.equal(formatClockPoint("a", 42515, 21.5, true), "a: (11:48:35, 21.5)");
    assert.equal(formatClockPoint("a", 42515, 21.5, false), "a: (11:48, 21.5)");
  });
});
