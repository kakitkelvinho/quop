"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { CHALK_SEED } from "@/components/chalkboard-hero";

type Glyph = "axes" | "brackets" | "integral" | "beam";

type SectionCard = {
  glyph: Glyph;
  href: string;
  name: string;
  tag: string;
};

const CARDS: SectionCard[] = [
  { glyph: "axes", href: "/plotters", name: "Plotter", tag: "visualize your data" },
  {
    glyph: "brackets",
    href: "/calculators",
    name: "Calculator",
    tag: "quick maths for experiments",
  },
  { glyph: "integral", href: "/theory", name: "Theory", tag: "notes on physics, coming soon" },
  {
    glyph: "beam",
    href: "/experiment",
    name: "Experiment",
    tag: "an optical table builder",
  },
];

const GLYPHS: Record<Glyph, string[]> = {
  axes: ["M5 4 L5 28 L31 28", "M8 24 C13 21, 16 12, 22 10 S29 7, 30 6"],
  beam: [
    "M3 17 L12 17",
    "M15 6 C19 11, 19 23, 15 28",
    "M15 6 C11 11, 11 23, 15 28",
    "M19 17 L31 12",
    "M19 17 L31 22",
  ],
  brackets: ["M12 5 C7 9, 7 25, 12 29", "M24 5 C29 9, 29 25, 24 29", "M15 17 L21 17"],
  integral: ["M20 5 C15 5, 17 12, 16 17 C15 23, 16 29, 12 29", "M11 20 L23 13"],
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Four wobbled edges with a small gap at each corner — a rectangle as drawn
 *  by hand, not as drawn by a CSS border. */
function handRect(w: number, h: number, random: () => number) {
  const jitter = () => (random() - 0.5) * 2.6;
  const gap = 6;
  const edge = (x1: number, y1: number, x2: number, y2: number) => {
    const steps = 4;
    let d = `M${x1 + jitter()} ${y1 + jitter()}`;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      d += ` L${x1 + (x2 - x1) * t + jitter()} ${y1 + (y2 - y1) * t + jitter()}`;
    }
    return d;
  };

  return [
    edge(gap, 1, w - gap, 1),
    edge(w - 1, gap, w - 1, h - gap),
    edge(w - gap, h - 1, gap, h - 1),
    edge(1, h - gap, 1, gap),
  ];
}

export function SectionCards() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const cards = [...wrap.querySelectorAll<HTMLAnchorElement>(".chalkCard")];

    // the frames can only be drawn once the cards have real dimensions
    const drawFrames = () => {
      cards.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        const svg = card.querySelector<SVGSVGElement>(".chalkCard__frame");
        if (!svg || rect.width === 0) return;
        svg.replaceChildren();
        svg.setAttribute("viewBox", `0 0 ${Math.round(rect.width)} ${Math.round(rect.height)}`);
        const random = mulberry32(CHALK_SEED * 31 + i * 977);
        handRect(Math.round(rect.width), Math.round(rect.height), random).forEach((d, k) => {
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", d);
          svg.append(path);
          path.style.setProperty("--len", String(path.getTotalLength()));
          path.style.transitionDelay = `${i * 0.12 + k * 0.08}s`;
        });
      });
    };

    const frame = requestAnimationFrame(drawFrames);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.25 },
    );
    cards.forEach((card) => observer.observe(card));

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawFrames, 220);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="chalkCards" ref={wrapRef}>
      {CARDS.map((card) => (
        <Link
          aria-label={`${card.name} — ${card.tag}`}
          className="chalkCard"
          href={card.href}
          key={card.href}
        >
          <svg
            aria-hidden="true"
            className="chalkCard__frame"
            preserveAspectRatio="none"
            focusable="false"
          />
          <svg
            aria-hidden="true"
            className="chalkCard__glyph"
            focusable="false"
            viewBox="0 0 34 34"
          >
            {GLYPHS[card.glyph].map((d) => (
              <path d={d} key={d} />
            ))}
          </svg>
          <h2 className="chalkCard__name">{card.name}</h2>
          <p className="chalkCard__tag">{card.tag}</p>
          <span className="chalkCard__route">{card.href}</span>
        </Link>
      ))}
    </div>
  );
}
