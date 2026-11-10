"use client";

// The Dry Run page (prototype for #341): a Tabletop setup in, a power series
// of spectrometer captures out. The physics runs in a Web Worker
// (dry-run.worker.ts); this file is the page around it.

import { Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Title, Tooltip } from "chart.js";
import { type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BuilderSceneData } from "@/components/builder/types";
import { FileDrop } from "@/components/plotters/file-drop";
import FitsImageViewer from "@/components/plotters/fits-image-viewer";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { SidebarFold } from "@/components/sidebar-fold";
import { useNumberDraft } from "@/components/use-number-draft";
import { beamName, beamOptics } from "@/components/dryrun/beam-optics";
import {
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
import { EXAMPLE_SETUP, EXAMPLE_SETUP_NAME } from "@/components/dryrun/example-setup";
import { DRY_RUN_NAME } from "@/components/dryrun/names";
import { readOpenedFile, serializeState } from "@/components/dryrun/state-file";
import { serializeScene } from "@/components/builder/types";
import { TABLE_II } from "@/components/simulator/ladder";

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const FULL_BINS = 101;

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

export default function DryRun() {
  const [setupName, setSetupName] = useState(EXAMPLE_SETUP_NAME);
  const [setup, setSetup] = useState<BuilderSceneData>(EXAMPLE_SETUP);
  const [beamId, setBeamId] = useState<string | null>("beam-leakage");
  const [params, setParams] = useState<DryRunParams>(DEFAULT_PARAMS);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [shown, setShown] = useState(0);
  const [now, setNow] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);

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

  const done = useMemo(() => (run?.results ?? []).filter((entry): entry is CaptureResult => entry !== null), [run]);
  const doneCount = done.length;
  const current = run?.results[shown] ?? null;
  const threshold = thresholdOf(done);
  const stale = run !== null && run.signature !== signature;
  const elapsed = run ? (run.finishedMs ?? now - run.startedAt) : 0;

  const captureSummary = useMemo(() => {
    if (!current) return null;
    const { capture } = current;
    let min = Infinity;
    let max = -Infinity;
    for (const v of capture.pixels) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return {
      width: capture.width,
      height: capture.height,
      min,
      max,
      pixels: capture.pixels,
      // the Image view titles a capture from this, as from a file name
      sourceLabel: `Capture ${shown + 1} of ${run?.fluences.length ?? 1}`,
      valueLabel: "Counts",
      xLabel: "Column (wavelength)",
      yLabel: "Row (emission angle)",
    };
  }, [current, shown, run?.fluences.length]);

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
  const fullTime = params.lightModel ? 0.2 : 1.1;
  const pumpPerPulse = absorbedPerPulse(params, fluences[fluences.length - 1]);

  return (
    <div className="dryRun">
      <header className="dryRun__head">
        <h1 className="toolTitle">
          {DRY_RUN_NAME}
          <span className="betaBadge">Prototype</span>
        </h1>
        <p className="lead">
          A setup from the Tabletop, run as an experiment: a pulsed pump on a polariton microcavity, the cavity&apos;s
          leakage through the beam you pick, and the spectrometer&apos;s capture at each pump power.
        </p>
      </header>

      <div className={`visualizerLayout${sidebarCollapsed ? " visualizerLayout--sidebarCollapsed" : ""}`}>
        <div className="visualizerSidebar">
          <SidebarFold collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} label="settings" />

          <div className="inputCard fieldStack">
            <h2>Setup</h2>
            <label className="field">
              <span>Setup or Dry Run file</span>
              <FileDrop kind="setup file" accept=".json,application/json" onChange={openFile} />
            </label>
            <p className="resultCard dryRun__status">
              {setupName} · {setup.components.length} components, {setup.beams.length} beams
            </p>
            {fileMessage ? <p className="field__note">{fileMessage}</p> : null}
            {setupName !== EXAMPLE_SETUP_NAME ? (
              <button className="dryRun__textButton" type="button" onClick={() => { chooseSetup(EXAMPLE_SETUP, EXAMPLE_SETUP_NAME, "beam-leakage"); setFileMessage(null); }}>
                Back to the example setup
              </button>
            ) : (
              <button className="dryRun__textButton" type="button" onClick={() => download(serializeScene(EXAMPLE_SETUP), "dry-run-example-setup.json")}>
                Save the example as a setup file, to open in the Tabletop
              </button>
            )}
          </div>

          <div className="inputCard fieldStack">
            <h2>Beam</h2>
            <label className="field">
              <span>From the sample to the spectrometer</span>
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
            {optics === null ? (
              <p className="dryRun__problem">This setup has no beams, so there is nothing to simulate.</p>
            ) : !optics.ok ? (
              <p className="dryRun__problem">{optics.reason}</p>
            ) : (
              <>
                <ol className="dryRun__path">
                  {optics.stops.map((stop) => (
                    <li key={stop.id}>{stop.label}</li>
                  ))}
                </ol>
                {optics.classification.kind === "fourier" ? (
                  <p className="field__note">
                    The slit sits at a Fourier plane of the sample: {fmt(Math.abs(optics.classification.scale) * 1000)} mm on the
                    slit per radian of emission angle, so the capture reads energy against angle. The sample is taken to sit at
                    the objective&apos;s focus.
                  </p>
                ) : optics.classification.kind === "image" ? (
                  <p className="dryRun__problem">
                    The slit sits at an image of the sample (magnification {fmt(optics.classification.magnification)}), not at a
                    Fourier plane. The Dry Run only takes angle-resolved captures so far.
                  </p>
                ) : (
                  <p className="dryRun__problem">
                    The slit is at neither an image nor a Fourier plane of the sample.
                    {optics.classification.fourierDefocus !== null
                      ? ` Its Fourier plane lies ${fmt(Math.abs(optics.classification.fourierDefocus) * 1000)} mm ${optics.classification.fourierDefocus > 0 ? "past" : "before"} the slit.`
                      : ""}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="inputCard fieldStack">
            <h2>Pump</h2>
            <p className="field__note">Pulsed, onto the pumped spot of the physics model ({fmt(DEFAULT_AREA_UM2)} µm²).</p>
            <div className="dryRun__pair">
              <NumberField label="From" unit="µJ/cm²" value={params.seriesFrom} min={1e-6} onChange={(v) => set("seriesFrom", v)} />
              <NumberField label="To" unit="µJ/cm²" value={params.seriesTo} min={1e-6} onChange={(v) => set("seriesTo", v)} />
            </div>
            <div className="dryRun__pair">
              <NumberField label="Captures" value={params.seriesPoints} min={1} onChange={(v) => set("seriesPoints", Math.min(60, Math.round(v)))} />
              <NumberField label="Pulse length" unit="fs" value={params.pulseFs} min={1} onChange={(v) => set("pulseFs", v)} />
            </div>
            <div className="dryRun__pair">
              <NumberField label="Wavelength" unit="nm" value={params.pumpNm} min={100} onChange={(v) => set("pumpNm", v)} />
              <NumberField label="Absorbed" value={params.absorbed} min={0} onChange={(v) => set("absorbed", Math.min(1, v))} />
            </div>
            <p className="field__note">
              Up to {fmt(pumpPerPulse)} dark excitons per pulse. About {seconds(fluences.length * fullTime * 1000)} for{" "}
              {fluences.length} captures with the {params.lightModel ? "light" : "full"} physics model.
            </p>
            <div className="dryRun__actions">
              {running ? (
                <button className="buttonLink" type="button" onClick={stop}>
                  Stop
                </button>
              ) : (
                <button className="buttonLink" type="button" disabled={fourierScale === null} onClick={() => start(fluences)}>
                  Run power series
                </button>
              )}
            </div>
          </div>

          <div className="inputCard fieldStack">
            <h2>Physics model</h2>
            <label className="dryRun__check">
              <input type="checkbox" checked={params.lightModel} onChange={(event) => set("lightModel", event.target.checked)} />
              <span>
                <strong>Light physics model</strong>
                <span className="field__note">
                  Fewer energy bins ({LIGHT_MODEL_BINS + 1} instead of {FULL_BINS}), for a slow computer
                </span>
              </span>
            </label>
            <p className="field__note">
              The polariton ladder of Shishkov, Andrianov &amp; Zasedatelev, Phys. Rev. B 110, 134321 (2024), with its Table II
              values: a dark-exciton reservoir feeding the lower polariton branch, with thermalisation between the bins.
            </p>
            <details className="dryRun__more">
              <summary>Objective, spectrometer and camera</summary>
              <div className="fieldStack">
                <div className="dryRun__pair">
                  <NumberField label="Objective f" unit="mm" value={params.objectiveMm} min={0.1} onChange={(v) => set("objectiveMm", v)} />
                  <NumberField label="Objective NA" value={params.objectiveNa} min={0.01} onChange={(v) => set("objectiveNa", Math.min(0.99, v))} />
                </div>
                <div className="dryRun__pair">
                  <NumberField label="Grating" unit="/mm" value={params.grooves} min={1} onChange={(v) => set("grooves", v)} />
                  <NumberField label="Spectrometer f" unit="mm" value={params.spectrometerMm} min={10} onChange={(v) => set("spectrometerMm", v)} />
                </div>
                <div className="dryRun__pair">
                  <NumberField label="Slit" unit="µm" value={params.slitUm} min={1} onChange={(v) => set("slitUm", v)} />
                  <NumberField label="Pixel" unit="µm" value={params.pixelUm} min={1} onChange={(v) => set("pixelUm", v)} />
                </div>
                <div className="dryRun__pair">
                  <NumberField label="Columns" value={params.columns} min={16} onChange={(v) => set("columns", Math.min(2048, Math.round(v)))} />
                  <NumberField label="Rows" value={params.rows} min={16} onChange={(v) => set("rows", Math.min(1024, Math.round(v)))} />
                </div>
                <div className="dryRun__pair">
                  <NumberField label="Exposure" unit="s" value={params.exposureS} min={1e-6} onChange={(v) => set("exposureS", v)} />
                  <NumberField label="Repetition" unit="Hz" value={params.repRateHz} min={1} onChange={(v) => set("repRateHz", v)} />
                </div>
                <div className="dryRun__pair">
                  <NumberField label="Throughput" value={params.throughput} min={0} onChange={(v) => set("throughput", Math.min(1, v))} note="Collected to camera" />
                  <NumberField label="Read noise" unit="e⁻" value={params.readNoise} min={0} onChange={(v) => set("readNoise", v)} />
                </div>
                <label className="dryRun__check">
                  <input type="checkbox" checked={params.autoAttenuate} onChange={(event) => set("autoAttenuate", event.target.checked)} />
                  <span>
                    <strong>Never saturate</strong>
                    <span className="field__note">Attenuate a bright capture, as an ND filter would</span>
                  </span>
                </label>
              </div>
            </details>
          </div>

          <div className="inputCard fieldStack">
            <h2>Save</h2>
            <button
              className="dryRun__textButton"
              type="button"
              onClick={() => download(serializeState({ setupName, setup, beamId, params }), "dry-run.json")}
            >
              Save this Dry Run (setup, beam and parameters)
            </button>
            <p className="field__note">A file of its own, beside the setup file: the setup file is never changed.</p>
          </div>
        </div>

        <div className="sectionCard visualizerChartCard dryRun__main">
          {run ? (
            <div className="dryRun__progress" aria-live="polite">
              <progress max={run.fluences.length} value={doneCount} />
              <span>
                {running
                  ? `Capture ${Math.min(doneCount + 1, run.fluences.length)} of ${run.fluences.length} · ${seconds(elapsed)}`
                  : run.error
                    ? `${run.error} ${doneCount} of ${run.fluences.length} captures in ${seconds(elapsed)}`
                    : `${run.fluences.length} captures in ${seconds(elapsed)}`}
                {" · "}
                {run.bins} energy bins
                {doneCount > 0 ? ` · per capture: ladder ${seconds(avg(done.map((r) => r.ladderMs)))}, optics and camera ${seconds(avg(done.map((r) => r.opticsMs)))}` : ""}
              </span>
              {stale ? <span className="dryRun__problem">The parameters have changed since this series. Run it again to see them.</span> : null}
            </div>
          ) : null}

          <section className="dryRun__capture">
            <div className="dryRun__captureHead">
              <h2>Capture</h2>
              {current ? (
                <p className="dryRun__readout">
                  <strong>{fmt(current.fluence)} µJ/cm²</strong>
                  {threshold ? ` · ${fmt(current.fluence / threshold, 2)} × threshold` : ""} · {fmt(current.leakage)} photons leak per
                  pulse, {fmt((current.condensateLeakage / current.leakage) * 100, 2)} % from k = 0
                  {current.attenuation < 1 ? ` · attenuated ×${fmt(current.attenuation, 2)}` : ""}
                  {current.saturated ? ` · ${current.saturated} pixels saturated` : ""}
                </p>
              ) : null}
            </div>
            {run && run.fluences.length > 1 ? (
              <label className="dryRun__slider">
                <span>Pump power</span>
                <input
                  type="range"
                  min={0}
                  max={run.fluences.length - 1}
                  step={1}
                  value={shown}
                  onChange={(event) => setShown(Number(event.target.value))}
                  aria-valuetext={`${fmt(run.fluences[shown])} µJ/cm²`}
                />
                <span className="dryRun__sliderValue">
                  {shown + 1} of {run.fluences.length}
                  {run.results[shown] ? "" : " (not yet run)"}
                </span>
              </label>
            ) : null}
            <div className="visualizerChartSurface dryRun__imageSurface">
              {captureSummary ? (
                <FitsImageViewer summary={captureSummary} />
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
                  <dd>{calibration.columns}, {calibration.perPixel}</dd>
                </div>
                <div>
                  <dt>Rows</dt>
                  <dd>{calibration.rows} emission angle</dd>
                </div>
              </dl>
            ) : null}
          </section>

          <section className="dryRun__curves">
            <div className="dryRun__curve">
              <h2>Input–output</h2>
              <p className="field__note">
                log₁₀ photons per pulse against log₁₀ fluence (µJ/cm²).
                {threshold ? ` Half the leakage comes from k = 0 at ${fmt(threshold)} µJ/cm².` : ""}
              </p>
              <div className="dryRun__chart">
                {doneCount ? (
                  <InteractiveScatterChart animate={false} legend="points" series={inputOutput} xLabel="log₁₀ fluence (µJ/cm²)" yLabel="log₁₀ photons per pulse" />
                ) : (
                  <div className="visualizerEmptyState">No captures yet.</div>
                )}
              </div>
            </div>
            <div className="dryRun__curve">
              <h2>Blueshift</h2>
              <p className="field__note">
                Peak energy within ±0.5° of normal, above the bottom of the lower branch, in meV. The physics model has no
                interactions, so it gives no blueshift: this stays flat.
              </p>
              <div className="dryRun__chart">
                {doneCount ? (
                  <InteractiveScatterChart animate={false} series={blueshift} xLabel="log₁₀ fluence (µJ/cm²)" yLabel="Peak shift (meV)" />
                ) : (
                  <div className="visualizerEmptyState">No captures yet.</div>
                )}
              </div>
            </div>
            <div className="dryRun__curve">
              <h2>Linewidth</h2>
              <p className="field__note">
                FWHM within ±0.5° of normal, in meV. The physics model gives each state only its decay-limited width, so the
                condensate does not narrow.
              </p>
              <div className="dryRun__chart">
                {doneCount ? (
                  <InteractiveScatterChart animate={false} series={linewidth} xLabel="log₁₀ fluence (µJ/cm²)" yLabel="FWHM (meV)" />
                ) : (
                  <div className="visualizerEmptyState">No captures yet.</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_AREA_UM2 = TABLE_II.area * 1e12;

function avg(values: number[]) {
  return values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1);
}
