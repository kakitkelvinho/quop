"use client";

// PROTOTYPE (#301): throwaway note-layout variants (?variant=A|B|C|D). Not for main.
// Question: should a note be a scrolling page, slides, or a toggle between them?
// Four variants of /notes, all showing one sample note: prose, display
// equations and a chart that animates in steps (the data array changes per step).

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";

import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";
import "./note-layout.prototype.css";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip);

const VARIANTS = [
  { key: "A", name: "Article, reader steps the chart" },
  { key: "B", name: "Scrollytelling, sticky figure" },
  { key: "C", name: "Slides" },
  { key: "D", name: "Toggle: Read ↔ Present" },
];

/* ---------- the sample note: one source, every variant renders it ---------- */

// MathML stands in for the build-time maths renderer; it's not the decision.
const EQ_STATE = `<math display="block"><mrow><mo>|</mo><mi>α</mi><mo>⟩</mo><mo>=</mo><msup><mi>e</mi><mrow><mo>−</mo><msup><mrow><mo>|</mo><mi>α</mi><mo>|</mo></mrow><mn>2</mn></msup><mo>/</mo><mn>2</mn></mrow></msup><munderover><mo>∑</mo><mrow><mi>n</mi><mo>=</mo><mn>0</mn></mrow><mi>∞</mi></munderover><mfrac><msup><mi>α</mi><mi>n</mi></msup><msqrt><mrow><mi>n</mi><mo>!</mo></mrow></msqrt></mfrac><mo>|</mo><mi>n</mi><mo>⟩</mo></mrow></math>`;
const EQ_POISSON = `<math display="block"><mrow><mi>P</mi><mo>(</mo><mi>n</mi><mo>)</mo><mo>=</mo><msup><mrow><mo>|</mo><mo>⟨</mo><mi>n</mi><mo>|</mo><mi>α</mi><mo>⟩</mo><mo>|</mo></mrow><mn>2</mn></msup><mo>=</mo><msup><mi>e</mi><mrow><mo>−</mo><mover><mi>n</mi><mo>‾</mo></mover></mrow></msup><mfrac><msup><mover><mi>n</mi><mo>‾</mo></mover><mi>n</mi></msup><mrow><mi>n</mi><mo>!</mo></mrow></mfrac><mo>,</mo><mspace width="1em"/><mover><mi>n</mi><mo>‾</mo></mover><mo>=</mo><msup><mrow><mo>|</mo><mi>α</mi><mo>|</mo></mrow><mn>2</mn></msup></mrow></math>`;
const EQ_SPREAD = `<math display="block"><mrow><mi>Δ</mi><mi>n</mi><mo>=</mo><msqrt><mover><mi>n</mi><mo>‾</mo></mover></msqrt><mo>,</mo><mspace width="1.5em"/><mfrac><mrow><mi>Δ</mi><mi>n</mi></mrow><mover><mi>n</mi><mo>‾</mo></mover></mfrac><mo>=</mo><mfrac><mn>1</mn><msqrt><mover><mi>n</mi><mo>‾</mo></mover></msqrt></mfrac></mrow></math>`;
const NBAR = `<math><mover><mi>n</mi><mo>‾</mo></mover></math>`;

function Eq({ mathml }: { mathml: string }) {
  return <div className="nl-eq" dangerouslySetInnerHTML={{ __html: mathml }} />;
}
function M({ mathml }: { mathml: string }) {
  return <span dangerouslySetInnerHTML={{ __html: mathml }} />;
}

type Step = { id: string; heading: string; nbar: number; body: ReactNode; title?: boolean };

const TITLE = "Photon statistics of a coherent state";

const STEPS: Step[] = [
  {
    id: "intro",
    heading: TITLE,
    nbar: 1,
    title: true,
    body: (
      <p>
        A laser well above threshold is the closest thing to a classical wave that quantum optics
        has. Counting its photons tells you how close.
      </p>
    ),
  },
  {
    id: "state",
    heading: "The state",
    nbar: 1,
    body: (
      <>
        <p>A coherent state is a superposition of every photon number, weighted by its amplitude α:</p>
        <Eq mathml={EQ_STATE} />
      </>
    ),
  },
  {
    id: "counting",
    heading: "Counting photons",
    nbar: 1,
    body: (
      <>
        <p>The chance of finding exactly n photons is a Poisson distribution:</p>
        <Eq mathml={EQ_POISSON} />
        <p>
          With <M mathml={NBAR} /> = 1, empty and one-photon detections are equally likely.
        </p>
      </>
    ),
  },
  {
    id: "brighter",
    heading: "Turn up the amplitude",
    nbar: 4,
    body: (
      <p>
        At <M mathml={NBAR} /> = 4 the peak moves to four photons, and the distribution widens.
      </p>
    ),
  },
  {
    id: "classical",
    heading: "The classical limit",
    nbar: 9,
    body: (
      <>
        <p>The spread grows, but more slowly than the mean:</p>
        <Eq mathml={EQ_SPREAD} />
        <p>The relative fluctuations shrink, and a bright coherent state looks like a steady wave.</p>
      </>
    ),
  },
];

/* ---------- the chart: animating = changing the data array ---------- */

function poisson(nbar: number) {
  const points = [];
  let p = Math.exp(-nbar);
  for (let n = 0; n <= 20; n++) {
    points.push({ x: n, y: p });
    p *= nbar / (n + 1);
  }
  return points;
}

// --accent is the same station blue in both themes
const ACCENT = "#1a5fb4";

