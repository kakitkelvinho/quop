import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { beamLengthMm, DEFAULT_OBJECTIVE_LENGTH_MM, parseScene, serializeScene } from "./types.ts";

// ADR 0001: a setup file saved by a release keeps opening, with nothing
// dropped, in every later release. Each fixture is a setup file in the shape
// one schema version saved; see setup-fixtures/README.md before touching them.

const FIXTURES = [
  "setup-v1.json",
  "setup-v2.json",
  "setup-v3.json",
  "setup-v4.json",
  "setup-v5.json",
  "setup-v6.json",
  "setup-v7.json",
  "setup-v8.json",
  "setup-v9.json",
];

/** Older files name beam cubes these ways; they open as beam cubes. */
const LEGACY_NAMES: Record<string, string> = {
  beamsplitter: "beam-splitter",
  "pbs-cube": "beam-splitter",
};

type SavedSetup = {
  components: { id: string; type: string }[];
  beams: { id: string; path: string[] }[];
  connections?: object[];
  frames?: object[];
};

function readSaved(name: string): SavedSetup {
  return JSON.parse(readFileSync(new URL(`./setup-fixtures/${name}`, import.meta.url), "utf8"));
}

function open(name: string) {
  const setup = parseScene(readSaved(name));
  assert.ok(setup, `${name} should open`);
  return setup;
}

for (const name of FIXTURES) {
  describe(name, () => {
    const saved = readSaved(name);

    it("opens with every component it was saved with", () => {
      assert.deepEqual(
        open(name).components.map(({ id, type }) => ({ id, type })),
        saved.components.map(({ id, type }) => ({ id, type: LEGACY_NAMES[type] ?? type })),
      );
    });

    it("opens with every beam and its full path", () => {
      assert.deepEqual(
        open(name).beams.map(({ id, path }) => ({ id, path })),
        saved.beams.map(({ id, path }) => ({ id, path })),
      );
    });

    it("opens with every connection it was saved with, or none before v3", () => {
      assert.deepEqual(open(name).connections, saved.connections ?? []);
    });

    it("keeps a trapped particle in its trap", () => {
      assert.equal(open(name).components.find(({ id }) => id === "ion")?.host, "trap");
    });

    it("gives the same setup when saved and opened again", () => {
      const setup = open(name);
      assert.deepEqual(parseScene(JSON.parse(serializeScene(setup))), setup);
    });
  });
}

describe("setup-v2.json, the first version with heights", () => {
  it("keeps each component at the height it was saved at", () => {
    assert.equal(open("setup-v2.json").components.find(({ id }) => id === "cam")?.position[1], 125);
  });
});

describe("setup-v3.json, the first version with connections", () => {
  it("opens each fibre and cable with its ends, length and index, and older setups with none", () => {
    assert.deepEqual(
      open("setup-v3.json").connections.map(({ id, kind, from, to, lengthM }) => [id, kind, from, to, lengthM]),
      [
        ["fib-a", "fiber", "fiber", "pd", 2],
        ["coax-a", "cable", "pd", "tagger", undefined],
        ["coax-cam", "cable", "cam", "tagger", 1.5],
        ["fib-spare", "fiber", "fiber", "spec", undefined],
      ],
    );
    assert.equal(open("setup-v3.json").connections[0].refractiveIndex, 1.47);
    assert.equal(open("setup-v3.json").connections[2].velocityFactor, 0.7);
    assert.deepEqual(open("setup-v1.json").connections, []);
    assert.deepEqual(open("setup-v2.json").connections, []);
  });
});

describe("setup-v3.json, a laser with a built-in path", () => {
  it("opens with the path and counts it in its beam: 4000 mm inside plus 450 mm on the table", () => {
    const setup = open("setup-v3.json");
    assert.equal(setup.components.find(({ id }) => id === "laser-folded")?.internalPathMm, 4000);
    assert.equal(beamLengthMm(setup.components, setup.beams.find(({ id }) => id === "folded")!), 4450);
  });

  it("is on no laser in older setups", () => {
    for (const name of ["setup-v1.json", "setup-v2.json"]) {
      const lasers = open(name).components.filter(({ type }) => type === "laser-source");
      assert.ok(lasers.length > 0);
      assert.deepEqual(lasers.map(({ internalPathMm }) => internalPathMm), lasers.map(() => undefined));
    }
  });
});

