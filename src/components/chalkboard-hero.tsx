"use client";

import { useEffect, useRef, type ReactNode } from "react";

/* ---------------------------------------------------------------------------
 * Taste knobs. Everything below this block is mechanism; these are the values
 * worth judging by eye. Chalk opacity and the mark colour live in globals.css
 * as --chalk-alpha / --chalk-dust / --mark, per theme.
 * ------------------------------------------------------------------------- */

/** How many equations may share the board at once. */
const ON_SCREEN_AT_ONCE = 4;

/** 0 = a board wiped clean. Raise for eraser sweeps and ghosts of earlier working. */
const BOARD_HISTORY = 0;

/** How long a finished equation sits before it is wiped, in ms. */
const HOLD_MS: [number, number] = [8000, 14000];

/** Pause between a wipe and the next equation going up, in ms. */
const RESPAWN_MS: [number, number] = [400, 2600];

/** How long the eraser takes to cross an equation, in ms. */
const SWEEP_MS = 1250;

/** How long the streaks an eraser leaves behind take to fade, in ms. */
const RESIDUE_FADE_MS = 2600;

/** Seeds the grain and the hand-drawn card frames. Any integer. */
const SEED = 4;

/** wide: one long line; narrow: a short line; tall: a stacked block. */
type Shape = "narrow" | "tall" | "wide";

type Equation = {
  accent?: boolean;
  html: string;
  id: string;
  shape: Shape;
  /** Relative to --eq-size, which scales with the viewport. */
  size: number;
};

const root = (body: string) =>
  `<span class="chalkRoot"><span class="chalkRoot__sign">√</span><span class="chalkRoot__body">${body}</span></span>`;

/** Hand-set HTML rather than KaTeX: a square root and an integral sign are the
 *  hardest things here, and CSS covers both. */
const EQUATIONS: Equation[] = [
  {
    html: [
      "∇ · <b>E</b> = ρ / ε<sub>0</sub>",
      "∇ · <b>B</b> = 0",
      "∇ × <b>E</b> = −∂<b>B</b> / ∂t",
      "∇ × <b>B</b> = μ<sub>0</sub><b>J</b> + μ<sub>0</sub>ε<sub>0</sub> ∂<b>E</b> / ∂t",
    ]
      .map((line) => `<span class="chalkEq__line">${line}</span>`)
      .join(""),
    id: "maxwell",
    shape: "tall",
    size: 0.8,
  },
  {
    html: "Ĥ = ħω (â<sup>†</sup>â + ½)",
    id: "qho",
    shape: "narrow",
    size: 1.15,
  },
  {
    html: `w(z) = w<sub>0</sub> ${root("1 + (z / z<sub>R</sub>)<sup>2</sup>")}`,
    id: "waist",
    shape: "wide",
    size: 1.05,
  },
  { accent: true, html: "Ĥ |ψ⟩ = E |ψ⟩", id: "schrodinger", shape: "narrow", size: 1.3 },
  {
    html: "Ĥ = ħω<sub>c</sub> â<sup>†</sup>â + ½ħω<sub>a</sub> σ̂<sub>z</sub> + ħg (â σ̂<sub>+</sub> + â<sup>†</sup> σ̂<sub>−</sub>)",
    id: "jaynes-cummings",
    shape: "wide",
    size: 0.9,
  },
  {
    html: "iħ ∂<sub>t</sub>ψ = (−ħ<sup>2</sup>∇<sup>2</sup> / 2m + V + g|ψ|<sup>2</sup>) ψ",
    id: "gross-pitaevskii",
    shape: "wide",
    size: 0.95,
  },
  {
    html: `|α⟩ = e<sup>−|α|<sup>2</sup>/2</sup> Σ<sub>n</sub> α<sup>n</sup> / ${root("n!")} |n⟩`,
    id: "coherent",
    shape: "wide",
    size: 1,
  },
  { html: "[â, â<sup>†</sup>] = 1", id: "commutator", shape: "narrow", size: 1.25 },
  { html: "E = ħω = hc / λ", id: "photon", shape: "narrow", size: 1.2 },
  {
    html: `f̃(ω) = <span class="chalkEq__big">∫</span> f(t) e<sup>−iωt</sup> dt`,
    id: "fourier",
    shape: "wide",
    size: 1.05,
  },
  {
    html: "n̄ = 1 / (e<sup>ħω/k<sub>B</sub>T</sup> − 1)",
    id: "bose-einstein",
    shape: "narrow",
    size: 1.05,
  },
  { html: "Δx Δp ≥ ħ / 2", id: "heisenberg", shape: "narrow", size: 1.2 },
];

