// The Dry Run's worker: runs a power series off the main thread, one capture
// at a time, and posts each one as soon as it is done, so the page fills the
// series in point by point and never freezes. Stopping is the page
// terminating the worker.

import { type CaptureResult, type CaptureSetup, type DryRunParams, buildLadder, ladderParams, takeCapture } from "./capture.ts";

export type WorkerRequest = {
  runId: number;
  params: DryRunParams;
  optics: CaptureSetup;
  fluences: number[];
};

export type WorkerMessage =
  | { type: "started"; runId: number; bins: number }
  | { type: "capture"; runId: number; index: number; result: CaptureResult }
  | { type: "done"; runId: number; ms: number }
  | { type: "error"; runId: number; message: string };

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
  (self as unknown as { postMessage: (m: WorkerMessage, t: Transferable[]) => void }).postMessage(message, transfer);

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { runId, params, optics, fluences } = event.data;
  const start = performance.now();
  try {
    const ladder = buildLadder(ladderParams(params));
    post({ type: "started", runId, bins: ladder.energy.length });
    fluences.forEach((fluence, index) => {
      const result = takeCapture(ladder, params, optics, fluence, index + 1);
      post({ type: "capture", runId, index, result }, [result.capture.pixels.buffer as ArrayBuffer]);
    });
    post({ type: "done", runId, ms: performance.now() - start });
  } catch (error) {
    post({ type: "error", runId, message: error instanceof Error ? error.message : String(error) });
  }
};
