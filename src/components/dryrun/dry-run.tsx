"use client";

// The Dry Run page (prototype for #341): a Tabletop setup in, a power series
// of spectrometer captures out. The setup is the page: it is drawn in 3D by the
// Tabletop's own canvas (bench-scene.tsx), lit by what the physics model gives
// at the current pump power, and the plots and settings sit in a side panel
// that an instrument in the scene opens at its own tab. The physics runs in a
// Web Worker (dry-run.worker.ts), so the scene keeps turning while it works.

import { Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Title, Tooltip } from "chart.js";
import dynamic from "next/dynamic";
import { type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { type GraphicsQuality, readStoredQuality, storeQuality } from "@/components/builder/graphics-quality";
import { useScenePalette } from "@/components/builder/scene-theme";
import { type BuilderSceneData, serializeScene } from "@/components/builder/types";
import type { BenchLight, PanelTab } from "@/components/dryrun/bench-scene";
import { beamName, beamOptics } from "@/components/dryrun/beam-optics";
import {
  CHIP,
  type CaptureResult,
  DEFAULT_PARAMS,
  type DryRunParams,
  EV,
  LIGHT_MODEL_BINS,
  absorbedPerPulse,
  columnEnergies,
  rowAngles,
  seriesFluences,
} from "@/components/dryrun/capture";
import type { WorkerMessage, WorkerRequest } from "@/components/dryrun/dry-run.worker";
import { LAB_BEAM as EXAMPLE_BEAM, LAB_SETUP as EXAMPLE_SETUP, LAB_SETUP_NAME as EXAMPLE_SETUP_NAME } from "@/components/dryrun/lab-setup";
import { DRY_RUN_NAME } from "@/components/dryrun/names";
import { readOpenedFile, serializeState } from "@/components/dryrun/state-file";
import { FileDrop } from "@/components/plotters/file-drop";
import FitsImageViewer from "@/components/plotters/fits-image-viewer";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { TABLE_II } from "@/components/simulator/ladder";
import { useNumberDraft } from "@/components/use-number-draft";

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// the canvas is WebGL only: no server render
const BenchScene = dynamic(() => import("@/components/dryrun/bench-scene"), {
  ssr: false,
  loading: () => <div className="dryRun__sceneWaiting" />,
});

const FULL_BINS = 101;

const TABS: { id: PanelTab; label: string }[] = [
  { id: "capture", label: "Capture" },
  { id: "curves", label: "Curves" },
  { id: "pump", label: "Pump" },
  { id: "optics", label: "Optics" },
  { id: "model", label: "Setup" },
];

type Run = {
  fluences: number[];
  results: (CaptureResult | null)[];
  /** the parameters it ran with, to tell when the page has moved on */
  signature: string;
  bins: number;
  startedAt: number;
  finishedMs: number | null;
  error: string | null;
};

function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function fmt(value: number, digits = 3) {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e4 || abs < 1e-2)) {
    const [m, e] = value.toExponential(digits - 1).split("e");
    return `${m} × 10${superscript(Number(e))}`;
  }
  return Number(value.toPrecision(digits)).toString();
}

function superscript(n: number) {
  const map: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  return String(n).split("").map((c) => map[c] ?? c).join("");
}

function seconds(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function avg(values: number[]) {
  return values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1);
}

/** A labelled number field with its unit, committing on blur or Enter. */
function NumberField({
  label,
  unit,
  value,
  onChange,
  min,
  note,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  note?: ReactNode;
}) {
  const field = useNumberDraft(value, (typed) => {
    if (min === undefined || typed >= min) onChange(typed);
  });
  return (
    <label className="field dryRunField">
      <span>{label}</span>
      <span className="field__control">
        <input inputMode="decimal" type="number" step="any" {...field} />
        {unit ? <span>{unit}</span> : null}
      </span>
      {note ? <span className="field__note">{note}</span> : null}
    </label>
  );
}