/** Candidate positions as a percentage of the board. Wide lines only get the
 *  bands along the top and bottom, tall blocks only the corners (the flanks
 *  beside the welcome text are too narrow for them); a candidate that
 *  would overlap the welcome text or another equation is skipped. */
const SLOTS: { shapes: Shape[]; x: number; y: number }[] = [
  { shapes: ["tall"], x: 20, y: 20 },
  { shapes: ["tall"], x: 80, y: 21 },
  { shapes: ["tall"], x: 21, y: 80 },
  { shapes: ["tall"], x: 79, y: 79 },
  { shapes: ["wide", "narrow"], x: 24, y: 12 },
  { shapes: ["wide", "narrow"], x: 52, y: 8 },
  { shapes: ["wide", "narrow"], x: 78, y: 14 },
  { shapes: ["narrow"], x: 13, y: 36 },
  { shapes: ["narrow"], x: 87, y: 33 },
  { shapes: ["narrow"], x: 12, y: 64 },
  { shapes: ["narrow"], x: 88, y: 66 },
  { shapes: ["wide", "narrow"], x: 25, y: 88 },
  { shapes: ["wide", "narrow"], x: 54, y: 92 },
  { shapes: ["wide", "narrow"], x: 79, y: 86 },
];

/* ------------------------------- mechanism ------------------------------- */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function markRGB(): [number, number, number] {
  const raw = readVar("--mark") || "17 17 17";
  const [r, g, b] = raw.split(/[\s,]+/).map((n) => parseFloat(n));
  return [r, g, b];
}

/** Graphite on paper smudges far less than chalk dust on slate. */
function ghostScale() {
  return document.documentElement.dataset.theme === "dark" ? 1 : 0.42;
}

