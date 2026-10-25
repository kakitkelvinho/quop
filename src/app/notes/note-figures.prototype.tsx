"use client";

// PROTOTYPE (#301): note figures driven by parameters, not data arrays. Not for main.
// One state (a polarization: θ, φ) drawn three ways: a light 3D wave (three.js,
// loaded only when a figure comes near the screen), a Chart.js curve, and a flat
// SVG projection of the same 3D geometry for thumbnails and the loading frame.

import dynamic from "next/dynamic";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  LinearScale,
  PointElement,
  type ChartData,
  type ChartOptions,
} from "chart.js";

ChartJS.register(LinearScale, PointElement, LineElement);

/* ---------- the state ---------- */

/** θ: amplitude angle, tan θ = E_y / E_x (0–90°). φ: phase of y behind x (−180–180°). */
export type Pol = { theta: number; phi: number };
export type FigureKind = "wave" | "malus";

const rad = (d: number) => (d * Math.PI) / 180;

export const PRESETS: { key: string; name: string; pol: Pol }[] = [
  { key: "H", name: "horizontal", pol: { theta: 0, phi: 0 } },
  { key: "V", name: "vertical", pol: { theta: 90, phi: 0 } },
  { key: "D", name: "diagonal", pol: { theta: 45, phi: 0 } },
  { key: "A", name: "antidiagonal", pol: { theta: 45, phi: 180 } },
  { key: "L", name: "left circular", pol: { theta: 45, phi: 90 } },
  { key: "R", name: "right circular", pol: { theta: 45, phi: -90 } },
];

export function describe({ theta, phi }: Pol) {
  const s = Math.sin(rad(phi));
  if (theta < 0.5 || theta > 89.5 || Math.abs(s) < 0.02) {
    const angle = (Math.atan2(Math.sin(rad(theta)) * Math.cos(rad(phi)), Math.cos(rad(theta))) * 180) / Math.PI;
    return `linear at ${Math.round(angle)}°`;
  }
  const hand = s > 0 ? "left" : "right";
  if (Math.abs(theta - 45) < 0.5 && Math.abs(Math.cos(rad(phi))) < 0.02) return `${hand} circular`;
  return `${hand} elliptical`;
}

/** The field tip at propagation phase ψ = kz − ωt: (E_x cos ψ, E_y cos(ψ + φ)). */
export function fieldAt(p: Pol, psi: number): [number, number] {
  return [Math.cos(rad(p.theta)) * Math.cos(psi), Math.sin(rad(p.theta)) * Math.cos(psi + rad(p.phi))];
}

/** Transmission through a linear polarizer at α: |cos α cos θ + e^{iφ} sin α sin θ|². */
export function malus(p: Pol, alphaDeg: number) {
  const a = rad(alphaDeg);
  const t = rad(p.theta);
  return (
    Math.cos(a) ** 2 * Math.cos(t) ** 2 +
    Math.sin(a) ** 2 * Math.sin(t) ** 2 +
    2 * Math.sin(a) * Math.cos(a) * Math.sin(t) * Math.cos(t) * Math.cos(rad(p.phi))
  );
}

/* ---------- the wave's geometry, shared by the 3D scene and the SVG ---------- */

// three.js world: the wave runs along +X; physics x̂ is +Z, ŷ is +Y.
export const WAVE = { half: 3, k: Math.PI, plane: 3.7, stems: 25, samples: 240 };
export const VIEW = { azimuth: 0.5, elevation: 0.2 };
const AMP = 1.3;

export function wavePoints(p: Pol, t: number) {
  const curve: [number, number, number][] = [];
  for (let i = 0; i <= WAVE.samples; i++) {
    const x = -WAVE.half + (2 * WAVE.half * i) / WAVE.samples;
    const [ex, ey] = fieldAt(p, WAVE.k * x - t);
    curve.push([x, AMP * ey, AMP * ex]);
  }
  const ellipse: [number, number, number][] = [];
  for (let i = 0; i <= 96; i++) {
    const [ex, ey] = fieldAt(p, (2 * Math.PI * i) / 96);
    ellipse.push([WAVE.plane, AMP * ey, AMP * ex]);
  }
  const [ex, ey] = fieldAt(p, WAVE.k * WAVE.plane - t);
  return { curve, ellipse, tip: [WAVE.plane, AMP * ey, AMP * ex] as [number, number, number] };
}