/** Where the threshold sits: the fluence at which half the leakage comes from k = 0, interpolated in log. */
function thresholdOf(points: CaptureResult[]): number | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const fa = a.condensateLeakage / a.leakage;
    const fb = b.condensateLeakage / b.leakage;
    if (fa < 0.5 && fb >= 0.5) {
      const t = (0.5 - fa) / (fb - fa);
      return Math.exp(Math.log(a.fluence) + t * (Math.log(b.fluence) - Math.log(a.fluence)));
    }
  }
  return null;
}

/** The beam bringing a laser's light to the sample: the pump, if the setup draws one. */
function pumpBeamOf(setup: BuilderSceneData, exclude: string | null): string | null {
  const type = (id: string) => setup.components.find((c) => c.id === id)?.type;
  return (
    setup.beams.find(
      (beam) => beam.id !== exclude && beam.path.some((id) => type(id) === "sample") && beam.path.some((id) => type(id) === "laser-source"),
    )?.id ?? null
  );
}

const WIDE = "(min-width: 900px)";

/** Whether the page has the width for the side panel beside the scene (and the scene for its labels). */
function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

function Section({ title, children, note }: { title: string; children?: ReactNode; note?: ReactNode }) {
  return (
    <section className="dryRun__section">
      <h3>{title}</h3>
      {note ? <p className="field__note">{note}</p> : null}
      {children}
    </section>
  );
}

