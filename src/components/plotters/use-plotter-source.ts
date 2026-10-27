"use client";

import { useCallback, useEffect, useReducer, useRef, type ChangeEvent } from "react";

import { describeFitsError } from "@/components/plotters/fits-errors";
import { parseFitsFile, type FitsSummary } from "@/components/plotters/fits-file";
import {
  AssetLoadError,
  LoadGate,
  describeReadError,
  fetchAsset,
  initialSource,
  runLoad,
  sourceReducer,
  takeFiles,
  type SourceAction,
  type SourceState,
} from "@/components/plotters/plotter-source";

type Load<T> = () => Promise<{ value: T; label: string }>;
type Describe = (error: unknown) => string | null;

/**
 * The state every source shares: a reducer, and a gate that lets only the
 * latest load through and drops loads still running when the page closes.
 * `sample`, when given, loads once on mount.
 */
function useSource<T>(initial: SourceState<T>, sample: Load<T> | null, describeSample: Describe) {
  const [state, dispatch] = useReducer(
    sourceReducer as (state: SourceState<T>, action: SourceAction<T>) => SourceState<T>,
    initial,
  );
  const gateRef = useRef<LoadGate | null>(null);
  if (gateRef.current === null) gateRef.current = new LoadGate();
  // the sample loader is read once, on mount
  const sampleRef = useRef({ sample, describeSample });

  useEffect(() => {
    const gate = gateRef.current!;
    const { sample, describeSample } = sampleRef.current;
    if (sample) void runLoad(gate, dispatch, sample, describeSample);
    return () => gate.cancel();
  }, []);

  const load = useCallback(
    (next: Load<T>, describe: Describe) => runLoad(gateRef.current!, dispatch, next, describe),
    [],
  );
  const edit = useCallback((value: T) => {
    // typing wins over a sample still downloading
    gateRef.current!.cancel();
    dispatch({ type: "edited", value });
  }, []);

  return { state, load, edit };
}

/**
 * A CSV plotter's text: the bundled `sample` (fetched on mount, keeping
 * `initial` if it can't be), an uploaded file, or text typed in.
 */
export function useCsvSource({
  initial,
  sample,
}: {
  initial: { text: string; label: string };
  sample?: string;
}) {
  const { state, load, edit } = useSource(
    initialSource(initial.text, initial.label),
    sample
      ? async () => {
          const response = await fetchAsset(fetch, sample, window.location.pathname);
          return { value: await response.text(), label: sample };
        }
      : null,
    // a missing sample leaves the made-up one in its place, as before
    () => null,
  );

  const upload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = takeFiles(event.target);
      if (!file) return;
      void load(async () => ({ value: await file.text(), label: file.name }), describeReadError);
    },
    [load],
  );

  return {
    text: state.value,
    label: state.label,
    fileId: state.fileId,
    status: state.status,
    error: state.error,
    upload,
    edit,
  };
}

/** Several CSV files given at once, each as its text and name. */
export function useCsvFiles() {
  const { state, load } = useSource<{ text: string; label: string }[]>(
    initialSource([], ""),
    null,
    () => null,
  );

  const upload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = takeFiles(event.target);
      if (!files.length) return;
      void load(
        async () => ({
          value: await Promise.all(
            files.map(async (file) => ({ text: await file.text(), label: file.name })),
          ),
          label: files.map((file) => file.name).join(", "),
        }),
        describeReadError,
      );
    },
    [load],
  );
  const clear = useCallback(() => void load(async () => ({ value: [], label: "" }), () => null), [load]);

  return { files: state.value, error: state.error, upload, clear };
}

function describeFits(error: unknown) {
  return error instanceof AssetLoadError ? error.message : describeFitsError(error);
}

/** A FITS plotter's file: the bundled `sample`, fetched on mount, or an upload. */
export function useFitsSource({ sample }: { sample: string }) {
  const { state, load } = useSource<FitsSummary | null>(
    initialSource(null, ""),
    async () => {
      const response = await fetchAsset(fetch, sample, window.location.pathname);
      const file = new File([await response.arrayBuffer()], sample, { type: "application/fits" });
      return { value: await parseFitsFile(file), label: sample };
    },
    describeFits,
  );

  const upload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = takeFiles(event.target);
      if (!file) return;
      void load(async () => ({ value: await parseFitsFile(file), label: file.name }), describeFits);
    },
    [load],
  );

  // a file that failed to open shows nothing, not the one before it
  const summary = state.status === "error" ? null : state.value;

  return {
    summary,
    isLoading: state.status === "loading",
    error: state.error,
    upload,
  };
}
