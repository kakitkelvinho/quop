import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_FRAME_SIZE_MM,
  EMPTY_SCENE,
  FRAME_COLORS,
  FRAME_SIZE_RANGE_MM,
  TABLE_GUARD_MM,
  type Frame,
  frameDisplayName,
  parseScene,
  SCENE_VERSION,
  serializeScene,
  setFrameHidden,
} from "./types.ts";

// #127: a frame is a labelled rectangle drawn on the table to mark an area.
// It is a drawing aid: it saves with the setup, can be hidden, and changes
// nothing else about the scene.

const breadboard: Frame = {
  id: "bb",
  position: [100, -50],
  width: 900,
  depth: 600,
  color: "#0891b2",
  label: "Main breadboard",
};

const parse = (frames: unknown) => parseScene({ version: 5, components: [], frames });

describe("reading frames", () => {
  it("is the version that added them", () => {
    assert.equal(SCENE_VERSION, 5);
  });

  it("opens a setup with no frames key, as older files are, with none", () => {
    assert.deepEqual(parseScene({ version: 4, components: [] })?.frames, []);
    assert.deepEqual(parseScene({ components: [] })?.frames, []);
  });

  it("opens a frames value that isn't a list with none", () => {
    assert.deepEqual(parse("nope")?.frames, []);
    assert.deepEqual(parse({ id: "x" })?.frames, []);
  });

  it("keeps every field it was saved with", () => {
    assert.deepEqual(parse([breadboard])?.frames, [breadboard]);
  });

  it("gives a frame with only an id the defaults: the table's centre, a breadboard's size, the first colour", () => {
    assert.deepEqual(parse([{ id: "bare" }])?.frames, [
      {
        id: "bare",
        position: [0, 0],
        width: DEFAULT_FRAME_SIZE_MM[0],
        depth: DEFAULT_FRAME_SIZE_MM[1],
        color: FRAME_COLORS[0],
      },
    ]);
  });

  it("drops what isn't a frame, and keeps the others in order", () => {
    const frames = parse([breadboard, null, 7, { label: "no id" }, { ...breadboard, id: "second" }])?.frames;
    assert.deepEqual(
      frames?.map(({ id }) => id),
      ["bb", "second"],
    );
  });

  it("holds the size to its range and the centre to the table's guard", () => {
    const [frame] = parse([{ id: "x", width: 1, depth: 1e9, position: [1e9, -1e9] }])!.frames;
    assert.equal(frame.width, FRAME_SIZE_RANGE_MM[0]);
    assert.equal(frame.depth, FRAME_SIZE_RANGE_MM[1]);
    assert.deepEqual(frame.position, [TABLE_GUARD_MM, -TABLE_GUARD_MM]);
  });

  it("reads anything but true as shown, and a label that isn't text as none", () => {
    const frames = parse([
      { id: "a", hidden: false, label: 3 },
      { id: "b", hidden: "yes" },
    ])!.frames;
    assert.deepEqual(
      frames.map((frame) => ["hidden" in frame, "label" in frame]),
      [
        [false, false],
        [false, false],
      ],
    );
  });
});

describe("hiding and showing a frame", () => {
  const frames: Frame[] = [breadboard, { ...breadboard, id: "other" }];

  it("stores hidden: true on that frame only", () => {
    assert.deepEqual(setFrameHidden(frames, "bb", true), [{ ...breadboard, hidden: true }, frames[1]]);
  });

  it("takes the key away when it is shown again, rather than storing false", () => {
    const shown = setFrameHidden(setFrameHidden(frames, "bb", true), "bb", false);
    assert.deepEqual(shown, frames);
    assert.equal("hidden" in shown[0], false);
  });

  it("leaves the list it was given as it was", () => {
    setFrameHidden(frames, "bb", true);
    assert.equal("hidden" in frames[0], false);
  });

  it("keeps the frame's label, colour and size, and its place in the list", () => {
    const [first, second] = setFrameHidden(frames, "bb", true);
    assert.deepEqual(first, { ...breadboard, hidden: true });
    assert.equal(second.id, "other");
  });
});

describe("frames in a saved setup", () => {
  const scene = { ...EMPTY_SCENE, frames: [breadboard, { ...breadboard, id: "hid", hidden: true as const }] };

  it("save and open again unchanged, hidden ones still hidden", () => {
    assert.deepEqual(parseScene(JSON.parse(serializeScene(scene)))?.frames, scene.frames);
  });

  it("are written as version 5, and a shown frame carries no hidden key", () => {
    const saved = JSON.parse(serializeScene(scene));
    assert.equal(saved.version, 5);
    assert.equal("hidden" in saved.frames[0], false);
    assert.equal(saved.frames[1].hidden, true);
  });

  it("do not touch the parts, beams or connections", () => {
    const opened = parseScene(JSON.parse(serializeScene(scene)))!;
    assert.deepEqual([opened.components, opened.beams, opened.connections], [[], [], []]);
  });
});

describe("a frame's name", () => {
  it("is its label, trimmed", () => {
    assert.equal(frameDisplayName({ ...breadboard, label: "  Cryostat  " }), "Cryostat");
  });

  it("is its size when it has no label, or a blank one", () => {
    assert.equal(frameDisplayName({ ...breadboard, label: undefined }), "Frame 900 × 600 mm");
    assert.equal(frameDisplayName({ ...breadboard, label: "   " }), "Frame 900 × 600 mm");
  });
});