export function ChalkboardHero({ children }: { children: ReactNode }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const welcomeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const board = boardRef.current;
    const grainCanvas = grainRef.current;
    const ghostCanvas = ghostRef.current;
    const layer = layerRef.current;
    const welcome = welcomeRef.current;
    if (!board || !grainCanvas || !ghostCanvas || !layer || !welcome) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const active = new Map<number, { el: HTMLDivElement; item: Equation }>();
    let timers: ReturnType<typeof setTimeout>[] = [];
    let disposed = false;

    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timers.push(t);
      return t;
    };
    const clearTimers = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const between = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);

    function sizeCanvas(canvas: HTMLCanvasElement) {
      const rect = board!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, h: rect.height, w: rect.width };
    }

    /* the surface itself: a barely-there radial falloff, speckle, and long grain */
    function drawGrain() {
      const { ctx, h, w } = sizeCanvas(grainCanvas!);
      const base = readVar("--background") || "#ffffff";
      const deep = readVar("--background-muted") || "#fafafa";
      const random = mulberry32(SEED * 7717);

      const gradient = ctx.createRadialGradient(
        w * 0.5,
        h * 0.42,
        0,
        w * 0.5,
        h * 0.42,
        Math.max(w, h) * 0.78,
      );
      gradient.addColorStop(0, base);
      gradient.addColorStop(1, deep);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const [mr, mg, mb] = markRGB();

      ctx.save();
      for (let i = 0; i < Math.round((w * h) / 420); i++) {
        ctx.fillStyle = `rgba(${mr},${mg},${mb},${random() * 0.045})`;
        ctx.fillRect(random() * w, random() * h, 1, 1);
      }
      ctx.restore();

      ctx.save();
      for (let i = 0; i < 90; i++) {
        const y = random() * h;
        const x = random() * w;
        const len = 60 + random() * 260;
        ctx.strokeStyle = `rgba(${mr},${mg},${mb},${0.008 + random() * 0.016})`;
        ctx.lineWidth = 0.6 + random() * 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(
          x + len * 0.3,
          y + (random() - 0.5) * 8,
          x + len * 0.7,
          y + (random() - 0.5) * 8,
          x + len,
          y + (random() - 0.5) * 4,
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    /* what a board that has been used all morning looks like */
    function drawGhosts() {
      const { ctx, h, w } = sizeCanvas(ghostCanvas!);
      ctx.clearRect(0, 0, w, h);
      if (BOARD_HISTORY === 0) return;

      const random = mulberry32(SEED * 104729 + 13);
      const [mr, mg, mb] = markRGB();
      const scale = ghostScale();

      ctx.save();
      ctx.filter = "blur(7px)";
      ctx.lineCap = "round";
      for (let i = 0; i < Math.round(BOARD_HISTORY * 0.55); i++) {
        const cx = random() * w;
        const cy = random() * h;
        const radius = 90 + random() * 260;
        const start = random() * Math.PI * 2;
        ctx.strokeStyle = `rgba(${mr},${mg},${mb},${(0.012 + random() * 0.03) * scale})`;
        ctx.lineWidth = 22 + random() * 46;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, start, start + 0.5 + random() * 1.1);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.filter = "blur(2.2px)";
      ctx.lineCap = "round";
      for (let i = 0; i < Math.round(BOARD_HISTORY * 0.9); i++) {
        const baseY = 40 + random() * (h - 80);
        let x = random() * w * 0.92;
        const runs = 3 + Math.floor(random() * 7);
        for (let k = 0; k < runs; k++) {
          const width = 7 + random() * 22;
          ctx.strokeStyle = `rgba(${mr},${mg},${mb},${(0.02 + random() * 0.05) * scale})`;
          ctx.lineWidth = 1.1 + random() * 1.6;
          ctx.beginPath();
          ctx.moveTo(x, baseY + (random() - 0.5) * 6);
          ctx.bezierCurveTo(
            x + width * 0.35,
            baseY - 6 - random() * 8,
            x + width * 0.65,
            baseY + 6 + random() * 8,
            x + width,
            baseY + (random() - 0.5) * 6,
          );
          ctx.stroke();
          x += width + 3 + random() * 5;
        }
      }
      ctx.restore();
    }

    /* a wipe on a used board leaves something behind; a clean one does not */
    function smudge(rect: DOMRect) {
      if (BOARD_HISTORY === 0) return;
      const boardRect = board!.getBoundingClientRect();
      const ctx = ghostCanvas!.getContext("2d")!;
      const [mr, mg, mb] = markRGB();
      ctx.save();
      ctx.filter = "blur(5px)";
      ctx.fillStyle = `rgba(${mr},${mg},${mb},${0.055 * ghostScale()})`;
      ctx.beginPath();
      ctx.ellipse(
        rect.left - boardRect.left + rect.width / 2,
        rect.top - boardRect.top + rect.height / 2,
        rect.width * 0.58,
        Math.max(9, rect.height * 0.72),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    function shuffled<T>(items: T[]) {
      return [...items].sort(() => Math.random() - 0.5);
    }

    function unusedEquations() {
      const onBoard = new Set([...active.values()].map((entry) => entry.item.id));
      return EQUATIONS.filter((item) => !onBoard.has(item.id));
    }

    function freeSlots(shape: Shape) {
      return SLOTS.map((slot, index) => ({ index, slot })).filter(
        ({ index, slot }) => !active.has(index) && slot.shapes.includes(shape),
      );
    }

    /** Whether a freshly placed equation sits inside the board, clear of the
     *  welcome text and of everything else already written up. */
    function fits(el: HTMLDivElement) {
      const boardRect = board!.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const pad = 12;
      if (
        rect.left < boardRect.left + pad ||
        rect.right > boardRect.right - pad ||
        rect.top < boardRect.top + pad ||
        rect.bottom > boardRect.bottom - pad
      ) {
        return false;
      }
      const overlaps = (other: DOMRect, margin: number) =>
        rect.left < other.right + margin &&
        rect.right > other.left - margin &&
        rect.top < other.bottom + margin &&
        rect.bottom > other.top - margin;
      if (overlaps(welcome!.getBoundingClientRect(), 14)) return false;
      return [...active.values()].every((entry) => !overlaps(entry.el.getBoundingClientRect(), 18));
    }

    function place(item: Equation, slotIndex: number, animate: boolean) {
      const slot = SLOTS[slotIndex];
      const el = document.createElement("div");
      el.className = "chalkEq";
      const ink = document.createElement("div");
      ink.className = `chalkEq__ink${item.accent ? " chalkEq__ink--accent" : ""}`;
      ink.style.fontSize = `calc(var(--eq-size) * ${item.size})`;
      ink.innerHTML = item.html;
      el.append(ink);
      el.style.left = `${slot.x}%`;
      el.style.top = `${slot.y}%`;
      layer!.append(el);

      // nudge it back inside the board if the line overhangs an edge
      const boardRect = board!.getBoundingClientRect();
      const half = el.getBoundingClientRect().width / 2;
      const pad = 18;
      let left = (slot.x / 100) * boardRect.width;
      if (left - half < pad) left = pad + half;
      if (left + half > boardRect.width - pad) left = boardRect.width - pad - half;
      el.style.left = `${left}px`;

      if (!fits(el)) {
        el.remove();
        return false;
      }

      active.set(slotIndex, { el, item });

      if (animate && !reduce.matches) {
        el.classList.add("is-writing");
        requestAnimationFrame(() => el.classList.add("is-on"));
      } else {
        el.style.transition = "none";
        el.classList.add("is-on");
      }

      if (!reduce.matches) {
        later(() => erase(slotIndex), 1600 + between(HOLD_MS));
      }
      return true;
    }

    /** Stripes of random strength running along the eraser's strokes: what a
     *  felt eraser leaves of chalk on the first pass. */
    function streaks(length: number, direction: string, colour: (alpha: number) => string) {
      const stops: string[] = [];
      let at = 0;
      while (at < length) {
        const alpha = Math.random() < 0.45 ? 0 : 0.06 + Math.random() * 0.26;
        stops.push(`${colour(alpha)} ${at.toFixed(1)}px`);
        at += 2 + Math.random() * 6;
      }
      return `linear-gradient(${direction}, ${stops.join(", ")})`;
    }

    function setMask(el: HTMLElement, image: string, size: string, position: string) {
      for (const prefix of ["", "-webkit-"]) {
        el.style.setProperty(`${prefix}mask-image`, image);
        el.style.setProperty(`${prefix}mask-size`, size);
        el.style.setProperty(`${prefix}mask-position`, position);
        el.style.setProperty(`${prefix}mask-repeat`, "no-repeat");
      }
    }

    /** A felt eraser worked across the equation in short back-and-forth
     *  strokes. Strokes run across the short side and the eraser advances
     *  along the long one, so a line is cleared end to end and a block top to
     *  bottom. The mask is three layers added together: the streaky residue,
     *  everything the eraser has not reached yet, and what is left of the band
     *  it is working now. */
    function sweep(el: HTMLDivElement, done: () => void) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const alongX = w >= h;
      const long = alongX ? w : h;
      const short = alongX ? h : w;
      const band = Math.min(64, Math.max(26, short * 0.5));
      const strokes = Math.ceil(long / band);
      const forward = Math.random() < 0.7;
      const soft = 10;

      // gradient directions in the box's own terms, flipped for a reverse sweep
      const advance = alongX ? (forward ? "to right" : "to left") : forward ? "to bottom" : "to top";
      const down = alongX ? "to bottom" : "to right";
      const up = alongX ? "to top" : "to left";
      const residue = streaks(long, advance, (a) => `rgb(0 0 0 / ${a})`);

      const dust = document.createElement("div");
      dust.className = "chalkDust";
      dust.style.left = el.style.left;
      dust.style.top = el.style.top;
      dust.style.width = `${w}px`;
      dust.style.height = `${h}px`;
      dust.style.backgroundImage = streaks(long, advance, (a) => `rgb(var(--mark) / ${a * 0.07})`);
      layer!.insertBefore(dust, el);

      const bandPosition = (offset: number) => {
        const from = forward ? offset : long - offset - band;
        return alongX ? `${from}px 0` : `0 ${from}px`;
      };
      const bandSize = alongX ? `${band}px 100%` : `100% ${band}px`;

      const started = performance.now();
      const frame = (now: number) => {
        if (disposed) return;
        const t = Math.min(1, (now - started) / SWEEP_MS);
        const f = t * strokes;
        const k = Math.min(strokes - 1, Math.floor(f));
        const within = t === 1 ? 1 : f - k;
        const cleared = k * band;
        const edge = cleared + band;
        const reach = within * short;

        const rest = `linear-gradient(${advance}, transparent ${edge - soft}px, #000 ${edge}px)`;
        const current = `linear-gradient(${k % 2 ? up : down}, transparent ${reach}px, #000 ${reach + soft}px)`;
        setMask(
          el,
          t === 1 ? residue : `${residue}, ${rest}, ${current}`,
          t === 1 ? "100% 100%" : `100% 100%, 100% 100%, ${bandSize}`,
          t === 1 ? "0 0" : `0 0, 0 0, ${bandPosition(cleared)}`,
        );

        const shown = Math.min(long, cleared + (within > 0 ? band : 0));
        const hidden = long - shown;
        dust.style.clipPath = alongX
          ? forward
            ? `inset(0 ${hidden}px 0 0)`
            : `inset(0 0 0 ${hidden}px)`
          : forward
            ? `inset(0 0 ${hidden}px 0)`
            : `inset(${hidden}px 0 0 0)`;

        if (t < 1) {
          requestAnimationFrame(frame);
          return;
        }
        for (const node of [el, dust]) {
          node.style.transitionDuration = `${RESIDUE_FADE_MS}ms`;
          node.classList.add("is-fading");
        }
        later(() => {
          dust.remove();
          done();
        }, RESIDUE_FADE_MS);
      };
      requestAnimationFrame(frame);
    }

    function erase(slotIndex: number) {
      const entry = active.get(slotIndex);
      if (!entry) return;
      smudge(entry.el.getBoundingClientRect());
      entry.el.classList.remove("is-writing");
      entry.el.classList.add("is-erasing");
      sweep(entry.el, () => {
        entry.el.remove();
        active.delete(slotIndex);
        later(() => spawn(true), between(RESPAWN_MS));
      });
    }

    function spawn(animate: boolean) {
      if (disposed || active.size >= ON_SCREEN_AT_ONCE) return;
      for (const item of shuffled(unusedEquations())) {
        for (const { index } of shuffled(freeSlots(item.shape))) {
          if (place(item, index, animate)) return;
        }
      }
      // nothing fits around what is up there now; look again once more of it is wiped
      if (!reduce.matches) later(() => spawn(true), 1500);
    }

    function resetBoard(animate: boolean) {
      clearTimers();
      active.clear();
      layer!.innerHTML = "";
      drawGrain();
      drawGhosts();

      for (let k = 0; k < ON_SCREEN_AT_ONCE; k++) {
        if (animate && !reduce.matches) later(() => spawn(true), k * 420);
        else spawn(false);
      }
    }

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => resetBoard(false), 220);
    };
    window.addEventListener("resize", onResize);

    // the theme toggle swaps html[data-theme]; the canvases have to be redrawn
    const themeObserver = new MutationObserver(() => {
      drawGrain();
      drawGhosts();
    });
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });

    const boot = () => {
      if (!disposed) resetBoard(true);
    };
    if (document.fonts?.ready) void document.fonts.ready.then(boot);
    else boot();

    return () => {
      disposed = true;
      clearTimers();
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <section className="chalkboard" ref={boardRef}>
      <canvas aria-hidden="true" className="chalkboard__grain" ref={grainRef} />
      <canvas aria-hidden="true" className="chalkboard__ghosts" ref={ghostRef} />
      <div aria-hidden="true" className="chalkLayer" ref={layerRef} />
      <div className="chalkboard__welcome" ref={welcomeRef}>
        {children}
      </div>
    </section>
  );
}

