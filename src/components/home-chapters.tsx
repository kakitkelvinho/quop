"use client";

import Link from "next/link";
import { useCallback, useRef, type CSSProperties, type ReactNode } from "react";

import type { TraceSketch } from "@/components/home-trace";
import { useChapterProgress } from "@/components/use-chapter-progress";

/* ---------------------------------------------------------------------------
 * Every drawing is chalk strokes revealed by one number, the chapter's --p
 * (0 → 1). A stroke or label says when in that range it appears; CSS turns
 * that into a dash offset or an opacity. Only readouts that tick and the
 * light wave, whose shape changes, are touched from JavaScript.
 * ------------------------------------------------------------------------- */

type Span = [from: number, to: number];

const range = ([from, to]: Span) => ({ "--from": from, "--to": to }) as CSSProperties;

/** A stroke drawn on between `from` and `to`. */
const draw = (span: Span, className = "") => ({
  className: `chapter__stroke ${className}`.trim(),
  pathLength: 1,
  style: range(span),
});

/** Anything that fades in between `from` and `to`. */
const fade = (span: Span, className = "") => ({
  className: `chapter__fade ${className}`.trim(),
  style: range(span),
});

/** Local progress through a span, for the few things JavaScript draws. */
const within = (p: number, [from, to]: Span) => Math.min(1, Math.max(0, (p - from) / (to - from)));

type ChapterProps = {
  body: ReactNode;
  children: ReactNode;
  cta?: { href: string; label: string };
  extra?: ReactNode;
  flip?: boolean;
  heading: string;
  index: number;
  /** Section height in viewport heights; the pin lasts for all but one. */
  length: number;
  mode: "play" | "scrub";
  name: string;
  onProgress?: (p: number) => void;
  status?: string;
};

