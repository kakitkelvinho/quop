import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deleteComponents, duplicateComponents, nudgeComponents, rotateComponents } from "./group-edits.ts";
import {
  type BuilderComponent,
  type BuilderSceneData,
  SCENE_VERSION,
  beamLengthMm,
  parseScene,
  periscopePartner,
  selectableId,
  serializeScene,
  settleAngles,
  settlePeriscopes,
} from "./types.ts";

// A periscope is two parts, its lower mirror and its top mirror, each a stop
// a beam can pass; the top one stands straight above the lower one.

const laser: BuilderComponent = { id: "laser", type: "laser-source", position: [-200, 100, 0], rotation: 0 };
const peri: BuilderComponent = { id: "peri", type: "periscope", position: [0, 100, 0], rotation: 0 };
const top: BuilderComponent = { id: "peri-top", type: "periscope-top", position: [0, 250, 0], rotation: 0, periscope: "peri" };
const pd: BuilderComponent = { id: "pd", type: "photodiode", position: [0, 250, -200], rotation: 0 };

const bench = (components: BuilderComponent[] = [laser, peri, top, pd]): BuilderSceneData => ({
  version: SCENE_VERSION,
  components,
  beams: [{ id: "b", path: ["laser", "peri", "peri-top", "pd"], color: "#e33" }],
  connections: [],
  frames: [],
});

const byId = (scene: BuilderSceneData, id: string) => scene.components.find((component) => component.id === id);

describe("a periscope", () => {
  it("adds its rise to the path length of a beam through both mirrors", () => {
    assert.equal(beamLengthMm(bench().components, bench().beams[0]), 200 + 150 + 200);
  });

  it("keeps its top mirror over its lower one, at the top mirror's own height", () => {
    const moved = settlePeriscopes(bench([laser, { ...peri, position: [50, 100, 25] }, top, pd]));
    assert.deepEqual(byId(moved, "peri-top")?.position, [50, 250, 25]);
  });

  it("gives its top mirror its label, marked as the top, and its mount colour", () => {
    const named = settlePeriscopes(bench([laser, { ...peri, label: "P1", color: "#16a34a" }, top, pd]));
    assert.equal(byId(named, "peri-top")?.label, "P1 top");
    assert.equal(byId(named, "peri-top")?.color, "#16a34a");
    const unnamed = settlePeriscopes({ ...named, components: named.components.map((part) => (part.id === "peri" ? { ...part, label: "" } : part)) });
    assert.equal(byId(unnamed, "peri-top")?.label, undefined);
  });

  it("is selected by its lower mirror, whichever mirror is clicked", () => {
    const { components } = bench();
    assert.equal(selectableId(components, "peri-top"), "peri");
    assert.equal(selectableId(components, "peri"), "peri");
    assert.equal(selectableId([top], "peri-top"), "peri-top");
  });

  it("lets a top mirror go when its lower mirror is gone", () => {
    const loose = settlePeriscopes(bench([laser, top, pd]));
    assert.equal(byId(loose, "peri-top")?.periscope, undefined);
  });

  it("finds each mirror's other mirror", () => {
    const { components } = bench();
    assert.equal(periscopePartner(components, peri)?.id, "peri-top");
    assert.equal(periscopePartner(components, top)?.id, "peri");
    assert.equal(periscopePartner(components, laser), undefined);
  });

  it("turns each mirror to face its neighbour off to the side", () => {
    const settled = settleAngles(bench());
    // the lower mirror looks back at the laser (−x), the top one on to the photodiode (−z)
    assert.equal(byId(settled, "peri")?.rotation, 180);
    assert.equal(byId(settled, "peri-top")?.rotation, 90);
  });

  it("goes whole when either mirror is deleted", () => {
    const left = deleteComponents(bench(), ["peri-top"]);
    assert.deepEqual(left.components.map(({ id }) => id), ["laser", "pd"]);
  });

  it("is copied whole, its copy's top mirror on its copy's lower one", () => {
    const ids = ["peri-copy", "top-copy"];
    let next = 0;
    const { scene } = duplicateComponents(bench(), ["peri"], {
      component: () => ids[next++],
      beam: () => "beam-copy",
      connection: () => "connection-copy",
    });
    assert.equal(byId(scene, "top-copy")?.periscope, "peri-copy");
    assert.deepEqual(byId(scene, "top-copy")?.position, [25, 250, 25]);
  });

  it("moves whole when its top mirror is nudged", () => {
    const nudged = nudgeComponents(bench(), ["peri-top"], 25, 0);
    assert.deepEqual(byId(nudged, "peri")?.position, [25, 100, 0]);
    assert.deepEqual(byId(nudged, "peri-top")?.position, [25, 250, 0]);
  });

  it("turns one mirror alone in place", () => {
    const turned = rotateComponents(bench([peri, top]), ["peri-top"], 1);
    assert.equal(byId(turned, "peri-top")?.rotation, 15);
    assert.equal(byId(turned, "peri")?.rotation, 0);
  });

  it("opens from a setup file as it was saved", () => {
    const scene = settleAngles(bench());
    assert.equal(serializeScene(parseScene(JSON.parse(serializeScene(scene)))!), serializeScene(scene));
  });
});

describe("a Faraday isolator", () => {
  it("opens from a setup file", () => {
    const isolator: BuilderComponent = { id: "fi", type: "faraday-isolator", position: [0, 100, 0], rotation: 90 };
    assert.deepEqual(parseScene({ version: SCENE_VERSION, components: [isolator] })?.components, [
      { ...isolator, color: undefined, label: undefined },
    ]);
  });
});
