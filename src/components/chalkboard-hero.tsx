"use client";

import { useEffect, useRef, type ReactNode } from "react";

/* ---------------------------------------------------------------------------
 * Taste knobs. Everything below this block is mechanism; these are the values
 * worth judging by eye. Chalk opacity and the mark colour live in globals.css
 * as --chalk-alpha / --chalk-dust / --mark, per theme.
 * ------------------------------------------------------------------------- */

/** How many equations may share the board at once. */
const ON_SCREEN_AT_ONCE = 2;

/** 0 = a board wiped clean. Raise for eraser sweeps and ghosts of earlier working. */
const BOARD_HISTORY = 0;

/** How long a finished equation sits before it is wiped, in ms. */
const HOLD_MS: [number, number] = [8000, 13000];

/** Pause between a wipe and the next equation going up, in ms. */
const RESPAWN_MS: [number, number] = [400, 2600];

/** Seeds the grain and the hand-drawn card frames. Any integer. */
const SEED = 4;

type Equation = {
  accent?: boolean;
  html: string;
  id: string;
  size: number;
  wide: boolean;
};

/** One per domain. Hand-set HTML rather than KaTeX — none of these need a
 *  fraction or an integral, so a 280 KB dependency would buy nothing. */
const EQUATIONS: Equation[] = [
  {
    html: "ℒ = −¼ F<sub>μν</sub>F<sup>μν</sup> − J<sup>μ</sup>A<sub>μ</sub>",
    id: "em",
    size: 1.55,
    wide: true,
  },
  {
    html: "ℒ = ½ m q̇<sup>2</sup> − ½ m ω<sup>2</sup> q<sup>2</sup>",
    id: "cm",
    size: 1.5,
    wide: true,
  },
  { html: "S = k<sub>B</sub> ln Ω", id: "sm", size: 1.75, wide: false },
  { accent: true, html: "Ĥ |ψ⟩ = E |ψ⟩", id: "qm", size: 1.8, wide: false },
];

/** Positions as a percentage of the board. Wide equations only get the bands
 *  along the top and bottom, where there is room for them. */
const SLOTS: { wide: boolean; x: number; y: number }[] = [
  { wide: true, x: 24, y: 13 },
  { wide: true, x: 52, y: 8 },
  { wide: true, x: 77, y: 15 },
  { wide: false, x: 12, y: 47 },
  { wide: false, x: 88, y: 44 },
  { wide: false, x: 14, y: 72 },
  { wide: true, x: 26, y: 89 },
  { wide: true, x: 55, y: 92 },
  { wide: true, x: 80, y: 84 },
  { wide: false, x: 87, y: 68 },
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

  useEffect(() => {
    const board = boardRef.current;
    const grainCanvas = grainRef.current;
    const ghostCanvas = ghostRef.current;
    const layer = layerRef.current;
    if (!board || !grainCanvas || !ghostCanvas || !layer) return;

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

    function freeSlots(wide: boolean) {
      return SLOTS.map((slot, index) => ({ index, slot })).filter(
        ({ index, slot }) => !active.has(index) && (wide ? slot.wide : true),
      );
    }

    function unusedEquations() {
      const onBoard = new Set([...active.values()].map((entry) => entry.item.id));
      const free = EQUATIONS.filter((item) => !onBoard.has(item.id));
      return free.length ? free : EQUATIONS;
    }

    function place(item: Equation, slotIndex: number, animate: boolean) {
      const slot = SLOTS[slotIndex];
      const el = document.createElement("div");
      el.className = "chalkEq";
      const ink = document.createElement("div");
      ink.className = `chalkEq__ink${item.accent ? " chalkEq__ink--accent" : ""}`;
      ink.style.fontSize = `${item.size}rem`;
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
    }

    function erase(slotIndex: number) {
      const entry = active.get(slotIndex);
      if (!entry) return;
      smudge(entry.el.getBoundingClientRect());
      entry.el.classList.remove("is-writing", "is-on");
      entry.el.classList.add("is-erasing");
      later(() => {
        entry.el.remove();
        active.delete(slotIndex);
        later(spawn, between(RESPAWN_MS));
      }, 1150);
    }

    function spawn() {
      if (disposed || active.size >= ON_SCREEN_AT_ONCE) return;
      const candidates = unusedEquations();
      const item = candidates[Math.floor(Math.random() * candidates.length)];
      const slots = freeSlots(item.wide);
      if (!slots.length) return;
      place(item, slots[Math.floor(Math.random() * slots.length)].index, true);
    }

    function resetBoard(animate: boolean) {
      clearTimers();
      active.clear();
      layer!.innerHTML = "";
      drawGrain();
      drawGhosts();

      const opening = [...EQUATIONS]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(ON_SCREEN_AT_ONCE, SLOTS.length));

      opening.forEach((item, k) => {
        const put = () => {
          const slots = freeSlots(item.wide);
          if (!slots.length) return;
          place(item, slots[Math.floor(Math.random() * slots.length)].index, animate);
        };
        if (animate && !reduce.matches) later(put, k * 420);
        else put();
      });
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
      <div className="chalkboard__welcome">{children}</div>
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