export function cameraBasis(azimuth: number, elevation: number) {
  const pos = [
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ];
  // right = up × pos, normalised; up' = pos × right
  const r = [pos[2], 0, -pos[0]];
  const rl = Math.hypot(r[0], r[2]);
  const right = [r[0] / rl, 0, r[2] / rl];
  const up = [
    pos[1] * right[2] - pos[2] * right[1],
    pos[2] * right[0] - pos[0] * right[2],
    pos[0] * right[1] - pos[1] * right[0],
  ];
  return { pos, right, up };
}

/* ---------- the flat projection: thumbnails, and the frame before WebGL loads ---------- */

export function WaveSvg({ pol, className }: { pol: Pol; className?: string }) {
  const { right, up } = cameraBasis(VIEW.azimuth, VIEW.elevation);
  const proj = ([x, y, z]: [number, number, number]) =>
    `${(x * right[0] + y * right[1] + z * right[2]).toFixed(3)},${(-(x * up[0] + y * up[1] + z * up[2])).toFixed(3)}`;
  const { curve, ellipse, tip } = wavePoints(pol, 0);
  const axis = proj([-WAVE.half - 0.4, 0, 0]) + " " + proj([WAVE.plane + 0.4, 0, 0]);
  const stems = curve
    .filter((_, i) => i % Math.round(WAVE.samples / (WAVE.stems - 1)) === 0)
    .map((c) => `M${proj([c[0], 0, 0])}L${proj(c)}`)
    .join("");
  return (
    <svg className={className} viewBox="-4.3 -2 8.6 4" aria-hidden="true">
      <polyline points={axis} className="nf-axis" />
      <path d={stems} className="nf-stem" />
      <polyline points={ellipse.map(proj).join(" ")} className="nf-ellipse" />
      <polyline points={curve.map(proj).join(" ")} className="nf-curve" />
      <polyline points={`${proj([WAVE.plane, 0, 0])} ${proj(tip)}`} className="nf-tip" />
    </svg>
  );
}

export function MalusSvg({ pol, className }: { pol: Pol; className?: string }) {
  const pts = [];
  for (let a = 0; a <= 180; a += 5) pts.push(`${(a / 18).toFixed(2)},${(4 - 3.6 * malus(pol, a)).toFixed(3)}`);
  return (
    <svg className={className} viewBox="-0.5 -0.3 11 4.6" aria-hidden="true">
      <polyline points="0,0 0,4 10,4" className="nf-axis" />
      <polyline points={pts.join(" ")} className="nf-curve" />
    </svg>
  );
}

export function FigureThumb({ kind, pol }: { kind: FigureKind; pol: Pol }) {
  return kind === "wave" ? <WaveSvg pol={pol} className="nf-thumb" /> : <MalusSvg pol={pol} className="nf-thumb" />;
}

/* ---------- the 3D wave, mounted once it comes near the screen ---------- */

const Wave3D = dynamic(() => import("./wave-3d.prototype"), { ssr: false });

function useNearScreen<T extends Element>(margin: string) {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mount = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: margin });
    const run = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    mount.observe(el);
    run.observe(el);
    return () => {
      mount.disconnect();
      run.disconnect();
    };
  }, [margin]);
  return { ref, near, visible };
}

