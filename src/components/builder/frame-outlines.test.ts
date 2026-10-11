import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type Corner,
  EMPTY_SCENE,
  type Frame,
  FRAME_COLORS,
  TABLE_GUARD_MM,
  cornerBounds,
  isRectangle,
  isValidOutline,
  normaliseCorners,
  parseScene,
  rectangleCorners,
  serializeScene,
  translateCorners,
} from "./types.ts";

// #154: a frame is saved as its corners (scene version 7), so it can be an L
// or a U as well as a rectangle. These are the pure rules every outline is
// held to; drawing and reshaping reuse them live.

/** An L, 850 × 250 overall, in standard form: from the back-left, clockwise in the top-down view. */
const L_SHAPE: Corner[] = [
  [0, 0],
  [850, 0],
  [850, 250],
  [700, 250],
  [700, 100],
  [0, 100],
];

const SQUARE: Corner[] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

/** The same loop, starting at corner `from`. */
const startingAt = (corners: Corner[], from: number) => [...corners.slice(from), ...corners.slice(0, from)];

const atVersion = (version: number, frames: unknown) => parseScene({ version, components: [], frames })!.frames;
const cornersOf = (version: number, frame: object) => atVersion(version, [{ id: "f", ...frame }])[0].corners;

describe("putting an outline in standard form", () => {
  it("gives the same list whichever corner it starts at and whichever way it runs", () => {
    for (const shape of [SQUARE, L_SHAPE]) {
      for (let from = 0; from < shape.length; from += 1) {
        assert.deepEqual(normaliseCorners(startingAt(shape, from)), shape, `from ${from}`);
        assert.deepEqual(normaliseCorners(startingAt([...shape].reverse(), from)), shape, `reversed, from ${from}`);
      }
    }
  });

  it("starts at the back-most corner, and of those the left-most", () => {
    // a U open to the back: two corners share the smallest z
    const u: Corner[] = [
      [300, 0],
      [400, 0],
      [400, 200],
      [0, 200],
      [0, 0],
      [100, 0],
      [100, 100],
      [300, 100],
    ];
    assert.deepEqual(normaliseCorners(u)[0], [0, 0]);
  });

  it("runs clockwise as seen from above: along +x first from the back-left", () => {
    const [[x0, z0], [x1, z1]] = normaliseCorners([...L_SHAPE].reverse());
    assert.ok(x1 > x0 && z1 === z0);
  });

  it("drops repeated corners, a closing copy of the first, and corners in the middle of a side", () => {
    const messy: Corner[] = [
      [0, 0],
      [50, 0],
      [100, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 60],
      [0, 0],
    ];
    assert.deepEqual(normaliseCorners(messy), SQUARE);
  });

  it("keeps a side that doubles back, for the validity check to refuse", () => {
    const spike: Corner[] = [...SQUARE.slice(0, 2), [200, 0], [100, 0], ...SQUARE.slice(2)];
    assert.equal(isValidOutline(normaliseCorners(spike)), false);
  });

  it("leaves the list it was given as it was", () => {
    const given = [...L_SHAPE].reverse();
    const copy = given.map((corner) => [...corner]);
    normaliseCorners(given);
    assert.deepEqual(given, copy);
  });
});