function PoissonChart({ nbar, height = 260 }: { nbar: number; height?: number | string }) {
  const data = useMemo<ChartData<"scatter">>(
    () => ({
      datasets: [
        {
          data: poisson(nbar),
          showLine: true,
          borderColor: ACCENT,
          backgroundColor: ACCENT,
          pointRadius: 3.5,
          borderWidth: 2,
          tension: 0.25,
        },
      ],
    }),
    [nbar],
  );
  const options = useMemo<ChartOptions<"scatter">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      showLine: true,
      animation: { duration: 700, easing: "easeInOutCubic" },
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 0, max: 20, title: { display: true, text: "photon number n" }, ticks: { stepSize: 2 } },
        y: { min: 0, max: 0.4, title: { display: true, text: "P(n)" } },
      },
    }),
    [],
  );
  return (
    <div className="nl-chart" style={{ height }}>
      <Scatter data={data} options={options} />
    </div>
  );
}

/** Rule 5: surface the state that drives the figure. */
function Readout({ step, nbar }: { step: number; nbar: number }) {
  return (
    <div className="nl-readout">
      step {step + 1} / {STEPS.length} · n̄ = {nbar.toFixed(nbar % 1 ? 1 : 0)}
    </div>
  );
}

/* ---------- A: plain article; the reader steps the chart ---------- */

function VariantA() {
  const [nbar, setNbar] = useState(1);
  const presets = [1, 4, 9];
  return (
    <article className="nl-article">
      <h1 className="toolTitle">{TITLE}</h1>
      {STEPS.map((s, i) => (
        <section key={s.id} className="nl-prose">
          {!s.title && <h2>{s.heading}</h2>}
          {s.body}
          {s.id === "counting" && (
            <figure className="nl-figure">
              <PoissonChart nbar={nbar} />
              <div className="nl-stepper">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={p === nbar ? "is-on" : ""}
                    onClick={() => setNbar(p)}
                  >
                    n̄ = {p}
                  </button>
                ))}
                <input
                  type="range"
                  min={0.5}
                  max={12}
                  step={0.5}
                  value={nbar}
                  onChange={(e) => setNbar(Number(e.target.value))}
                  aria-label="Mean photon number"
                />
              </div>
              <figcaption>
                Drag or pick a mean photon number; the text below refers to n̄ = 4 and 9.
              </figcaption>
              <Readout step={i} nbar={nbar} />
            </figure>
          )}
        </section>
      ))}
    </article>
  );
}

/* ---------- B: scrollytelling; the figure sticks, scrolling steps it ---------- */

function useActiveStep(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.slice(0, count).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [count]);
  return { refs, active };
}

function Scrolly() {
  const { refs, active } = useActiveStep(STEPS.length);
  const nbar = STEPS[active].nbar;
  return (
    <div className="nl-scrolly">
      <div className="nl-scrolly__figure">
        <PoissonChart nbar={nbar} height="100%" />
        <Readout step={active} nbar={nbar} />
      </div>
      <div className="nl-scrolly__steps">
        {STEPS.map((s, i) => (
          <section
            key={s.id}
            data-step={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`nl-scrolly__step nl-prose ${i === active ? "is-active" : ""}`}
          >
            {s.title ? <h1 className="toolTitle">{s.heading}</h1> : <h2>{s.heading}</h2>}
            {s.body}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------- C: slides; one step per slide ---------- */

function Slides({ start = 0, onStep }: { start?: number; onStep?: (i: number) => void }) {
  const [i, setI] = useState(start);
  const stage = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const go = (to: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, to));
    setI(next);
    onStep?.(next);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey) return; // the switcher's keys
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") go(i + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(i - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const s = STEPS[i];
  return (
    <div
      ref={stage}
      className="nl-deck"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className={`nl-slide ${s.title ? "nl-slide--title" : ""}`} key={s.id}>
        <div className="nl-slide__text nl-prose">
          {s.title ? <h1 className="toolTitle">{s.heading}</h1> : <h2>{s.heading}</h2>}
          {s.body}
        </div>
        {!s.title && (
          <div className="nl-slide__figure">
            <PoissonChart nbar={s.nbar} height="100%" />
          </div>
        )}
      </div>
      <div className="nl-deck__bar">
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide">
          ←
        </button>
        <span className="nl-deck__dots">
          {STEPS.map((x, j) => (
            <button
              key={x.id}
              type="button"
              className={j === i ? "is-on" : ""}
              onClick={() => go(j)}
              aria-label={`Slide ${j + 1}`}
            />
          ))}
        </span>
        <button
          type="button"
          onClick={() => go(i + 1)}
          disabled={i === STEPS.length - 1}
          aria-label="Next slide"
        >
          →
        </button>
        <button
          type="button"
          onClick={() => stage.current?.requestFullscreen?.()}
          aria-label="Full screen"
          title="Full screen"
        >
          ⛶
        </button>
        <Readout step={i} nbar={s.nbar} />
      </div>
    </div>
  );
}

/* ---------- D: one source, Read (scroll) or Present (slides) ---------- */

function VariantD() {
  const [mode, setMode] = useState<"read" | "present">("read");
  return (
    <div className="nl-toggle">
      <div className="nl-toggle__bar" role="group" aria-label="View">
        <button type="button" className={mode === "read" ? "is-on" : ""} onClick={() => setMode("read")}>
          Read
        </button>
        <button
          type="button"
          className={mode === "present" ? "is-on" : ""}
          onClick={() => setMode("present")}
        >
          Present
        </button>
      </div>
      {mode === "read" ? <Scrolly /> : <Slides />}
    </div>
  );
}

export function NoteLayoutPrototype() {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));
  if (!variant) return null;
  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <Scrolly />}
      {variant === "C" && <Slides />}
      {variant === "D" && <VariantD />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </>
  );
}