describe("setup-v4.json, the first version with hidden beams", () => {
  it("opens the reference arm hidden and every other beam shown", () => {
    assert.deepEqual(
      open("setup-v4.json").beams.map(({ id, hidden }) => [id, hidden]),
      [
        ["probe", undefined],
        ["imaging", undefined],
        ["lock", undefined],
        ["leak", undefined],
        ["folded", undefined],
        ["reference", true],
      ],
    );
  });

  it("keeps the arm hidden after being saved and opened again", () => {
    const again = parseScene(JSON.parse(serializeScene(open("setup-v4.json"))));
    assert.equal(again?.beams.find(({ id }) => id === "reference")?.hidden, true);
    assert.equal(again?.beams.filter(({ hidden }) => hidden).length, 1);
  });

  it("opens every older setup with every beam shown", () => {
    for (const name of ["setup-v1.json", "setup-v2.json", "setup-v3.json"]) {
      assert.deepEqual(
        open(name).beams.filter((beam) => "hidden" in beam),
        [],
        name,
      );
    }
  });
});

// v5's and v6's frames were saved as a centre and a size; they open as these corners
const BREADBOARD = [
  [-450, -300],
  [450, -300],
  [450, 300],
  [-450, 300],
];
const ENCLOSURE = [
  [-850, 375],
  [-550, 375],
  [-550, 625],
  [-850, 625],
];
const LOCK_AREA = [
  [-450, -587.5],
  [100, -587.5],
  [100, -212.5],
  [-450, -212.5],
];

describe("setup-v5.json, the first version with frames", () => {
  it("opens both frames with their size, colour, label and place, the second hidden", () => {
    assert.deepEqual(open("setup-v5.json").frames, [
      { id: "breadboard", corners: BREADBOARD, color: "#0891b2", label: "Main breadboard" },
      { id: "enclosure", corners: ENCLOSURE, color: "#ea580c", label: "Laser enclosure", hidden: true },
    ]);
  });

  it("keeps both frames, and the hidden one hidden, after being saved and opened again", () => {
    const again = parseScene(JSON.parse(serializeScene(open("setup-v5.json"))));
    assert.deepEqual(again?.frames, open("setup-v5.json").frames);
  });

  it("is v4's setup in every other way: its parts, and the reference arm still hidden", () => {
    assert.deepEqual(open("setup-v5.json").components, open("setup-v4.json").components);
    assert.equal(open("setup-v5.json").beams.find(({ id }) => id === "reference")?.hidden, true);
  });

  it("opens every older setup with no frames", () => {
    for (const name of ["setup-v1.json", "setup-v2.json", "setup-v3.json", "setup-v4.json"]) {
      assert.deepEqual(open(name).frames, [], name);
    }
  });
});

describe("setup-v6.json, the first version with unfilled frames", () => {
  it("opens the lock-optics frame as its outline alone, and the other two filled", () => {
    assert.deepEqual(
      open("setup-v6.json").frames.map(({ id, fill }) => [id, fill]),
      [
        ["breadboard", undefined],
        ["enclosure", undefined],
        ["lock-area", false],
      ],
    );
  });

  it("keeps it unfilled after being saved and opened again", () => {
    const again = parseScene(JSON.parse(serializeScene(open("setup-v6.json"))));
    assert.deepEqual(again?.frames, open("setup-v6.json").frames);
  });

  it("is v5's setup in every other way: its parts, beams, connections and first two frames", () => {
    const [v5, v6] = [open("setup-v5.json"), open("setup-v6.json")];
    assert.deepEqual([v6.components, v6.beams, v6.connections], [v5.components, v5.beams, v5.connections]);
    assert.deepEqual(v6.frames.slice(0, 2), v5.frames);
  });

  it("opens every older setup with every frame filled", () => {
    for (const name of FIXTURES.slice(0, FIXTURES.indexOf("setup-v6.json"))) {
      assert.deepEqual(
        open(name).frames.filter((frame) => "fill" in frame),
        [],
        name,
      );
    }
  });
});