describe("whether an outline is one a frame can have", () => {
  it("takes a rectangle, an L and a U", () => {
    const u: Corner[] = [
      [0, 0],
      [100, 0],
      [100, 200],
      [300, 200],
      [300, 0],
      [400, 0],
      [400, 300],
      [0, 300],
    ];
    for (const shape of [SQUARE, L_SHAPE, u]) assert.equal(isValidOutline(shape), true);
  });

  it("takes either direction and any starting corner", () => {
    assert.equal(isValidOutline(startingAt([...L_SHAPE].reverse(), 3)), true);
  });

  it("refuses fewer than 4 corners", () => {
    assert.equal(isValidOutline(SQUARE.slice(0, 3)), false);
    assert.equal(isValidOutline([]), false);
  });

  it("refuses a slanted side", () => {
    assert.equal(isValidOutline([[0, 0], [100, 0], [100, 100], [10, 100]]), false);
  });

  it("refuses a side shorter than 10 mm, but takes one of exactly 10", () => {
    assert.equal(isValidOutline([[0, 0], [9, 0], [9, 100], [0, 100]]), false);
    assert.equal(isValidOutline([[0, 0], [10, 0], [10, 100], [0, 100]]), true);
  });

  it("refuses an outline wider or deeper than 5000 mm overall", () => {
    assert.equal(isValidOutline(rectangleCorners([0, 0], 5000, 5000)), true);
    assert.equal(isValidOutline([[0, 0], [5001, 0], [5001, 100], [0, 100]]), false);
  });

  it("refuses an outline that crosses itself", () => {
    // a figure of eight made of right angles: the fourth side crosses the first
    const crossing: Corner[] = [
      [0, 0],
      [200, 0],
      [200, 100],
      [100, 100],
      [100, -100],
      [0, -100],
    ];
    assert.equal(isValidOutline(crossing), false);
  });

  it("refuses an outline that touches itself at a corner", () => {
    const pinched: Corner[] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [200, 100],
      [200, 200],
      [100, 200],
      [100, 100],
      [0, 100],
    ];
    assert.equal(isValidOutline(pinched), false);
  });

  it("refuses a side that runs back along the one before it", () => {
    assert.equal(isValidOutline([[0, 0], [100, 0], [50, 0], [50, 100], [0, 100]]), false);
  });

  it("refuses a value that isn't a finite number", () => {
    assert.equal(isValidOutline([[0, 0], [Number.NaN, 0], [100, 100], [0, 100]]), false);
  });
});

describe("an outline's bounding box", () => {
  it("is the box around every corner, with its width and depth", () => {
    assert.deepEqual(cornerBounds(startingAt(L_SHAPE, 2)), { minX: 0, minZ: 0, maxX: 850, maxZ: 250, width: 850, depth: 250 });
  });
});

describe("moving an outline", () => {
  it("moves every corner by the same step", () => {
    assert.deepEqual(
      translateCorners(L_SHAPE, 25, -50),
      L_SHAPE.map(([x, z]) => [x + 25, z - 50]),
    );
  });

  it("is held back at the table's edge, keeping its shape", () => {
    const moved = translateCorners(L_SHAPE, 1e9, -1e9);
    assert.deepEqual(cornerBounds(moved), {
      minX: TABLE_GUARD_MM - 850,
      minZ: -TABLE_GUARD_MM,
      maxX: TABLE_GUARD_MM,
      maxZ: -TABLE_GUARD_MM + 250,
      width: 850,
      depth: 250,
    });
    assert.deepEqual(normaliseCorners(moved), moved);
  });
});

describe("a rectangle", () => {
  it("is four corners in standard form from its back-left corner", () => {
    assert.deepEqual(rectangleCorners([0, 0], 100, 100), SQUARE);
    assert.deepEqual(normaliseCorners(rectangleCorners([-30, 40], 600, 450)), rectangleCorners([-30, 40], 600, 450));
  });

  it("keeps an editable width and depth; another shape doesn't", () => {
    assert.equal(isRectangle(SQUARE), true);
    assert.equal(isRectangle(L_SHAPE), false);
  });
});

describe("opening a frame's outline", () => {
  it("keeps a good outline, in standard form, whatever order the file lists it in", () => {
    assert.deepEqual(cornersOf(7, { corners: startingAt([...L_SHAPE].reverse(), 4) }), L_SHAPE);
  });

  it("drops repeated corners and corners in the middle of a side", () => {
    assert.deepEqual(cornersOf(7, { corners: [[0, 0], [0, 0], [50, 0], [100, 0], [100, 100], [0, 100], [0, 0]] }), SQUARE);
  });

  it("holds every corner to the table", () => {
    const edge = TABLE_GUARD_MM;
    assert.deepEqual(cornersOf(7, { corners: [[edge - 100, 0], [1e9, 0], [1e9, 100], [edge - 100, 100]] }), [
      [edge - 100, 0],
      [edge, 0],
      [edge, 100],
      [edge - 100, 100],
    ]);
  });
});

