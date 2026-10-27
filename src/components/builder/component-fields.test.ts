import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type BuilderComponent,
  COMPONENT_FIELDS,
  COMPONENT_SPECS,
  type ComponentType,
  DELAY_MIN_PATH_RANGE_MM,
  DELAY_TRAVEL_RANGE_MM,
  type KindField,
  SCENE_VERSION,
  fieldValue,
  parseScene,
} from "./types.ts";

// COMPONENT_FIELDS describes each optional Component field once. These open
// one-part setups to check that every field is read as its entry says: held
// to its range, given its default through fieldValue when it is missing, and
// ignored in a file from before the version it came in.

const FIELDS = Object.keys(COMPONENT_FIELDS) as KindField[];
const KINDS = Object.keys(COMPONENT_SPECS) as ComponentType[];

/** Every kind that has `field`. */
const kindsWith = (field: KindField) => KINDS.filter((type) => COMPONENT_SPECS[type].fields.includes(field));

/** A usable value for each field, unlike its default where it has one. */
const GOOD: Record<KindField, unknown> = {
  lensShape: "biconvex",
  focalLength: 250,
  cavityLength: 80,
  objectiveLength: 70,
  opacity: 0.5,
  host: "host",
  periscope: "host",
  delayMinPathMm: 120,
  delayTravelMm: 300,
  delayStageMm: 40,
  lightColor: "#00ff88",
  lightHidden: true,
  sampleStage: "side",
  stageColor: "#123456",
  sampleStageLeft: true,
  particleRadius: 5,
  size: [40, 50, 60],
  internalPathMm: 500,
};

/** What a part refers to by id: a cavity for a particle's host, a periscope for its top mirror. */
function partner(type: ComponentType): Record<string, unknown>[] {
  if (type === "particle") return [{ id: "host", type: "cavity", position: [0, 100, 0], rotation: 0 }];
  if (type === "periscope-top") return [{ id: "host", type: "periscope", position: [0, 100, 0], rotation: 0 }];
  return [];
}

/** The part `p`, of kind `type` with `extra`, as a setup of `version` opens it. */
function opened(type: ComponentType, extra: Record<string, unknown>, version: number = SCENE_VERSION): BuilderComponent {
  const scene = parseScene({
    version,
    components: [...partner(type), { id: "p", type, position: [0, 100, 0], rotation: 0, ...extra }],
    beams: [],
  });
  const part = scene?.components.find((component) => component.id === "p");
  assert.ok(part, `${type} opens`);
  return part;
}