describe("setup-v7.json, the first version with frames saved as corners", () => {
  it("opens v6's three frames as the same rectangles, and the L with its six corners", () => {
    assert.deepEqual(
      open("setup-v7.json").frames.map(({ id, corners }) => [id, corners]),
      [
        ["breadboard", BREADBOARD],
        ["enclosure", ENCLOSURE],
        ["lock-area", LOCK_AREA],
        [
          "imaging-area",
          [
            [-200, 100],
            [0, 100],
            [0, 650],
            [600, 650],
            [600, 800],
            [-200, 800],
          ],
        ],
      ],
    );
  });

  it("is v6's setup in every other way: its parts, beams, connections and first three frames", () => {
    const [v6, v7] = [open("setup-v6.json"), open("setup-v7.json")];
    assert.deepEqual([v7.components, v7.beams, v7.connections], [v6.components, v6.beams, v6.connections]);
    assert.deepEqual(v7.frames.slice(0, 3), v6.frames);
  });

  it("is saved exactly as it was written", () => {
    assert.deepEqual(JSON.parse(serializeScene(open("setup-v7.json"))).frames, readSaved("setup-v7.json").frames);
  });

  it("opens every older setup's frames as rectangles of four corners, with no centre or size left", () => {
    for (const name of FIXTURES.slice(0, FIXTURES.indexOf("setup-v7.json"))) {
      for (const frame of open(name).frames) {
        assert.equal(frame.corners.length, 4, `${name} ${frame.id}`);
        assert.deepEqual(Object.keys(frame).filter((key) => ["position", "width", "depth"].includes(key)), []);
      }
    }
  });
});

describe("setup-v8.json, the first version with an objective length", () => {
  const objective = (name: string) => open(name).components.find(({ id }) => id === "obj");

  it("opens the objective 80 mm long", () => {
    assert.equal(objective("setup-v8.json")?.objectiveLength, 80);
  });

  it("keeps the length after being saved and opened again", () => {
    const setup = open("setup-v8.json");
    assert.equal(
      parseScene(JSON.parse(serializeScene(setup)))?.components.find(({ id }) => id === "obj")?.objectiveLength,
      80,
    );
  });

  it("is v7's setup in every other way", () => {
    const [v7, v8] = [open("setup-v7.json"), open("setup-v8.json")];
    const v7WithLength = v7.components.map((c) => (c.id === "obj" ? { ...c, objectiveLength: 80 } : c));
    assert.deepEqual([v8.components, v8.beams, v8.connections, v8.frames], [v7WithLength, v7.beams, v7.connections, v7.frames]);
  });

  it(`opens every older setup's objective at the default ${DEFAULT_OBJECTIVE_LENGTH_MM} mm`, () => {
    for (const name of FIXTURES.slice(0, FIXTURES.indexOf("setup-v8.json"))) {
      const obj = objective(name);
      if (obj) assert.equal(obj.objectiveLength, undefined, name);
    }
  });
});

describe("setup-v9.json, the first version with a frame's fill opacity", () => {
  const solid = (name: string) => open(name).frames.find(({ id }) => id === "frame-solid");

  it("opens the solid frame fully opaque, and keeps it through a save", () => {
    assert.equal(solid("setup-v9.json")?.fillOpacity, 1);
    const again = parseScene(JSON.parse(serializeScene(open("setup-v9.json"))));
    assert.equal(again?.frames.find(({ id }) => id === "frame-solid")?.fillOpacity, 1);
  });

  it("is v8's setup plus that frame", () => {
    const [v8, v9] = [open("setup-v8.json"), open("setup-v9.json")];
    assert.deepEqual([v9.components, v9.beams, v9.connections], [v8.components, v8.beams, v8.connections]);
    assert.deepEqual(v9.frames.slice(0, -1), v8.frames);
  });

  it("opens every older setup's frames at the faint default", () => {
    for (const name of FIXTURES.slice(0, FIXTURES.indexOf("setup-v9.json"))) {
      for (const frame of open(name).frames) assert.equal(frame.fillOpacity, undefined, `${name} ${frame.id}`);
    }
  });
});