/** The paper/slate texture the chalk marks are filtered through. Rendered once,
 *  near the root, because every chalk stroke on the page references it by id. */
export function ChalkFilters() {
  return (
    <svg aria-hidden="true" className="chalkFilters" focusable="false">
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          height="150%"
          id="quop-chalk"
          width="124%"
          x="-12%"
          y="-25%"
        >
          <feTurbulence baseFrequency="0.78" numOctaves="3" result="n" seed="7" type="fractalNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            result="rough"
            scale="1.9"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur in="rough" result="soft" stdDeviation="0.34" />
          <feTurbulence baseFrequency="1.4" numOctaves="2" result="s" seed="19" type="fractalNoise" />
          <feColorMatrix
            in="s"
            result="holes"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -9 0 0 0 7.55"
          />
          <feComposite in="soft" in2="holes" operator="in" />
        </filter>
        <filter
          colorInterpolationFilters="sRGB"
          height="150%"
          id="quop-graphite"
          width="124%"
          x="-12%"
          y="-25%"
        >
          <feTurbulence baseFrequency="0.9" numOctaves="3" result="n" seed="11" type="fractalNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            result="rough"
            scale="1.15"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur in="rough" result="soft" stdDeviation="0.22" />
          <feTurbulence baseFrequency="1.75" numOctaves="2" result="s" seed="23" type="fractalNoise" />
          <feColorMatrix
            in="s"
            result="holes"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -11 0 0 0 9.9"
          />
          <feComposite in="soft" in2="holes" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

export { SEED as CHALK_SEED };
