import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGroup, deleteGroup } from "./groups.ts";
import { editJson, jsonPanelView, type JsonDraft } from "./json-panel-text.ts";
import { checkSceneText } from "./scene-text.ts";
import { DEFAULT_SCENE, serializeScene, type BuilderComponent, type BuilderSceneData, type Vec3 } from "./types.ts";

// The JSON panel's box follows the table until the author edits it, so the
// JSON copied from it is always what is on screen.

const shown = (scene: BuilderSceneData, draft: JsonDraft | null = null) =>
  jsonPanelView(serializeScene(scene), draft);

const parsed = (text: string) => JSON.parse(text) as BuilderSceneData;

const withComponent = (scene: BuilderSceneData, id: string, change: Partial<BuilderComponent>): BuilderSceneData => ({
  ...scene,
  components: scene.components.map((component) => (component.id === id ? { ...component, ...change } : component)),
});

const LENS = "lens-1";
const lensIn = (text: string) => parsed(text).components.find((component) => component.id === LENS);

describe("the JSON panel following the table", () => {
  it("shows the table as it is, untouched", () => {
    const view = shown(DEFAULT_SCENE);
    assert.equal(view.text, serializeScene(DEFAULT_SCENE));
    assert.equal(view.edited, false);
    assert.equal(view.behind, false);
  });

  it("follows a drag, a turn and a property edit", () => {
    const moved: Vec3 = [40, 100, -150];
    let scene = withComponent(DEFAULT_SCENE, LENS, { position: moved });
    assert.deepEqual(lensIn(shown(scene).text)?.position, moved);

    scene = withComponent(scene, LENS, { rotation: 30 });
    assert.equal(lensIn(shown(scene).text)?.rotation, 30);

    scene = withComponent(scene, LENS, { focalLength: 250, label: "L2" });
    const lens = lensIn(shown(scene).text);
    assert.equal(lens?.focalLength, 250);
    assert.equal(lens?.label, "L2");
  });

  it("follows adding, deleting and grouping parts", () => {
    const added: BuilderComponent = { id: "mirror-new", type: "mirror-mount", position: [0, 100, 200], rotation: 45 };
    let scene: BuilderSceneData = { ...DEFAULT_SCENE, components: [...DEFAULT_SCENE.components, added] };
    assert.ok(parsed(shown(scene).text).components.some((component) => component.id === "mirror-new"));

    scene = { ...scene, components: scene.components.filter((component) => component.id !== LENS) };
    assert.equal(lensIn(shown(scene).text), undefined);

    const grouped = createGroup(scene, ["mirror-new"], "Pump", () => "group-pump");
    const group = parsed(shown(grouped.scene).text).groups.find((entry) => entry.id === grouped.id);
    assert.equal(group?.name, "Pump");
    assert.deepEqual(group?.members, ["mirror-new"]);

    const ungrouped = deleteGroup(grouped.scene, grouped.id);
    assert.equal(parsed(shown(ungrouped).text).groups.length, ungrouped.groups.length);
  });

  it("reads back as the scene on screen", () => {
    const scene = withComponent(DEFAULT_SCENE, LENS, { position: [60, 100, -150], rotation: 15 });
    const check = checkSceneText(shown(scene).text);
    assert.equal(check.ok, true);
    if (check.ok) assert.equal(serializeScene(check.scene), serializeScene(scene));
  });
});

describe("the author's draft in the JSON panel", () => {
  const live = serializeScene(DEFAULT_SCENE);
  const typed = live.replace('"rotation": 0', '"rotation": 90');

  it("keeps what the author typed while the table changes", () => {
    const draft = editJson(live, null, typed);
    assert.deepEqual(draft, { text: typed, base: live });

    const later = withComponent(DEFAULT_SCENE, LENS, { rotation: 45 });
    const view = shown(later, draft);
    assert.equal(view.text, typed);
    assert.equal(view.edited, true);
    assert.equal(view.behind, true);
  });

  it("isn't behind while the table stands still", () => {
    const view = shown(DEFAULT_SCENE, editJson(live, null, typed));
    assert.equal(view.edited, true);
    assert.equal(view.behind, false);
  });

  it("remembers where it began across further edits", () => {
    const first = editJson(live, null, typed);
    const later = serializeScene(withComponent(DEFAULT_SCENE, LENS, { rotation: 45 }));
    const second = editJson(later, first, `${typed} `);
    assert.equal(second?.base, live);
  });

  it("goes back to following the table once it matches it", () => {
    const draft = editJson(live, null, typed);
    assert.equal(editJson(live, draft, live), null);
    assert.equal(shown(DEFAULT_SCENE, editJson(live, draft, live)).edited, false);
  });
});
