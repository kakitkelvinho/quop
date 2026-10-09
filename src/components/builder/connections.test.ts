import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  type Connection,
  connectionDelayPs,
  dropComponentFromConnections,
  parseScene,
  SCENE_VERSION,
  settleAngles,
  switchConnectionKind,
} from "./types.ts";

// #102: a fibre or cable joins two parts. It is not a beam: it carries an
// optional length and delay of its own, and nothing aims along it.

const part = (id: string, type: ComponentType, x: number, z: number, rotation = 0): BuilderComponent => ({
  id,
  type,
  position: [x, 100, z],
  rotation,
});

const fibre = (from: string, to: string, extra: Partial<Connection> = {}): Connection => ({
  id: `${from}-${to}`,
  kind: "fiber",
  from,
  to,
  color: "#eab308",
  ...extra,
});

describe("a connection's delay", () => {
  it("is L·n/c along a fibre, 2 m of silica giving 9.79 ns", () => {
    assert.equal(connectionDelayPs(fibre("a", "b", { lengthM: 2 }))?.toFixed(1), "9793.4");
  });

  it("is L/(VF·c) along a cable, 1 m of solid-PE coax giving 5.05 ns", () => {
    assert.equal(connectionDelayPs({ ...fibre("a", "b", { lengthM: 1 }), kind: "cable" })?.toFixed(1), "5054.0");
  });

  it("follows the index or velocity factor given", () => {
    assert.equal(connectionDelayPs(fibre("a", "b", { lengthM: 2, refractiveIndex: 1 }))?.toFixed(1), "6671.3");
    assert.equal(connectionDelayPs({ ...fibre("a", "b", { lengthM: 1.5, velocityFactor: 0.7 }), kind: "cable" })?.toFixed(1), "7147.8");
  });

  it("is unknown without a length", () => {
    assert.equal(connectionDelayPs(fibre("a", "b")), undefined);
    assert.equal(connectionDelayPs(fibre("a", "b", { lengthM: 0 })), 0);
  });
});

describe("opening a setup's connections", () => {
  const open = (connections: unknown[]) =>
    parseScene({
      version: 3,
      components: [part("fc", "fiber-collimator", 0, 0), part("pd", "photodiode", 200, 0)],
      beams: [],
      connections,
    })?.connections.map(({ id }) => id);

  it("drops an unknown kind, a missing or dangling end, and a connection from a part to itself", () => {
    assert.deepEqual(
      open([
        { id: "ok", kind: "fiber", from: "fc", to: "pd", color: "#eab308" },
        { id: "rf", kind: "rf-horn", from: "fc", to: "pd" },
        { id: "half", kind: "cable", from: "fc" },
        { id: "gone", kind: "cable", from: "fc", to: "deleted-part" },
        { id: "loop", kind: "fiber", from: "pd", to: "pd" },
        { id: "toString", kind: "toString", from: "fc", to: "pd" },
      ]),
      ["ok"],
    );
  });

  it("clamps a length, an index and a velocity factor into range, and reads only the kind's own index", () => {
    const opened = parseScene({
      version: 3,
      components: [part("fc", "fiber-collimator", 0, 0), part("pd", "photodiode", 200, 0)],
      beams: [],
      connections: [
        { id: "f", kind: "fiber", from: "fc", to: "pd", lengthM: -4, refractiveIndex: 9, velocityFactor: 0.5 },
        { id: "c", kind: "cable", from: "pd", to: "fc", lengthM: 1e9, velocityFactor: 3, refractiveIndex: 1.5 },
      ],
    });
    assert.deepEqual(opened?.connections, [
      { id: "f", kind: "fiber", from: "fc", to: "pd", color: "#eab308", lengthM: 0, refractiveIndex: 3 },
      { id: "c", kind: "cable", from: "pd", to: "fc", color: "#64748b", lengthM: 100_000, velocityFactor: 1 },
    ]);
  });
});

describe("deleting a part", () => {
  it("takes away the connections at either end of it, and keeps the rest", () => {
    const connections = [fibre("fc", "pd"), fibre("pd", "tagger"), fibre("fc", "cam")];
    assert.deepEqual(dropComponentFromConnections(connections, "pd").map(({ id }) => id), ["fc-cam"]);
  });
});

describe("switching a connection's kind", () => {
  it("drops the old kind's index and moves a default colour to the new kind's", () => {
    assert.deepEqual(switchConnectionKind(fibre("a", "b", { refractiveIndex: 1.5 }), "cable"), {
      kind: "cable",
      refractiveIndex: undefined,
      velocityFactor: undefined,
      color: "#64748b",
    });
  });

  it("keeps a colour picked by hand", () => {
    assert.deepEqual(switchConnectionKind(fibre("a", "b", { color: "#ff0000" }), "cable"), {
      kind: "cable",
      refractiveIndex: undefined,
      velocityFactor: undefined,
    });
  });
});

describe("a photodiode at the end of a connection", () => {
  const scene = (beams: string[][]): BuilderSceneData => ({
    version: SCENE_VERSION,
    frames: [],
    components: [part("fc", "fiber-collimator", -200, 0), part("pd", "photodiode", 0, 0, 135)],
    beams: beams.map((path, index) => ({ id: `beam-${index}`, path, color: "#e33" })),
    connections: [fibre("fc", "pd")],
  });
  const yaw = (data: BuilderSceneData) => data.components.find(({ id }) => id === "pd")?.rotation;

  it("keeps the yaw it was turned to by hand, where a beam over the same parts would aim it", () => {
    assert.equal(yaw(settleAngles(scene([]))), 135);
    assert.equal(yaw(settleAngles(scene([["fc", "pd"]]))), 0);
  });
});
