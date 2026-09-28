import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatSpeed, paceToSpeed, speedToPace } from "./pace.ts";

describe("paceToSpeed", () => {
  it("turns 4:30 per km into 13.33 km/h", () => {
    assert.equal(formatSpeed(paceToSpeed(4, 30) ?? 0), "13.33");
  });

  it("takes seconds past 59", () => {
    assert.equal(paceToSpeed(4, 90), paceToSpeed(5, 30));
  });

  it("refuses a zero or negative pace", () => {
    assert.equal(paceToSpeed(0, 0), null);
    assert.equal(paceToSpeed(-4, 30), null);
    assert.equal(paceToSpeed(4, -30), null);
    assert.equal(paceToSpeed(Number.NaN, 30), null);
  });
});

describe("speedToPace", () => {
  it("rounds to the whole second", () => {
    assert.deepEqual(speedToPace(13.3), { minutes: 4, seconds: 31 });
    assert.deepEqual(speedToPace(12), { minutes: 5, seconds: 0 });
  });

  it("carries a minute when the seconds round up to 60", () => {
    // 12.002 km/h is 4:59.95 per km
    assert.deepEqual(speedToPace(12.002), { minutes: 5, seconds: 0 });
  });

  it("round-trips the default pace through its shown speed", () => {
    assert.deepEqual(speedToPace(Number(formatSpeed(paceToSpeed(4, 30) ?? 0))), {
      minutes: 4,
      seconds: 30,
    });
  });

  it("refuses a zero or negative speed", () => {
    assert.equal(speedToPace(0), null);
    assert.equal(speedToPace(-10), null);
    assert.equal(speedToPace(Number.POSITIVE_INFINITY), null);
  });
});

describe("formatSpeed", () => {
  it("shows at most two decimals and no trailing zeros", () => {
    assert.equal(formatSpeed(13.3333), "13.33");
    assert.equal(formatSpeed(12.5), "12.5");
    assert.equal(formatSpeed(12), "12");
    assert.equal(formatSpeed(11.999), "12");
  });
});