describe("COMPONENT_FIELDS", () => {
  it("describes every field some kind has, and every field it describes belongs to a kind", () => {
    for (const type of KINDS) {
      for (const field of COMPONENT_SPECS[type].fields) assert.ok(field in COMPONENT_FIELDS, `${type}: ${field}`);
    }
    for (const field of FIELDS) assert.ok(kindsWith(field).length > 0, field);
  });

  it("reads a usable value as it is", () => {
    for (const field of FIELDS) {
      for (const type of kindsWith(field)) {
        // a sample's stage is on its left only when it stands beside it
        const extra = field === "sampleStageLeft" ? { sampleStage: "side", [field]: GOOD[field] } : { [field]: GOOD[field] };
        assert.deepEqual(opened(type, extra)[field], GOOD[field], `${type}: ${field}`);
      }
    }
  });

  it("holds a value out of range to the range", () => {
    for (const field of FIELDS) {
      const { read } = COMPONENT_FIELDS[field];
      if (read.as !== "number" && read.as !== "vec3") continue;
      const [min, max] = read.range;
      for (const type of kindsWith(field)) {
        const low: unknown = read.as === "vec3" ? [min - 1, min - 1, min - 1] : min - 1;
        const high: unknown = read.as === "vec3" ? [max + 1, max + 1, max + 1] : max + 1;
        assert.deepEqual(opened(type, { [field]: low })[field], read.as === "vec3" ? [min, min, min] : min, `${type}: ${field} low`);
        assert.deepEqual(opened(type, { [field]: high })[field], read.as === "vec3" ? [max, max, max] : max, `${type}: ${field} high`);
      }
    }
  });

  it("holds a delay line's settings to their ranges, its stage within its travel", () => {
    const low = opened("delay-line", { delayMinPathMm: -5, delayTravelMm: -5, delayStageMm: -5 });
    assert.equal(low.delayMinPathMm, DELAY_MIN_PATH_RANGE_MM[0]);
    assert.equal(low.delayTravelMm, DELAY_TRAVEL_RANGE_MM[0]);
    assert.equal(low.delayStageMm, 0);
    const high = opened("delay-line", { delayMinPathMm: 1e9, delayTravelMm: 1e9, delayStageMm: 1e9 });
    assert.equal(high.delayMinPathMm, DELAY_MIN_PATH_RANGE_MM[1]);
    assert.equal(high.delayTravelMm, DELAY_TRAVEL_RANGE_MM[1]);
    assert.equal(high.delayStageMm, DELAY_TRAVEL_RANGE_MM[1]);
    assert.equal(opened("delay-line", { delayTravelMm: 100, delayStageMm: 150 }).delayStageMm, 100);
  });

  it("leaves out a value it can't use", () => {
    const unusable: Partial<Record<KindField, unknown>> = {
      focalLength: "100",
      cavityLength: Number.NaN,
      objectiveLength: null,
      opacity: "half",
      host: 7,
      periscope: ["host"],
      delayMinPathMm: "50",
      delayTravelMm: {},
      delayStageMm: false,
      lightColor: "url(https://example.com)",
      lightHidden: "true",
      sampleStage: "above",
      stageColor: 0x123456,
      sampleStageLeft: 1,
      particleRadius: Infinity,
      size: [1, 2],
      internalPathMm: "0",
    };
    for (const [field, value] of Object.entries(unusable) as [KindField, unknown][]) {
      for (const type of kindsWith(field)) {
        assert.equal(opened(type, { [field]: value })[field], undefined, `${type}: ${field}`);
      }
    }
  });

  it("gives a lens a shape whatever the file says, the default when it has none it knows", () => {
    assert.equal(opened("lens", {}).lensShape, "plano-convex");
    assert.equal(opened("lens", { lensShape: "meniscus" }).lensShape, "plano-convex");
  });

  it("stores nothing for a missing field but the lens's shape, and fieldValue gives the default", () => {
    for (const field of FIELDS) {
      const spec = COMPONENT_FIELDS[field] as { default?: unknown };
      for (const type of kindsWith(field)) {
        const part = opened(type, {});
        if (field !== "lensShape") assert.equal(part[field], undefined, `${type}: ${field} stored`);
        assert.deepEqual(fieldValue(part, field), spec.default, `${type}: ${field}`);
      }
    }
  });

  it("gives a part's own value over the default", () => {
    for (const field of FIELDS) {
      for (const type of kindsWith(field)) {
        const part = { id: "p", type, position: [0, 100, 0], rotation: 0, [field]: GOOD[field] } as BuilderComponent;
        assert.deepEqual(fieldValue(part, field), GOOD[field], `${type}: ${field}`);
      }
    }
  });

  it("ignores a field in a file from before its version, and reads it from that version on", () => {
    const versioned = FIELDS.filter((field) => "since" in COMPONENT_FIELDS[field]);
    assert.deepEqual(versioned, ["objectiveLength", "sampleStage", "stageColor", "sampleStageLeft"]);
    for (const field of versioned) {
      const { since } = COMPONENT_FIELDS[field] as { since: number };
      const extra = field === "sampleStageLeft" ? { sampleStage: "side", [field]: GOOD[field] } : { [field]: GOOD[field] };
      for (const type of kindsWith(field)) {
        assert.equal(opened(type, extra, since - 1)[field], undefined, `${type}: ${field} before ${since}`);
        assert.deepEqual(opened(type, extra, since)[field], GOOD[field], `${type}: ${field} at ${since}`);
      }
    }
  });
});
