import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AssetLoadError,
  INLINE_LABEL,
  LoadGate,
  bundledAssetPath,
  describeReadError,
  fetchAsset,
  initialSource,
  runLoad,
  sourceReducer,
  takeFiles,
  type SourceAction,
  type SourceState,
} from "./plotter-source.ts";

// a source whose actions land in `state`, as useReducer would apply them
function harness<T>(initial: SourceState<T>) {
  const box = { state: initial };
  const dispatch = (action: SourceAction<T>) => {
    box.state = sourceReducer(box.state, action);
  };
  return { box, dispatch };
}

// a promise settled from outside, to finish loads in a chosen order
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("sourceReducer", () => {
  it("starts ready with a made-up file, idle with none", () => {
    assert.equal(initialSource("a,b", "demo.csv").status, "ready");
    assert.equal(initialSource(null, "").status, "idle");
  });

  it("counts a loaded file as a new file", () => {
    const state = sourceReducer(initialSource("a", "demo.csv"), {
      type: "loaded",
      value: "b",
      label: "data.csv",
    });

    assert.deepEqual(state, { value: "b", label: "data.csv", fileId: 1, status: "ready", error: null });
  });

  it("keeps the file an edit was made to, so the page keeps its X / Y choice", () => {
    const loaded = sourceReducer(initialSource("a", "demo.csv"), {
      type: "loaded",
      value: "b",
      label: "data.csv",
    });
    const edited = sourceReducer(loaded, { type: "edited", value: "bc" });

    assert.equal(edited.fileId, loaded.fileId);
    assert.equal(edited.value, "bc");
    assert.equal(edited.label, INLINE_LABEL);
  });

  it("keeps the value shown when a load fails, with the error", () => {
    const state = sourceReducer(initialSource("a", "demo.csv"), { type: "failed", error: "nope" });

    assert.equal(state.value, "a");
    assert.equal(state.status, "error");
    assert.equal(state.error, "nope");
  });

  it("clears the error when the next load starts", () => {
    const failed = sourceReducer(initialSource("a", "demo.csv"), { type: "failed", error: "nope" });

    assert.equal(sourceReducer(failed, { type: "loading" }).error, null);
  });
});

describe("runLoad", () => {
  it("reports a load that finishes", async () => {
    const { box, dispatch } = harness(initialSource("", ""));

    await runLoad(new LoadGate(), dispatch, async () => ({ value: "x", label: "x.csv" }), () => "bad");

    assert.equal(box.state.value, "x");
    assert.equal(box.state.status, "ready");
  });

  it("drops a sample that finishes after the user's upload", async () => {
    const gate = new LoadGate();
    const { box, dispatch } = harness(initialSource("demo", "demo.csv"));
    const sample = deferred<{ value: string; label: string }>();

    const sampleLoad = runLoad(gate, dispatch, () => sample.promise, () => "bad");
    await runLoad(gate, dispatch, async () => ({ value: "mine", label: "mine.csv" }), () => "bad");
    sample.resolve({ value: "sample", label: "power15.csv" });
    await sampleLoad;

    assert.equal(box.state.value, "mine");
    assert.equal(box.state.label, "mine.csv");
    assert.equal(box.state.fileId, 1);
  });

  it("drops a stale load's error too", async () => {
    const gate = new LoadGate();
    const { box, dispatch } = harness(initialSource("demo", "demo.csv"));
    const sample = deferred<{ value: string; label: string }>();

    const sampleLoad = runLoad(gate, dispatch, () => sample.promise, () => "sample failed");
    await runLoad(gate, dispatch, async () => ({ value: "mine", label: "mine.csv" }), () => "bad");
    sample.reject(new Error("offline"));
    await sampleLoad;

    assert.equal(box.state.status, "ready");
    assert.equal(box.state.error, null);
  });

  it("drops a load still running when the gate is cancelled (an edit, or the page closing)", async () => {
    const gate = new LoadGate();
    const { box, dispatch } = harness(initialSource("demo", "demo.csv"));
    const sample = deferred<{ value: string; label: string }>();

    const sampleLoad = runLoad(gate, dispatch, () => sample.promise, () => "bad");
    gate.cancel();
    sample.resolve({ value: "sample", label: "power15.csv" });
    await sampleLoad;

    assert.equal(box.state.value, "demo");
    assert.equal(box.state.fileId, 0);
  });

  it("shows the message a failed load is described with", async () => {
    const { box, dispatch } = harness(initialSource<string | null>(null, ""));

    await runLoad(
      new LoadGate(),
      dispatch,
      async () => {
        throw new Error("boom");
      },
      (error) => `failed: ${(error as Error).message}`,
    );

    assert.equal(box.state.status, "error");
    assert.equal(box.state.error, "failed: boom");
  });

  it("keeps what was shown when the failure is described as null", async () => {
    const { box, dispatch } = harness(initialSource("demo", "demo.csv"));

    await runLoad(
      new LoadGate(),
      dispatch,
      async () => {
        throw new Error("offline");
      },
      () => null,
    );

    assert.equal(box.state.status, "ready");
    assert.equal(box.state.value, "demo");
    assert.equal(box.state.error, null);
  });
});

describe("bundledAssetPath", () => {
  it("finds the sample under the site's base path", () => {
    assert.equal(bundledAssetPath("bec15.fits", "/quop/plotters/fits-plotter/"), "/quop/data/bec15.fits");
  });

  it("finds it at the root without one", () => {
    assert.equal(bundledAssetPath("power15.csv", "/plotters/csv-plotter/"), "/data/power15.csv");
  });
});

describe("fetchAsset", () => {
  it("fetches the sample from its address", async () => {
    const asked: string[] = [];
    const fetcher = (async (url: string) => {
      asked.push(url);
      return new Response("a,b");
    }) as typeof fetch;

    const response = await fetchAsset(fetcher, "power15.csv", "/quop/plotters/csv-plotter/");

    assert.deepEqual(asked, ["/quop/data/power15.csv"]);
    assert.equal(await response.text(), "a,b");
  });

  it("names the sample and the HTTP status when it's missing", async () => {
    const fetcher = (async () => new Response("", { status: 404 })) as typeof fetch;

    await assert.rejects(fetchAsset(fetcher, "bec15.fits", "/plotters/fits-plotter/"), (error) => {
      assert.ok(error instanceof AssetLoadError);
      assert.match(error.message, /bec15\.fits/);
      assert.match(error.message, /HTTP 404/);
      return true;
    });
  });

  it("says when the request didn't get through", async () => {
    const fetcher = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;

    await assert.rejects(fetchAsset(fetcher, "bec15.fits", "/plotters/fits-plotter/"), (error) => {
      assert.ok(error instanceof AssetLoadError);
      assert.match(error.message, /network error/);
      return true;
    });
  });
});

describe("describeReadError", () => {
  it("passes a sample's error through", () => {
    assert.equal(describeReadError(new AssetLoadError("no sample")), "no sample");
  });

  it("keeps the browser's detail for any other error", () => {
    assert.equal(describeReadError(new Error("permission denied")), "Couldn't read the file (permission denied).");
  });
});

describe("takeFiles", () => {
  it("returns the files and clears the input, so the same file can be picked again", () => {
    const file = new File(["a"], "a.csv");
    const input = { files: [file], value: "C:\\fakepath\\a.csv" };

    assert.deepEqual(takeFiles(input), [file]);
    assert.equal(input.value, "");
  });

  it("returns nothing when no file was picked", () => {
    const input = { files: null, value: "" };

    assert.deepEqual(takeFiles(input), []);
  });
});