function WaveFigure({ pol }: { pol: Pol }) {
  const { ref, near, visible } = useNearScreen<HTMLDivElement>("300px 0px");
  const azimuth = useRef(VIEW.azimuth);
  const drag = useRef<number | null>(null);
  return (
    <div
      ref={ref}
      className="nf-wave"
      title="Drag sideways to turn"
      onPointerDown={(e) => {
        drag.current = e.clientX;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current === null) return;
        azimuth.current = Math.max(-1.45, Math.min(1.45, azimuth.current + (e.clientX - drag.current) * 0.008));
        drag.current = e.clientX;
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {near ? <Wave3D pol={pol} running={visible} azimuth={azimuth} /> : <WaveSvg pol={pol} className="nf-flat" />}
      <span className="nf-axislabel">z →</span>
    </div>
  );
}

/* ---------- the chart: Malus's law for the current state ---------- */

const ACCENT = "#1a5fb4";

function MalusChart({ pol }: { pol: Pol }) {
  const data = useMemo<ChartData<"scatter">>(() => {
    const points = [];
    for (let a = 0; a <= 180; a += 3) points.push({ x: a, y: malus(pol, a) });
    return {
      datasets: [
        {
          label: "transmission",
          data: points,
          showLine: true,
          borderColor: ACCENT,
          backgroundColor: ACCENT,
          pointRadius: 0,
          borderWidth: 2.5,
        },
      ],
    };
  }, [pol]);
  const options = useMemo<ChartOptions<"scatter">>(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: reduce ? false : { duration: 600, easing: "easeInOutCubic" },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { min: 0, max: 180, title: { display: true, text: "polarizer angle α (°)" }, ticks: { stepSize: 45 } },
        y: { min: 0, max: 1, title: { display: true, text: "I / I₀" }, ticks: { stepSize: 0.25 } },
      },
    };
  }, []);
  return (
    <div className="nf-chart">
      <Scatter data={data} options={options} />
    </div>
  );
}

/* ---------- a figure with its controls; prose drives it through <S> ---------- */

type FigureCtx = { pol: Pol; setPol: (p: Pol, from: "text" | "reader") => void; mark?: (el: HTMLElement, p: Pol) => () => void };
const Ctx = createContext<FigureCtx | null>(null);
export const FigureProvider = Ctx.Provider;

/** A state link in the prose: tapping it sets the figure. */
export function S({ to, children }: { to: Pol; children: ReactNode }) {
  const ctx = useContext(Ctx);
  const ref = useRef<HTMLButtonElement>(null);
  const mark = ctx?.mark;
  const { theta, phi } = to;
  useEffect(() => {
    if (!mark || !ref.current) return;
    return mark(ref.current, { theta, phi });
  }, [mark, theta, phi]);
  const on = ctx && Math.abs(ctx.pol.theta - theta) < 0.5 && Math.abs(ctx.pol.phi - phi) < 0.5;
  return (
    <button
      ref={ref}
      type="button"
      className={`nf-s ${on ? "is-on" : ""}`}
      onClick={(e) => {
        ctx?.setPol(to, "text");
        // on a phone the figure is above the text: bring it back into view
        const fig = e.currentTarget.closest(".nb-sheet, .ar-section")?.querySelector(".nf-figure");
        const r = fig?.getBoundingClientRect();
        if (fig && r && (r.bottom < 120 || r.top > window.innerHeight)) {
          const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          fig.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
        }
      }}
      title={`Show θ = ${theta}°, φ = ${phi}°`}
    >
      {children}
    </button>
  );
}

export function Figure({
  kind,
  caption,
  extra,
}: {
  kind: FigureKind;
  caption?: ReactNode;
  extra?: ReactNode;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const { pol, setPol } = ctx;
  return (
    <figure className="nf-figure">
      {kind === "wave" ? <WaveFigure pol={pol} /> : <MalusChart pol={pol} />}
      <div className="nf-presets" role="group" aria-label="Polarization">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            title={p.name}
            className={p.pol.theta === pol.theta && p.pol.phi === pol.phi ? "is-on" : ""}
            onClick={() => setPol(p.pol, "reader")}
          >
            {p.key}
          </button>
        ))}
        {extra}
      </div>
      <label className="nf-slider">
        <span>θ</span>
        <input
          type="range"
          min={0}
          max={90}
          value={pol.theta}
          onChange={(e) => setPol({ ...pol, theta: Number(e.target.value) }, "reader")}
        />
        <output>{pol.theta}°</output>
      </label>
      <label className="nf-slider">
        <span>φ</span>
        <input
          type="range"
          min={-180}
          max={180}
          value={pol.phi}
          onChange={(e) => setPol({ ...pol, phi: Number(e.target.value) }, "reader")}
        />
        <output>{pol.phi}°</output>
      </label>
      <figcaption>
        <span className="nf-readout">{describe(pol)}</span>
        {caption}
      </figcaption>
    </figure>
  );
}
