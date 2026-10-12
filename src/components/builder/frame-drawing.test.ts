import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clickDrawing, closeOutline, dragRectangle, finishDrawing, nextCorner, previewDrawing } from "./frame-drawing.ts";
import { type Corner, TABLE_GUARD_MM } from "./types.ts";

// #155: "Add a frame" draws a frame by its corners. Each click puts a corner
// on the grid with the new side along x or z; a double-click, Enter or a click
// on the first corner closes the outline, adding an elbow where it needs one.

/** An L, 850 × 250 overall, in standard form. */
const L_SHAPE: Corner[] = [
  [0, 0],
  [850, 0],
  [850, 250],
  [700, 250],
  [700, 100],
  [0, 100],
];

const GRID = { step: 25 };

/** Click each point in turn, as a drawing would, and return the corners placed. */
function clickThrough(points: Corner[]): Corner[] {
  return points.reduce<Corner[]>((corners, point) => {
    const step = clickDrawing(corners, point, GRID);
    assert.equal(step.kind, "corner", `click at ${point}`);
    return step.kind === "corner" ? step.corners : corners;
  }, []);
}

describe("where the next corner goes", () => {
  it("puts the first one on the grid, or on 5 mm steps with ⇧", () => {
    assert.deepEqual(nextCorner([], [37, -62], 25), [25, -50]);
    assert.deepEqual(nextCorner([], [37, -62], 5), [35, -60]);
  });

  it("runs the new side along x when the pointer has moved further in x", () => {
    assert.deepEqual(nextCorner([[0, 0]], [180, 40], 25), [175, 0]);
  });

  it("runs the new side along z when the pointer has moved further in z", () => {
    assert.deepEqual(nextCorner([[0, 0]], [40, 180], 25), [0, 175]);
  });

  it("stays on the table", () => {
    assert.deepEqual(nextCorner([[TABLE_GUARD_MM - 100, 0]], [TABLE_GUARD_MM + 900, 10], 25), [TABLE_GUARD_MM, 0]);
  });
});

describe("closing an outline", () => {
  it("adds only the closing side when the last corner lines up with the first", () => {
    const square: Corner[] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    assert.deepEqual(closeOutline(square), square);
  });

  it("adds an elbow that turns at the last corner", () => {
    assert.deepEqual(closeOutline(L_SHAPE.slice(0, 5)), L_SHAPE);
  });

  it("runs straight on from the last corner when turning there would run back along the first side", () => {
    assert.deepEqual(
      closeOutline([
        [0, 0],
        [100, 0],
        [100, 100],
        [50, 100],
      ]),
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [50, 100],
        [0, 100],
      ],
    );
  });

  it("finishes an outline drawn from any corner, either way round, in standard form", () => {
    const drawn: Corner[] = [
      [850, 250],
      [850, 0],
      [0, 0],
      [0, 100],
      [700, 100],
    ];
    assert.deepEqual(finishDrawing(drawn), { kind: "done", corners: L_SHAPE });
  });

  it("refuses to close fewer than 3 corners", () => {
    assert.deepEqual(finishDrawing([[0, 0], [100, 0]]), {
      kind: "refused",
      reason: "Can't close the outline: it needs at least 3 corners.",
    });
  });

  it("refuses to close when either way back would cross the outline", () => {
    // a spiral: back from (200, 100), turning first meets the top side, running on meets the inner one
    const spiral: Corner[] = [
      [0, 0],
      [300, 0],
      [300, 300],
      [100, 300],
      [100, 100],
      [200, 100],
    ];
    assert.deepEqual(finishDrawing(spiral), {
      kind: "refused",
      reason: "Can't close the outline: a side would cross, touch or run back along another.",
    });
  });
});

