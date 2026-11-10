// The Dry Run's own file: a full copy of the setup it ran on, the beam it
// picked and its own parameters. Setup files stay as they are; this one sits
// beside them. Prototype for #341: no versioned migrations yet.

import { type BuilderSceneData, parseScene, serializeScene } from "../builder/types.ts";
import { DEFAULT_PARAMS, type DryRunParams } from "./capture.ts";

export const STATE_FORMAT = "quop-dry-run";
export const STATE_VERSION = 1;

export type DryRunState = {
  setupName: string;
  setup: BuilderSceneData;
  beamId: string | null;
  params: DryRunParams;
};

export function serializeState(state: DryRunState): string {
  return JSON.stringify(
    {
      format: STATE_FORMAT,
      version: STATE_VERSION,
      setupName: state.setupName,
      beamId: state.beamId,
      params: state.params,
      setup: JSON.parse(serializeScene(state.setup)),
    },
    null,
    2,
  );
}

/** Parameters from a file, each kept only if it has the default's type. */
function parseParams(raw: unknown): DryRunParams {
  const params: DryRunParams = { ...DEFAULT_PARAMS };
  if (!raw || typeof raw !== "object") return params;
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PARAMS) as (keyof DryRunParams)[]) {
    const value = record[key];
    if (typeof value === typeof DEFAULT_PARAMS[key] && (typeof value !== "number" || Number.isFinite(value))) {
      (params as Record<string, unknown>)[key] = value;
    }
  }
  return params;
}

export type OpenedFile =
  | { kind: "state"; state: DryRunState }
  | { kind: "setup"; setup: BuilderSceneData }
  | { kind: "error"; reason: string };

/** A file the page was handed: a Dry Run file, a plain Tabletop setup file, or neither. */
export function readOpenedFile(text: string, fileName: string): OpenedFile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { kind: "error", reason: `${fileName} is not JSON.` };
  }
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (record?.format === STATE_FORMAT) {
    const setup = parseScene(record.setup);
    if (!setup) return { kind: "error", reason: `${fileName} is a Dry Run file, but the setup inside it could not be read.` };
    return {
      kind: "state",
      state: {
        setupName: typeof record.setupName === "string" ? record.setupName : fileName,
        setup,
        beamId: typeof record.beamId === "string" ? record.beamId : null,
        params: parseParams(record.params),
      },
    };
  }
  const setup = parseScene(value);
  if (!setup) return { kind: "error", reason: `${fileName} is neither a Tabletop setup nor a Dry Run file.` };
  return { kind: "setup", setup };
}
