/**
 * Where a plotter's data comes from: the bundled sample it opens with, a file
 * the user gives it, or text typed into it. The React hooks in
 * `use-plotter-source.ts` are thin wrappers over these functions.
 */

/** A source's value and where it came from, as the page shows it. */
export type SourceState<T> = {
  value: T;
  /** the file's name, "inline CSV" once edited */
  label: string;
  /**
   * Counts the files loaded. An upload or the sample loading changes it; an
   * edit doesn't. A page resets choices tied to the file (the X / Y picker)
   * when it changes, and keeps them while the user types.
   */
  fileId: number;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
};

export type SourceAction<T> =
  | { type: "loading" }
  | { type: "loaded"; value: T; label: string }
  | { type: "edited"; value: T }
  | { type: "failed"; error: string }
  // a load that failed quietly: what was shown stays
  | { type: "kept" };

export const INLINE_LABEL = "inline CSV";

export function initialSource<T>(value: T, label: string): SourceState<T> {
  return { value, label, fileId: 0, status: label ? "ready" : "idle", error: null };
}

export function sourceReducer<T>(state: SourceState<T>, action: SourceAction<T>): SourceState<T> {
  switch (action.type) {
    case "loading":
      return { ...state, status: "loading", error: null };
    case "loaded":
      return {
        value: action.value,
        label: action.label,
        fileId: state.fileId + 1,
        status: "ready",
        error: null,
      };
    case "edited":
      return { ...state, value: action.value, label: INLINE_LABEL, status: "ready", error: null };
    case "failed":
      return { ...state, status: "error", error: action.error };
    case "kept":
      return { ...state, status: state.label ? "ready" : "idle" };
  }
}

/**
 * Lets only the latest load through. Each load takes a ticket when it
 * starts, and its result is used only if no load, edit or unmount came
 * after it: a sample still downloading never overwrites a file the user
 * dropped in the meantime.
 */
export class LoadGate {
  private latest = 0;

  begin() {
    this.latest += 1;
    return this.latest;
  }

  isCurrent(ticket: number) {
    return ticket === this.latest;
  }

  /** drops every load in flight */
  cancel() {
    this.latest += 1;
  }
}

/**
 * Runs one load through the gate and reports it. `describe` turns an error
 * into the message the page shows, or null to keep what is shown.
 */
export async function runLoad<T>(
  gate: LoadGate,
  dispatch: (action: SourceAction<T>) => void,
  load: () => Promise<{ value: T; label: string }>,
  describe: (error: unknown) => string | null,
) {
  const ticket = gate.begin();
  dispatch({ type: "loading" });

  try {
    const { value, label } = await load();
    if (gate.isCurrent(ticket)) dispatch({ type: "loaded", value, label });
  } catch (error) {
    if (!gate.isCurrent(ticket)) return;
    const message = describe(error);
    dispatch(message === null ? { type: "kept" } : { type: "failed", error: message });
  }
}

/**
 * A bundled sample's address. The site may be served under a base path
 * (`/quop` on GitHub Pages), which is whatever comes before `/plotters/`.
 */
export function bundledAssetPath(filename: string, pathname: string) {
  const basePath = pathname.split("/plotters/")[0] ?? "";
  return `${basePath}/data/${filename}`;
}

/** The bundled sample couldn't be fetched. Its message is for the page. */
export class AssetLoadError extends Error {}

/** Fetches a bundled sample, with an error the page can show when it fails. */
export async function fetchAsset(fetcher: typeof fetch, filename: string, pathname: string) {
  let response: Response;

  try {
    response = await fetcher(bundledAssetPath(filename, pathname));
  } catch {
    throw new AssetLoadError(
      `Couldn't load the sample file ${filename} (network error). Choose a file to plot.`,
    );
  }

  if (!response.ok) {
    throw new AssetLoadError(
      `Couldn't load the sample file ${filename} (HTTP ${response.status}). Choose a file to plot.`,
    );
  }

  return response;
}

/** Why a file couldn't be read, for the page. */
export function describeReadError(error: unknown) {
  if (error instanceof AssetLoadError) return error.message;
  const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
  return `Couldn't read the file${detail}.`;
}

/**
 * The files a file input was given. Clears the input, so picking the same
 * file again still counts as a change.
 */
export function takeFiles(input: { files: ArrayLike<File> | null; value: string }) {
  const files = Array.from(input.files ?? []);
  if (files.length) input.value = "";
  return files;
}