describe("opening a bad outline", () => {
  const rect = (x: number, z: number, width: number, depth: number) => rectangleCorners([x, z], width, depth);

  it("keeps a slanted one as its bounding rectangle", () => {
    assert.deepEqual(cornersOf(7, { corners: [[0, 0], [300, 0], [300, 200], [50, 250]] }), rect(0, 0, 300, 250));
  });

  it("keeps one that crosses itself as its bounding rectangle", () => {
    const crossing = [[0, 0], [200, 0], [200, 100], [100, 100], [100, -100], [0, -100]];
    assert.deepEqual(cornersOf(7, { corners: crossing }), rect(0, -100, 200, 200));
  });

  it("keeps one with fewer than 4 corners as its bounding rectangle", () => {
    assert.deepEqual(cornersOf(7, { corners: [[0, 0], [300, 0], [300, 200]] }), rect(0, 0, 300, 200));
  });

  it("keeps one with a side under 10 mm as its bounding rectangle, at least 10 mm each way", () => {
    assert.deepEqual(cornersOf(7, { corners: [[0, 0], [300, 0], [300, 5], [0, 5]] }), rect(0, 0, 300, 10));
  });

  it("keeps one wider than 5000 mm as a 5000 mm rectangle from its back-left corner", () => {
    assert.deepEqual(cornersOf(7, { corners: [[-4000, 0], [4000, 0], [4000, 100], [-4000, 100]] }), rect(-4000, 0, 5000, 100));
  });

  it("keeps one with a junk entry as the rectangle around its usable corners", () => {
    const junk = [[0, 0], [300, 0], "corner", [300, 200], [0, 200, 7], [0, Number.NaN], [-50, 100]];
    assert.deepEqual(cornersOf(7, { corners: junk }), rect(-50, 0, 350, 200));
  });

  it("gives one with no usable corner at all the default rectangle on the origin", () => {
    for (const corners of [[], "L", [["a", "b"]], [[null, 3]]]) {
      assert.deepEqual(cornersOf(7, { corners }), rect(-300, -225, 600, 450), JSON.stringify(corners));
    }
  });

  it("keeps the frame's id, colour, label, fill and hidden", () => {
    const [frame] = atVersion(7, [
      { id: "kept", corners: [[0, 0], [300, 0], [50, 250]], color: "#123456", label: "Cryostat", fill: false, hidden: true },
    ]);
    assert.deepEqual(frame, {
      id: "kept",
      corners: rect(0, 0, 300, 250),
      color: "#123456",
      label: "Cryostat",
      hidden: true,
      fill: false,
    });
  });

  it("drops a frame only when it has no id", () => {
    const frames = atVersion(7, [{ corners: SQUARE }, { id: "f", corners: "junk" }]);
    assert.deepEqual(
      frames.map(({ id }) => id),
      ["f"],
    );
  });
});

describe("the centre-and-size form saved before version 7", () => {
  const old = { position: [100, -50], width: 900, depth: 600 };
  const asCorners = rectangleCorners([-350, -350], 900, 600);

  it("opens from every older version as that rectangle's corners", () => {
    for (const version of [5, 6]) assert.deepEqual(cornersOf(version, old), asCorners, `version ${version}`);
  });

  it("is still read at version 7, for hand-written files", () => {
    assert.deepEqual(cornersOf(7, old), asCorners);
  });

  it("gives way to corners when a frame has both", () => {
    assert.deepEqual(cornersOf(7, { ...old, corners: L_SHAPE }), L_SHAPE);
  });

  it("is read when the corners are unusable", () => {
    assert.deepEqual(cornersOf(7, { ...old, corners: [["x", "y"]] }), asCorners);
  });

  it("is never written: a frame saves its corners alone", () => {
    const [frame] = atVersion(7, [{ id: "f", ...old }]);
    const saved = JSON.parse(serializeScene({ ...EMPTY_SCENE, frames: [frame] })).frames[0];
    assert.deepEqual(Object.keys(saved).sort(), ["color", "corners", "id"]);
  });
});

describe("saving and opening a frame's outline", () => {
  const l: Frame = { id: "l", corners: L_SHAPE, color: FRAME_COLORS[1], label: "L bench", fill: false };

  it("opens again unchanged", () => {
    const scene = { ...EMPTY_SCENE, frames: [l, { ...l, id: "r", corners: SQUARE, hidden: true as const }] };
    assert.deepEqual(parseScene(JSON.parse(serializeScene(scene)))?.frames, scene.frames);
  });

  it("gives an identical file when saved twice", () => {
    const once = serializeScene({ ...EMPTY_SCENE, frames: [l] });
    assert.equal(serializeScene(parseScene(JSON.parse(once))!), once);
  });
});