describe("a click while drawing", () => {
  it("places corners on the grid, each side along x or z", () => {
    assert.deepEqual(clickThrough([[10, 30], [840, 40], [870, 260]]), [
      [0, 25],
      [850, 25],
      [850, 250],
    ]);
  });

  it("adds nothing on the last corner", () => {
    assert.deepEqual(clickDrawing([[0, 0], [100, 0]], [104, 8], GRID), { kind: "none" });
  });

  it("is refused when the new side would cross the outline", () => {
    const corners: Corner[] = [
      [0, 0],
      [300, 0],
      [300, 200],
      [100, 200],
    ];
    assert.deepEqual(clickDrawing(corners, [110, -100], GRID), {
      kind: "refused",
      reason: "Can't put a corner there: a side would cross, touch or run back along another.",
    });
  });

  it("is refused when the new side would run back along the last one", () => {
    assert.deepEqual(clickDrawing([[0, 0], [300, 0]], [100, 10], GRID), {
      kind: "refused",
      reason: "Can't put a corner there: a side would cross, touch or run back along another.",
    });
  });

  it("is refused when the new side would end on the outline", () => {
    const corners: Corner[] = [
      [0, 0],
      [300, 0],
      [300, 200],
      [150, 200],
    ];
    assert.equal(clickDrawing(corners, [160, 0], GRID).kind, "refused");
  });

  it("is refused when a side would be under 10 mm or the frame over 5000 mm across", () => {
    assert.deepEqual(clickDrawing([[0, 0]], [5, 1], { step: 5 }), {
      kind: "refused",
      reason: "Can't put a corner there: a side would be under 10 mm.",
    });
    assert.deepEqual(clickDrawing([[-3000, 0]], [2100, 0], GRID), {
      kind: "refused",
      reason: "Can't put a corner there: the frame would be over 5000 mm across.",
    });
  });

  it("closes the outline when the corner lands on the first one", () => {
    assert.deepEqual(clickDrawing([[0, 0], [100, 0], [100, 100], [0, 100]], [5, 10], GRID), {
      kind: "done",
      corners: [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
    });
  });

  it("closes the outline, elbow and all, when it is on the first corner on screen", () => {
    assert.deepEqual(clickDrawing(L_SHAPE.slice(0, 5), [3, -4], { ...GRID, onFirst: true }), { kind: "done", corners: L_SHAPE });
  });

  it("makes a U by clicks: the first click of a double-click places the last corner, the second closes it with no corner of its own", () => {
    const corners = clickThrough([
      [0, 0],
      [400, 0],
      [400, 300],
      [300, 300],
      [300, 100],
      [100, 100],
      [100, 300],
    ]);
    assert.deepEqual(finishDrawing(corners), {
      kind: "done",
      corners: [
        [0, 0],
        [400, 0],
        [400, 300],
        [300, 300],
        [300, 100],
        [100, 100],
        [100, 300],
        [0, 300],
      ],
    });
  });
});

describe("the preview while drawing", () => {
  it("shows the next corner and, from 3 corners, the way back with its elbow", () => {
    assert.deepEqual(previewDrawing([[0, 0], [850, 0]], [860, 240], GRID), {
      next: [850, 250],
      closing: [
        [850, 250],
        [0, 250],
        [0, 0],
      ],
      refused: null,
      reason: null,
    });
  });

  it("turns the next side red and says why when it would cross the outline", () => {
    const corners: Corner[] = [
      [0, 0],
      [300, 0],
      [300, 200],
      [100, 200],
    ];
    assert.deepEqual(previewDrawing(corners, [110, -100], GRID), {
      next: [100, -100],
      closing: null,
      refused: "next",
      reason: "Can't put a corner there: a side would cross, touch or run back along another.",
    });
  });

  it("turns the way back red and says why when the outline couldn't close from there", () => {
    const spiral: Corner[] = [
      [0, 0],
      [300, 0],
      [300, 300],
      [100, 300],
      [100, 100],
    ];
    assert.deepEqual(previewDrawing(spiral, [200, 110], GRID), {
      next: [200, 100],
      closing: [
        [200, 100],
        [200, 0],
        [0, 0],
      ],
      refused: "closing",
      reason: "Can't close the outline from there: a side would cross, touch or run back along another.",
    });
  });

  it("shows the outline closing when the pointer is on the first corner", () => {
    assert.deepEqual(previewDrawing(L_SHAPE.slice(0, 5), [2, 2], { ...GRID, onFirst: true }), {
      next: null,
      closing: [
        [700, 100],
        [0, 100],
        [0, 0],
      ],
      refused: null,
      reason: null,
    });
  });
});

describe("dragging out a rectangle", () => {
  it("runs from the press to the release, on the grid, in standard form", () => {
    assert.deepEqual(dragRectangle([610, 440], [-10, 10], 25), {
      corners: [
        [0, 0],
        [600, 0],
        [600, 450],
        [0, 450],
      ],
      reason: null,
    });
  });

  it("is refused when it is flat", () => {
    assert.deepEqual(dragRectangle([0, 0], [300, 5], 25).reason, "Can't make that rectangle: a side would be under 10 mm.");
  });
});