export default function DryRun() {
  const [setupName, setSetupName] = useState(EXAMPLE_SETUP_NAME);
  const [setup, setSetup] = useState<BuilderSceneData>(EXAMPLE_SETUP);
  const [beamId, setBeamId] = useState<string | null>(EXAMPLE_BEAM);
  const [params, setParams] = useState<DryRunParams>(DEFAULT_PARAMS);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [shown, setShown] = useState(0);
  const [now, setNow] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<PanelTab>("capture");
  const [quality, setQuality] = useState<GraphicsQuality>("full");
  const [fitToken, setFitToken] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);
  const panelRef = useRef<HTMLElement>(null);
  const palette = useScenePalette();
  const wide = useWide();

  // the Tabletop's graphics setting, shared: a slow computer set to light there is light here
  useEffect(() => {
    const stored = readStoredQuality();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this browser's storage after mount
    if (stored) setQuality(stored);
  }, []);

  const set = useCallback(<K extends keyof DryRunParams>(key: K, value: DryRunParams[K]) => {
    setParams((current) => ({ ...current, [key]: value }));
  }, []);

  const beam = setup.beams.find((entry) => entry.id === beamId) ?? null;
  const optics = useMemo(
    () => (beam ? beamOptics(setup, beam, { objectiveFocalLength: params.objectiveMm / 1000 }) : null),
    [beam, setup, params.objectiveMm],
  );
  const fourierScale = optics?.ok && optics.classification.kind === "fourier" ? optics.classification.scale : null;
  const signature = JSON.stringify({ params, fourierScale });
  const running = run !== null && run.finishedMs === null && run.error === null;
  const pumpBeamId = useMemo(() => pumpBeamOf(setup, beamId), [setup, beamId]);

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRun((current) => (current && current.finishedMs === null ? { ...current, finishedMs: performance.now() - current.startedAt, error: "Stopped." } : current));
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(performance.now()), 200);
    return () => window.clearInterval(timer);
  }, [running]);

  const start = useCallback(
    (fluences: number[]) => {
      if (fourierScale === null) return;
      workerRef.current?.terminate();
      const worker = new Worker(new URL("./dry-run.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      const runId = ++runIdRef.current;
      const startedAt = performance.now();
      setNow(startedAt);
      setShown(0);
      setRun({
        fluences,
        results: fluences.map(() => null),
        signature,
        bins: params.lightModel ? LIGHT_MODEL_BINS + 1 : FULL_BINS,
        startedAt,
        finishedMs: null,
        error: null,
      });
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.runId !== runId) return;
        setRun((current) => {
          if (!current) return current;
          if (message.type === "started") return { ...current, bins: message.bins };
          if (message.type === "capture") {
            const results = current.results.slice();
            results[message.index] = message.result;
            return { ...current, results };
          }
          if (message.type === "done") return { ...current, finishedMs: message.ms };
          return { ...current, error: message.message, finishedMs: performance.now() - current.startedAt };
        });
        if (message.type === "capture") setShown(message.index);
        if (message.type === "done" || message.type === "error") {
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
        }
      };
      worker.onerror = (event) => {
        setRun((current) => (current ? { ...current, error: event.message || "The worker failed.", finishedMs: performance.now() - current.startedAt } : current));
      };
      const request: WorkerRequest = { runId, params, optics: { fourierScale }, fluences };
      worker.postMessage(request);
    },
    [fourierScale, params, signature],
  );

  function chooseSetup(next: BuilderSceneData, name: string, nextBeam?: string | null) {
    stop();
    setRun(null);
    setSetup(next);
    setSetupName(name);
    setFitToken((token) => token + 1);
    const pick =
      nextBeam && next.beams.some((entry) => entry.id === nextBeam)
        ? nextBeam
        : (next.beams.find((entry) => beamOptics(next, entry, { objectiveFocalLength: params.objectiveMm / 1000 }).ok)?.id ??
          next.beams[0]?.id ??
          null);
    setBeamId(pick);
  }

  async function openFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const opened = readOpenedFile(await file.text(), file.name);
    if (opened.kind === "error") {
      setFileMessage(opened.reason);
      return;
    }
    if (opened.kind === "setup") {
      chooseSetup(opened.setup, file.name);
      setFileMessage(`Opened the setup ${file.name}. It is only read, never changed.`);
      return;
    }
    setParams(opened.state.params);
    chooseSetup(opened.state.setup, opened.state.setupName, opened.state.beamId);
    setFileMessage(`Opened the Dry Run file ${file.name}: its setup, beam and parameters. Run the series to see its captures.`);
  }

  /** An instrument in the scene was clicked: open the panel at its tab. */
  const openTab = useCallback((next: PanelTab) => {
    setTab(next);
    setPanelOpen(true);
    // on a phone the panel stacks under the scene: bring it into view
    window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !window.matchMedia(WIDE).matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const done = useMemo(() => (run?.results ?? []).filter((entry): entry is CaptureResult => entry !== null), [run]);
  const doneCount = done.length;
  // the capture at the slider, or while it is still to come, the nearest one below it
  const current = useMemo(() => {
    if (!run) return null;
    for (let i = shown; i >= 0; i--) if (run.results[i]) return run.results[i];
    return null;
  }, [run, shown]);
  const threshold = thresholdOf(done);
  const stale = run !== null && run.signature !== signature;
  const elapsed = run ? (run.finishedMs ?? now - run.startedAt) : 0;

  // What the scene is lit by: the pump's place in the series, the leakage on a log scale over the series
  const light = useMemo<BenchLight>(() => {
    const n = run?.fluences.length ?? 1;
    const pump = run ? (n > 1 ? shown / (n - 1) : 1) : 0.35;
    if (!current || done.length === 0) return { pump, leakage: 0, condensate: 0 };
    const logs = done.map((r) => Math.log10(Math.max(r.leakage, 1e-9)));
    const lo = Math.min(...logs);
    const hi = Math.max(...logs);
    const at = Math.log10(Math.max(current.leakage, 1e-9));
    const leakage = hi > lo ? 0.12 + 0.88 * ((at - lo) / (hi - lo)) : 1;
    return { pump, leakage, condensate: current.condensateLeakage / current.leakage };
  }, [run, shown, current, done]);

  const captureSummary = useMemo(() => {
    if (!current) return null;
    const { capture } = current;
    let min = Infinity;
    let max = -Infinity;
    for (const v of capture.pixels) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const index = run?.results.indexOf(current) ?? 0;
    return {
      width: capture.width,
      height: capture.height,
      min,
      max,
      pixels: capture.pixels,
      // the Image view titles a capture from this, as from a file name
      sourceLabel: `Capture ${index + 1} of ${run?.fluences.length ?? 1}`,
      valueLabel: "Counts",
      xLabel: "Column (wavelength)",
      yLabel: "Row (emission angle)",
    };
  }, [current, run]);

  const calibration = useMemo(() => {
    if (!current || fourierScale === null) return null;
    const energies = columnEnergies(current.capture);
    const angles = rowAngles(current.capture, { fourierScale });
    const lam = current.capture.wavelengths;
    const deg = (rad: number) => (rad * 180) / Math.PI;
    return {
      columns: `${(lam[0] * 1e9).toFixed(2)} → ${(lam[lam.length - 1] * 1e9).toFixed(2)} nm (${(energies[0] / EV).toFixed(4)} → ${(energies[energies.length - 1] / EV).toFixed(4)} eV)`,
      rows: `${deg(angles[0]).toFixed(1)}° → ${deg(angles[angles.length - 1]).toFixed(1)}°`,
      perPixel: `${(((energies[0] - energies[energies.length - 1]) / (energies.length - 1) / EV) * 1e3).toFixed(3)} meV per column`,
    };
  }, [current, fourierScale]);

  const inputOutput = useMemo(
    () => [
      { label: "Leakage, all angles", points: done.map((r) => ({ x: Math.log10(r.fluence), y: Math.log10(r.leakage) })) },
      { label: "From k = 0 (condensate)", points: done.map((r) => ({ x: Math.log10(r.fluence), y: Math.log10(Math.max(r.condensateLeakage, 1e-3)) })) },
      { label: "Reaching the camera", points: done.map((r) => ({ x: Math.log10(r.fluence), y: Math.log10(Math.max(r.onCamera, 1e-3)) })) },
    ],
    [done],
  );
  const blueshift = useMemo(
    () => [{ label: "Peak near θ = 0", points: done.map((r) => ({ x: Math.log10(r.fluence), y: (r.peakShift / EV) * 1e3 })) }],
    [done],
  );
  const linewidth = useMemo(
    () => [{ label: "FWHM near θ = 0", points: done.map((r) => ({ x: Math.log10(r.fluence), y: (r.linewidth / EV) * 1e3 })) }],
    [done],
  );

  const fluences = seriesFluences(params);
  const fullTime = params.lightModel ? 0.25 : 1.15;
  const pumpPerPulse = absorbedPerPulse(params, fluences[fluences.length - 1]);
  const n = run?.fluences.length ?? 0;

  const problem =
    optics === null
      ? "This setup has no beams, so there is nothing to simulate."
      : !optics.ok
        ? optics.reason
        : optics.classification.kind === "image"
          ? `The slit sits at an image of the sample (magnification ${fmt(optics.classification.magnification)}), not at a Fourier plane. The Dry Run only takes angle-resolved captures so far.`
          : optics.classification.kind === "neither"
            ? `The slit is at neither an image nor a Fourier plane of the sample.${
                optics.classification.fourierDefocus !== null
                  ? ` Its Fourier plane lies ${fmt(Math.abs(optics.classification.fourierDefocus) * 1000)} mm ${optics.classification.fourierDefocus > 0 ? "past" : "before"} the slit.`
                  : ""
              }`
            : null;

  const status = run
    ? running
      ? `Capture ${Math.min(doneCount + 1, run.fluences.length)} of ${run.fluences.length} · ${seconds(elapsed)}`
      : run.error
        ? `${run.error} ${doneCount} of ${run.fluences.length} captures in ${seconds(elapsed)}`
        : `${run.fluences.length} captures in ${seconds(elapsed)}`
    : `${fluences.length} captures, about ${seconds(fluences.length * fullTime * 1000)} with the ${params.lightModel ? "light" : "full"} physics model`;

  const readout = current ? (
    <>
      <strong>{fmt(current.fluence)} µJ/cm²</strong>
      {threshold ? <> · {fmt(current.fluence / threshold, 2)} × threshold</> : null}
      {" · "}
      {fmt((current.condensateLeakage / current.leakage) * 100, 2)} % from k = 0
    </>
  ) : null;

  return (
    <div className={`dryRun${panelOpen ? " is-panelOpen" : ""}`}>
      <div className="dryRun__stage">
        <div className="dryRun__scene">
          <BenchScene
            setup={setup}
            leakageBeamId={fourierScale !== null ? beamId : null}
            pumpBeamId={pumpBeamId}
            light={light}
            capture={current?.capture ?? null}
            palette={palette}
            quality={quality}
            onPick={openTab}
            fitToken={fitToken}
            showLabels={wide}
          />
        </div>

        <div className="dryRun__hudTop">
          <div className="builderIsland dryRun__title">
            <h1>{DRY_RUN_NAME}</h1>
            <span className="betaBadge">Prototype</span>
            <span className="dryRun__setupName">{setupName}</span>
          </div>
          <div className="dryRun__hudRight">
            <button
              className={`builderIsland dryRun__hudButton${quality === "light" ? " is-active" : ""}`}
              type="button"
              aria-pressed={quality === "light"}
              title="Light graphics: no bloom and no shadows, for a slow computer"
              onClick={() => {
                const next: GraphicsQuality = quality === "full" ? "light" : "full";
                setQuality(next);
                storeQuality(next);
              }}
            >
              Light graphics
            </button>
            <button
              className={`builderIsland dryRun__hudButton${panelOpen ? " is-active" : ""}`}
              type="button"
              aria-expanded={panelOpen}
              aria-controls="dry-run-panel"
              onClick={() => setPanelOpen((open) => !open)}
            >
              Plots
            </button>
          </div>
        </div>

        <p className="dryRun__hint">Click the monitor, spectrometer or laser for its plots and settings.</p>

        <div className="builderIsland dryRun__transport" aria-live="polite">
          {running ? (
            <button className="buttonLink dryRun__run" type="button" onClick={stop}>
              Stop
            </button>
          ) : (
            <button className="buttonLink dryRun__run" type="button" disabled={fourierScale === null} onClick={() => start(fluences)}>
              {run ? "Run again" : "Run power series"}
            </button>
          )}
          <div className="dryRun__transportBody">
            {problem ? (
              <p className="dryRun__problem">{problem}</p>
            ) : (
              <>
                <div className="dryRun__transportLine">
                  <span className="dryRun__status">{status}</span>
                  {readout ? <span className="dryRun__readout">{readout}</span> : null}
                </div>
                {run ? <progress className="dryRun__progressBar" max={run.fluences.length} value={doneCount} /> : null}
                {run && n > 1 ? (
                  <label className="dryRun__slider">
                    <span>Pump power</span>
                    <input
                      type="range"
                      min={0}
                      max={n - 1}
                      step={1}
                      value={shown}
                      onChange={(event) => setShown(Number(event.target.value))}
                      aria-valuetext={`${fmt(run.fluences[shown])} µJ/cm²`}
                    />
                    <span className="dryRun__sliderValue">
                      {shown + 1} of {n}
                      {run.results[shown] ? "" : " · to come"}
                    </span>
                  </label>
                ) : null}
                {stale ? <p className="dryRun__problem">The parameters have changed since this series. Run it again to see them.</p> : null}
              </>
            )}
          </div>
        </div>
      </div>

      <aside className="dryRun__panel" id="dry-run-panel" ref={panelRef} aria-label="Plots and settings" hidden={!panelOpen}>
        <div className="dryRun__tabs" role="tablist" aria-label="Panel">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`dry-run-tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls="dry-run-tabpanel"
              className={`dryRun__tab${tab === entry.id ? " is-current" : ""}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="dryRun__tabPanel" role="tabpanel" id="dry-run-tabpanel" aria-labelledby={`dry-run-tab-${tab}`}>
          {tab === "capture" ? (
            <>
              <Section title="Capture" note="What the EMCCD camera reads at the spectrometer's exit: energy along the columns, emission angle along the rows. The monitor in the scene shows the same capture, turned so energy runs up.">
                {readout ? <p className="dryRun__readout">{readout}{current && current.attenuation < 1 ? ` · attenuated ×${fmt(current.attenuation, 2)}` : ""}{current?.saturated ? ` · ${current.saturated} pixels saturated` : ""}</p> : null}
                <div className="visualizerChartSurface dryRun__imageSurface">
                  {captureSummary ? (
                    <FitsImageViewer key={captureSummary.sourceLabel} summary={captureSummary} />
                  ) : (
                    <div className="visualizerEmptyState">
                      {fourierScale === null
                        ? "Pick a beam from a sample to a spectrometer whose slit sits at a Fourier plane."
                        : running
                          ? "The first capture is on its way."
                          : "Run the power series to take the captures."}
                    </div>
                  )}
                </div>
                {calibration ? (
                  <dl className="dryRun__calibration">
                    <div>
                      <dt>Columns</dt>
                      <dd>
                        {calibration.columns}, {calibration.perPixel}
                      </dd>
                    </div>
                    <div>
                      <dt>Rows</dt>
                      <dd>{calibration.rows} emission angle</dd>
                    </div>
                  </dl>
                ) : null}
                {run && doneCount > 0 ? (
                  <p className="field__note dryRun__timing">
                    {run.bins} energy bins · per capture: ladder {seconds(avg(done.map((r) => r.ladderMs)))}, optics and camera{" "}
                    {seconds(avg(done.map((r) => r.opticsMs)))}
                  </p>
                ) : null}
              </Section>
            </>
          ) : null}

          {tab === "curves" ? (
            <>
              <Section
                title="Input–output"
                note={
                  <>
                    log₁₀ photons per pulse against log₁₀ fluence (µJ/cm²).
                    {threshold ? ` Half the leakage comes from k = 0 at ${fmt(threshold)} µJ/cm².` : ""}
                  </>
                }
              >
                <div className="dryRun__chart">
                  {doneCount ? (
                    <InteractiveScatterChart animate={false} legend="points" series={inputOutput} xLabel="log₁₀ fluence (µJ/cm²)" yLabel="log₁₀ photons per pulse" />
                  ) : (
                    <div className="visualizerEmptyState">No captures yet.</div>
                  )}
                </div>
              </Section>
              <Section
                title="Blueshift"
                note="Peak energy within ±0.5° of normal, above the bottom of the lower branch, in meV. The physics model has no interactions, so it gives no blueshift: this stays flat."
              >
                <div className="dryRun__chart">
                  {doneCount ? (
                    <InteractiveScatterChart animate={false} series={blueshift} xLabel="log₁₀ fluence (µJ/cm²)" yLabel="Peak shift (meV)" />
                  ) : (
                    <div className="visualizerEmptyState">No captures yet.</div>
                  )}
                </div>
              </Section>
              <Section
                title="Linewidth"
                note="FWHM within ±0.5° of normal, in meV. The physics model gives each state only its decay-limited width, so the condensate does not narrow (the lab sees about 4 meV fall to about 1 meV across threshold)."
              >
                <div className="dryRun__chart">
                  {doneCount ? (
                    <InteractiveScatterChart animate={false} series={linewidth} xLabel="log₁₀ fluence (µJ/cm²)" yLabel="FWHM (meV)" />
                  ) : (
                    <div className="visualizerEmptyState">No captures yet.</div>
                  )}
                </div>
              </Section>
            </>
          ) : null}

          {tab === "pump" ? (
            <Section
              title="Pump"
              note={`Pulsed, at 45° onto a 25 µm spot; the physics model pumps its ${fmt(TABLE_II.area * 1e12)} µm² (a 25 µm disc is 491 µm²). Fluence is on the sample.`}
            >
              <div className="dryRun__pair">
                <NumberField label="From" unit="µJ/cm²" value={params.seriesFrom} min={1e-6} onChange={(v) => set("seriesFrom", v)} />
                <NumberField label="To" unit="µJ/cm²" value={params.seriesTo} min={1e-6} onChange={(v) => set("seriesTo", v)} />
              </div>
              <div className="dryRun__pair">
                <NumberField label="Captures" value={params.seriesPoints} min={1} onChange={(v) => set("seriesPoints", Math.min(60, Math.round(v)))} />
                <NumberField label="Pulse length" unit="fs" value={params.pulseFs} min={1} onChange={(v) => set("pulseFs", v)} />
              </div>
              <div className="dryRun__pair">
                <NumberField label="Wavelength" unit="nm" value={params.pumpNm} min={100} onChange={(v) => set("pumpNm", v)} note={`${fmt(1239.84198 / params.pumpNm, 3)} eV`} />
                <NumberField label="Repetition" unit="Hz" value={params.repRateHz} min={1} onChange={(v) => set("repRateHz", v)} />
              </div>
              <NumberField label="Absorbed" value={params.absorbed} min={0} onChange={(v) => set("absorbed", Math.min(1, v))} note="Fraction of pump photons that make a dark exciton" />
              <p className="field__note">
                Up to {fmt(pumpPerPulse)} dark excitons per pulse. About {seconds(fluences.length * fullTime * 1000)} for {fluences.length} captures with the{" "}
                {params.lightModel ? "light" : "full"} physics model.
              </p>
            </Section>
          ) : null}

          {tab === "optics" ? (
            <>
              <Section title="Collection" note="An infinity-corrected 50× objective (f = 200 mm tube lens / 50) collects the leakage; the setup's lenses relay its back focal plane, a 4f imaging line that can be set for real or k space.">
                <div className="dryRun__pair">
                  <NumberField label="Objective f" unit="mm" value={params.objectiveMm} min={0.1} onChange={(v) => set("objectiveMm", v)} />
                  <NumberField label="Objective NA" value={params.objectiveNa} min={0.01} onChange={(v) => set("objectiveNa", Math.min(0.99, v))} />
                </div>
                {optics?.ok ? (
                  <ol className="dryRun__path">
                    {optics.stops.map((entry) => (
                      <li key={entry.id}>{entry.label}</li>
                    ))}
                  </ol>
                ) : null}
                {fourierScale !== null ? (
                  <p className="field__note">
                    The slit sits at a Fourier plane of the sample: {fmt(Math.abs(fourierScale) * 1000)} mm on the slit per radian of emission angle,
                    so the capture reads energy against angle. The sample is taken to sit at the objective&apos;s focus.
                  </p>
                ) : problem ? (
                  <p className="dryRun__problem">{problem}</p>
                ) : null}
              </Section>
              <Section title="Imaging spectrometer">
                <div className="dryRun__pair">
                  <NumberField label="Grating" unit="lines/mm" value={params.grooves} min={1} onChange={(v) => set("grooves", v)} />
                  <NumberField label="Focal length" unit="mm" value={params.spectrometerMm} min={10} onChange={(v) => set("spectrometerMm", v)} />
                </div>
                <NumberField label="Slit" unit="µm" value={params.slitUm} min={1} onChange={(v) => set("slitUm", v)} />
              </Section>
              <Section
                title="EMCCD camera"
                note={`A ${CHIP.columns} × ${CHIP.rows} px chip. The capture reads all its rows but only a region of its columns round the branch, to keep each capture quick.`}
              >
                <div className="dryRun__pair">
                  <NumberField label="Columns read" value={params.columns} min={16} onChange={(v) => set("columns", Math.min(CHIP.columns, Math.round(v)))} />
                  <NumberField label="Rows read" value={params.rows} min={16} onChange={(v) => set("rows", Math.min(CHIP.rows, Math.round(v)))} />
                </div>
                <div className="dryRun__pair">
                  <NumberField label="Pixel" unit="µm" value={params.pixelUm} min={1} onChange={(v) => set("pixelUm", v)} />
                  <NumberField label="EM gain" unit="×" value={params.emGain} min={1} onChange={(v) => set("emGain", Math.min(1000, v))} />
                </div>
                <div className="dryRun__pair">
                  <NumberField label="Exposure" unit="s" value={params.exposureS} min={1e-6} onChange={(v) => set("exposureS", v)} />
                  <NumberField label="Read noise" unit="e⁻" value={params.readNoise} min={0} onChange={(v) => set("readNoise", v)} note="At the output, before the EM gain divides it" />
                </div>
                <NumberField label="Throughput" value={params.throughput} min={0} onChange={(v) => set("throughput", Math.min(1, v))} note="Collected to camera" />
                <label className="dryRun__check">
                  <input type="checkbox" checked={params.autoAttenuate} onChange={(event) => set("autoAttenuate", event.target.checked)} />
                  <span>
                    <strong>Never saturate</strong>
                    <span className="field__note">Attenuate a bright capture, as an ND filter would</span>
                  </span>
                </label>
              </Section>
            </>
          ) : null}

          {tab === "model" ? (
            <>
              <Section title="Setup">
                <label className="field">
                  <span>Setup or Dry Run file</span>
                  <FileDrop kind="setup file" accept=".json,application/json" onChange={openFile} />
                </label>
                <p className="dryRun__setupLine">
                  {setupName} · {setup.components.length} components, {setup.beams.length} beams
                </p>
                {fileMessage ? <p className="field__note">{fileMessage}</p> : null}
                {setupName !== EXAMPLE_SETUP_NAME ? (
                  <button
                    className="dryRun__textButton"
                    type="button"
                    onClick={() => {
                      chooseSetup(EXAMPLE_SETUP, EXAMPLE_SETUP_NAME, EXAMPLE_BEAM);
                      setFileMessage(null);
                    }}
                  >
                    Back to the lab setup
                  </button>
                ) : (
                  <button className="dryRun__textButton" type="button" onClick={() => download(serializeScene(EXAMPLE_SETUP), "dry-run-lab-setup.json")}>
                    Save the lab setup as a setup file, to open in the Tabletop
                  </button>
                )}
                <label className="field">
                  <span>Beam, from the sample to the spectrometer</span>
                  <span className="field__control">
                    <select
                      className="dryRun__select"
                      value={beamId ?? ""}
                      onChange={(event) => {
                        stop();
                        setRun(null);
                        setBeamId(event.target.value || null);
                      }}
                    >
                      {setup.beams.length === 0 ? <option value="">This setup has no beams</option> : null}
                      {setup.beams.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {beamName(setup, entry)}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                {problem ? <p className="dryRun__problem">{problem}</p> : null}
              </Section>
              <Section
                title="Physics model"
                note="The polariton ladder of Shishkov, Andrianov & Zasedatelev, Phys. Rev. B 110, 134321 (2024), with its Table II values: a dark-exciton reservoir feeding the lower polariton branch, with thermalisation between the bins. Its cavity and exciton energies are shifted together to put the bottom of the branch where the lab measures the condensate, so the detuning, and with it the threshold, stays Table II's."
              >
                <NumberField label="Bottom of the branch, E_LP(0)" unit="eV" value={params.branchBottomEv} min={1} onChange={(v) => set("branchBottomEv", v)} />
                <label className="dryRun__check">
                  <input type="checkbox" checked={params.lightModel} onChange={(event) => set("lightModel", event.target.checked)} />
                  <span>
                    <strong>Light physics model</strong>
                    <span className="field__note">
                      Fewer energy bins ({LIGHT_MODEL_BINS + 1} instead of {FULL_BINS}), for a slow computer
                    </span>
                  </span>
                </label>
              </Section>
              <Section title="Save" note="A file of its own, beside the setup file: the setup file is never changed.">
                <button className="dryRun__textButton" type="button" onClick={() => download(serializeState({ setupName, setup, beamId, params }), "dry-run.json")}>
                  Save this Dry Run (setup, beam and parameters)
                </button>
              </Section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