function Chapter({
  body,
  children,
  cta,
  extra,
  flip,
  heading,
  index,
  length,
  mode,
  name,
  onProgress,
  status,
}: ChapterProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useChapterProgress(sectionRef, stageRef, mode, onProgress);

  return (
    <section
      aria-labelledby={`chapter-${index}`}
      className={`chapter chapter--${mode}${flip ? " chapter--flip" : ""}`}
      ref={sectionRef}
      style={{ "--length": length } as CSSProperties}
    >
      <div className="chapter__stage" ref={stageRef}>
        <div className="chapter__text">
          <p {...fade([0, 0.12], "chapter__eyebrow")}>
            <span>{String(index).padStart(2, "0")}</span> {name}
            {status ? <em className="chapter__status">{status}</em> : null}
          </p>
          <h2 {...fade([0.03, 0.16], "chapter__heading")} id={`chapter-${index}`}>
            {heading}
          </h2>
          <p {...fade([0.06, 0.2], "chapter__body")}>{body}</p>
          {extra}
          {cta ? (
            <Link {...fade([0.7, 0.86], "chapter__cta")} href={cta.href}>
              {cta.label} <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
        <div aria-hidden="true" className="chapter__drawing">
          {children}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- plotter -------------------------------- */

/** Where the 0–1000 trace box sits inside the drawing. */
const PLOT = { h: 270, w: 500, x: 70, y: 40 };

function PlotterChapter({ trace }: { trace: TraceSketch }) {
  const sx = PLOT.w / 1000;
  const sy = PLOT.h / 1000;
  const peak: [number, number] = [PLOT.x + trace.peak[0] * sx, PLOT.y + trace.peak[1] * sy];
  const ticks = [0, 50, 100].filter((ns) => ns <= trace.spanNs);

  return (
    <Chapter
      body="Drop in a CSV trace or a FITS frame straight off the lab's instruments and see it plotted in the browser. The line being drawn here is a real laser pulse, recorded on a photodiode in the lab."
      cta={{ href: "/plotters", label: "Open the plotters" }}
      heading="Drop in a file, get a plot."
      index={1}
      length={2.5}
      mode="scrub"
      name="Plotter"
    >
      <svg className="chapter__svg" viewBox="0 0 600 380">
        <g className="chapter__chalk">
          <path d="M62 26 V322 H588" {...draw([0.04, 0.2])} />
          {ticks.map((ns) => {
            const x = PLOT.x + (ns / trace.spanNs) * PLOT.w;
            return (
              <g key={ns}>
                <path d={`M${x} 322 v9`} {...draw([0.16, 0.24])} />
                <text {...fade([0.2, 0.28])} textAnchor="middle" x={x} y={352}>
                  {ns}
                </text>
              </g>
            );
          })}
          <text {...fade([0.2, 0.28])} textAnchor="end" x={588} y={352}>
            t / ns
          </text>
          <text {...fade([0.2, 0.28])} x={74} y={30}>
            P
          </text>
          <g transform={`translate(${PLOT.x} ${PLOT.y}) scale(${sx} ${sy})`}>
            <path d={trace.d} vectorEffect="non-scaling-stroke" {...draw([0.26, 0.84], "chapter__trace")} />
          </g>
          <path
            d={`M${peak[0] - 26} ${peak[1] + 4} C${peak[0] - 28} ${peak[1] - 30}, ${peak[0] + 30} ${peak[1] - 32}, ${peak[0] + 27} ${peak[1] + 2} S${peak[0] - 18} ${peak[1] + 30}, ${peak[0] - 30} ${peak[1] - 2}`}
            {...draw([0.84, 0.93], "chapter__accent")}
          />
          <text {...fade([0.9, 0.97], "chapter__accentText")} x={peak[0] + 36} y={peak[1] + 6}>
            the pulse
          </text>
        </g>
      </svg>
    </Chapter>
  );
}

/* --------------------------------- builder -------------------------------- */

/** Millimetres per drawing unit: the sketched table is about 810 mm across. */
const MM_PER_UNIT = 1.5;
const C_MM_PER_NS = 299.792458;
const BEAM_SPAN: Span = [0.44, 0.86];
const BEAM_UNITS = 310 + 214 + 348;

const HOLES = Array.from({ length: 17 * 9 }, (_, i) => [60 + (i % 17) * 30, 70 + Math.floor(i / 17) * 30]);

function BuilderChapter() {
  const readoutRef = useRef<HTMLParagraphElement>(null);

  const onProgress = useCallback((p: number) => {
    const el = readoutRef.current;
    if (!el) return;
    const mm = within(p, BEAM_SPAN) * BEAM_UNITS * MM_PER_UNIT;
    el.textContent = `path ${Math.round(mm).toLocaleString("en-GB")} mm · flight ${(mm / C_MM_PER_NS).toFixed(2)} ns`;
  }, []);

  return (
    <Chapter
      body="Place lasers, mirrors and lenses on a millimetre grid, draw where the beam is meant to go, and read off its path length and time of flight before touching the real bench."
      cta={{ href: "/experiment/builder", label: "Open the builder" }}
      flip
      heading="Lay out an optical table."
      index={2}
      length={2.5}
      mode="scrub"
      name="Builder"
      onProgress={onProgress}
    >
      <svg className="chapter__svg" viewBox="0 0 600 380">
        <g className="chapter__chalk">
          <path d="M31 42 C200 39, 400 41, 569 40 L570 349 C400 351, 200 350, 30 348 Z" {...draw([0.02, 0.16])} />
          <g {...fade([0.08, 0.22], "chapter__holes")}>
            {HOLES.map(([x, y]) => (
              <circle cx={x} cy={y} key={`${x}-${y}`} r={1.5} />
            ))}
          </g>
          {/* laser */}
          <path d="M58 301 H130 V327 H58 Z" {...draw([0.18, 0.27])} />
          <text {...fade([0.24, 0.3])} x={60} y={292}>
            laser
          </text>
          {/* mirrors, at 45° */}
          <path d="M427 327 L453 301" {...draw([0.25, 0.31])} />
          <path d="M427 87 L453 113" {...draw([0.29, 0.35])} />
          {/* lens */}
          <path d="M261 76 C271 88, 271 112, 261 124 C251 112, 251 88, 261 76 Z" {...draw([0.32, 0.39])} />
          <text {...fade([0.36, 0.42])} textAnchor="middle" x={261} y={146}>
            lens
          </text>
          {/* detector */}
          <path d="M92 84 V116 M92 84 H70 V116 H92" {...draw([0.35, 0.42])} />
          <text {...fade([0.38, 0.44])} x={66} y={140}>
            detector
          </text>
          <path d="M130 314 H440 V100 H92" {...draw(BEAM_SPAN, "chapter__beam")} />
        </g>
      </svg>
      <p className="chapter__readout" ref={readoutRef}>
        path 0 mm · flight 0.00 ns
      </p>
    </Chapter>
  );
}

/* ------------------------------- calculator ------------------------------- */

const WAVE_DRAW: Span = [0.12, 0.3];
const WAVE_SCRUB: Span = [0.32, 0.9];
const HC_EV_NM = 1239.841984;

/** Approximate sRGB for a visible wavelength, after Dan Bruton's fit. */
function spectrum(nm: number) {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) [r, b] = [(440 - nm) / 60, 1];
  else if (nm < 490) [g, b] = [(nm - 440) / 50, 1];
  else if (nm < 510) [g, b] = [1, (510 - nm) / 20];
  else if (nm < 580) [r, g] = [(nm - 510) / 70, 1];
  else if (nm < 645) [r, g] = [1, (645 - nm) / 65];
  else r = 1;
  const edge = nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : 1;
  const channel = (c: number) => Math.round(255 * (c * edge) ** 0.8);
  return `rgb(${channel(r)} ${channel(g)} ${channel(b)})`;
}

function wavePath(nm: number) {
  const period = (nm / 700) * 132;
  let d = "";
  for (let x = 0; x <= 520; x += 3) {
    d += `${x ? "L" : "M"}${(40 + x).toFixed(0)} ${(196 - 58 * Math.sin((2 * Math.PI * x) / period)).toFixed(1)}`;
  }
  return d;
}

function CalculatorChapter() {
  const waveRef = useRef<SVGPathElement>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);

  const onProgress = useCallback((p: number) => {
    const nm = 700 - 300 * within(p, WAVE_SCRUB);
    waveRef.current?.setAttribute("d", wavePath(nm));
    waveRef.current?.style.setProperty("--wave", spectrum(nm));
    if (readoutRef.current) {
      readoutRef.current.textContent = `λ = ${Math.round(nm)} nm · E = ${(HC_EV_NM / nm).toFixed(2)} eV`;
    }
  }, []);

  return (
    <Chapter
      body="Photon energy from wavelength, laser damage thresholds, how far light gets in a given delay: the small sums that come up mid-experiment, answered as you type."
      cta={{ href: "/calculators", label: "Open the calculators" }}
      extra={
        <ul {...fade([0.6, 0.72], "chapter__links")}>
          <li>
            <Link href="/calculators/energy-wavelength-calculator">Energy ↔ wavelength</Link>
          </li>
          <li>
            <Link href="/calculators/lidt-calculator">Laser damage threshold</Link>
          </li>
          <li>
            <Link href="/calculators/light-travel-calculator">Light travel time</Link>
          </li>
        </ul>
      }
      heading="Quick maths for the bench."
      index={3}
      length={2.5}
      mode="scrub"
      name="Calculator"
      onProgress={onProgress}
    >
      <svg className="chapter__svg" viewBox="0 0 600 380">
        <g className="chapter__chalk">
          <text {...fade([0.02, 0.14], "chapter__equation")} textAnchor="middle" x={300} y={78}>
            E = hc / λ
          </text>
          <path d="M40 196 H560" {...draw([0.08, 0.16], "chapter__faint")} />
          <path d={wavePath(700)} ref={waveRef} {...draw(WAVE_DRAW, "chapter__wave")} />
        </g>
      </svg>
      <p className="chapter__readout" ref={readoutRef}>
        λ = 700 nm · E = 1.77 eV
      </p>
    </Chapter>
  );
}

/* --------------------------------- theory --------------------------------- */

function TheoryChapter() {
  return (
    <Chapter
      body="Short, visual notes on the quantum optics behind the lab's work: states, operators and the intuition that connects them. Still being written."
      flip
      heading="Notes on the physics."
      index={4}
      length={1}
      mode="play"
      name="Theory"
      status="coming soon"
    >
      <svg className="chapter__svg" viewBox="0 0 600 380">
        <g className="chapter__chalk">
          <path d="M170 190 A130 130 0 1 1 430 190 A130 130 0 1 1 170 190" {...draw([0, 0.3])} />
          <path d="M170 190 A130 36 0 0 0 430 190" {...draw([0.25, 0.42])} />
          <path d="M170 190 A130 36 0 0 1 430 190" {...draw([0.3, 0.46], "chapter__faint")} />
          <path d="M300 34 V346" {...draw([0.36, 0.52])} />
          <text {...fade([0.5, 0.6])} textAnchor="middle" x={300} y={26}>
            |0⟩
          </text>
          <text {...fade([0.52, 0.62])} textAnchor="middle" x={300} y={368}>
            |1⟩
          </text>
          <path d="M300 190 L382 104 M382 104 l-15 3 M382 104 l-2 15" {...draw([0.6, 0.82], "chapter__accent")} />
          <text {...fade([0.8, 0.92], "chapter__accentText")} x={390} y={100}>
            |ψ⟩
          </text>
        </g>
      </svg>
    </Chapter>
  );
}

export function HomeChapters({ trace }: { trace: TraceSketch }) {
  return (
    <div className="chapters">
      <PlotterChapter trace={trace} />
      <BuilderChapter />
      <CalculatorChapter />
      <TheoryChapter />
    </div>
  );
}
