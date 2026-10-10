import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EXAMPLE_SETUP, setupBrief } from "./setup-brief.ts";
import { COMPONENT_SPECS, SCENE_VERSION, parseScene, serializeScene, type ComponentType } from "./types.ts";

// #143: the setup brief teaches an AI assistant to write a setup file. Its
// example must be a file the builder opens as written, or the brief would
// teach a shape the parser drops.

const brief = setupBrief();

type Example = {
  version: number;
  components: { id: string; type: string }[];
  beams: { id: string; path: string[] }[];
};

function exampleFromBrief(): Example {
  const fenced = brief.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(fenced, "the brief should carry one JSON example");
  return JSON.parse(fenced[1]);
}

describe("the setup brief's example", () => {
  it("is valid JSON at the current scene version", () => {
    assert.equal(exampleFromBrief().version, SCENE_VERSION);
  });

  it("opens with every component it lists", () => {
    const example = exampleFromBrief();
    assert.deepEqual(
      parseScene(example)?.components.map(({ id, type }) => ({ id, type })),
      example.components.map(({ id, type }) => ({ id, type })),
    );
  });

  it("opens with every beam and its full path", () => {
    const example = exampleFromBrief();
    assert.deepEqual(
      parseScene(example)?.beams.map(({ id, path }) => ({ id, path })),
      example.beams.map(({ id, path }) => ({ id, path })),
    );
  });

  it("is what the builder would save: nothing in it is clamped, defaulted or re-angled", () => {
    const example = exampleFromBrief();
    assert.deepEqual(JSON.parse(serializeScene(parseScene(example)!)), example);
  });

  it("is the example the module exports", () => {
    assert.deepEqual(exampleFromBrief(), JSON.parse(serializeScene(EXAMPLE_SETUP)));
  });
});

describe("the setup brief", () => {
  it("names every component type", () => {
    for (const type of Object.keys(COMPONENT_SPECS) as ComponentType[]) {
      assert.ok(brief.includes(`- \`${type}\`: `), type);
    }
  });

  it("asks for the current scene version", () => {
    assert.ok(brief.includes(`always ${SCENE_VERSION}`));
  });
});
