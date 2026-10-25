"use client";

// PROTOTYPE (#301): throwaway note-layout variants (?variant=A|E). Not for main.
// Notes are for reading (alone, or by others); presenting is a Builder matter.
// Question now: an article (A, figures follow the text) or a paged book you can
// scroll through like a PDF (E, with a page mode, contents overview and find)?
// Both render one sample note whose figures are drawn from parameters.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { PrototypeSwitcher, usePrototypeVariant } from "@/components/prototype-switcher";
import { Figure, FigureProvider, FigureThumb, S, type FigureKind, type Pol } from "./note-figures.prototype";
import "./note-layout.prototype.css";

const VARIANTS = [
  { key: "E", name: "Pages, scroll like a PDF" },
  { key: "A", name: "Article, figures follow the text" },
];

/* ---------- MathML, hand-set (the build-time maths renderer stands in later) ---------- */

const mi = (s: string) => `<mi>${s}</mi>`;
const mo = (s: string) => `<mo>${s}</mo>`;
const mn = (s: string) => `<mn>${s}</mn>`;
const row = (...xs: string[]) => `<mrow>${xs.join("")}</mrow>`;
const sub = (b: string, s: string) => `<msub>${b}${s}</msub>`;
const sup = (b: string, s: string) => `<msup>${b}${s}</msup>`;
const frac = (a: string, b: string) => `<mfrac>${a}${b}</mfrac>`;
const hat = (s: string) => `<mover>${mi(s)}<mo>^</mo></mover>`;
const Ex = sub(mi("E"), mi("x"));
const Ey = sub(mi("E"), mi("y"));
const fn = (name: string, arg: string) => row(mi(name), mo("&#x2061;"), `<mspace width="0.17em"/>`, arg);
const cos = (arg: string) => fn("cos", arg);
const sin = (arg: string) => fn("sin", arg);
const paren = (...xs: string[]) => row(mo("("), ...xs, mo(")"));
const tau = mi("τ");
const phi = mi("φ");
const theta = mi("θ");
const eiphi = sup(mi("e"), row(mi("i"), phi));
const block = (...xs: string[]) => `<math display="block">${row(...xs)}</math>`;
const inline = (...xs: string[]) => `<math>${row(...xs)}</math>`;
const col = (a: string, b: string) =>
  row(`<mo stretchy="true" symmetric="true">(</mo>`, `<mtable><mtr><mtd>${a}</mtd></mtr><mtr><mtd>${b}</mtd></mtr></mtable>`, `<mo stretchy="true" symmetric="true">)</mo>`);

const EQ = {
  field: block(
    mi("𝐄"), paren(mi("z"), mo(","), mi("t")), mo("="), mi("Re"),
    row(mo("["), paren(Ex, hat("x"), mo("+"), Ey, eiphi, hat("y")), sup(mi("e"), row(mi("i"), paren(mi("k"), mi("z"), mo("−"), mi("ω"), mi("t")))), mo("]")),
  ),
  parts: block(mi("x"), mo("="), Ex, cos(tau), mo(","), `<mspace width="1.2em"/>`, mi("y"), mo("="), Ey, cos(paren(tau, mo("+"), phi)), mo(","), `<mspace width="1.2em"/>`, tau, mo("="), mi("k"), mi("z"), mo("−"), mi("ω"), mi("t")),
  a: block(frac(mi("x"), Ex), mo("="), cos(tau)),
  b: block(frac(mi("y"), Ey), mo("="), cos(tau), cos(phi), mo("−"), sin(tau), sin(phi)),
  c: block(frac(mi("y"), Ey), mo("−"), frac(mi("x"), Ex), cos(phi), mo("="), mo("−"), sin(tau), sin(phi)),
  d: block(sup(mi("sin"), mn("2")), tau, mo("="), mn("1"), mo("−"), frac(sup(mi("x"), mn("2")), sup(Ex, mn("2")))),
  ellipse: block(
    frac(sup(mi("x"), mn("2")), sup(Ex, mn("2"))), mo("+"), frac(sup(mi("y"), mn("2")), sup(Ey, mn("2"))), mo("−"),
    mn("2"), frac(row(mi("x"), mi("y")), row(Ex, Ey)), cos(phi), mo("="), sup(mi("sin"), mn("2")), phi,
  ),
  jones: block(mi("𝐉"), mo("="), col(cos(theta), row(eiphi, sin(theta)))),
  malus: block(
    frac(row(mi("I"), paren(mi("α"))), sub(mi("I"), mn("0"))), mo("="),
    sup(row(mo("|"), cos(mi("α")), cos(theta), mo("+"), eiphi, sin(mi("α")), sin(theta), mo("|")), mn("2")),
  ),
  malusLinear: block(frac(mi("I"), sub(mi("I"), mn("0"))), mo("="), sup(mi("cos"), mn("2")), paren(mi("α"), mo("−"), theta)),
  plate: block(col(cos(theta), row(eiphi, sin(theta))), mo("→"), col(cos(theta), row(sup(mi("e"), row(mi("i"), paren(phi, mo("+"), mi("Γ")))), sin(theta)))),
  qwp: block(frac(mn("1"), `<msqrt>${mn("2")}</msqrt>`), col(mn("1"), mn("1")), mo("→"), frac(mn("1"), `<msqrt>${mn("2")}</msqrt>`), col(mn("1"), mi("i"))),
};

function Eq({ m }: { m: string }) {
  return <div className="nl-eq" dangerouslySetInnerHTML={{ __html: m }} />;
}
function M({ m }: { m: string }) {
  return <span dangerouslySetInnerHTML={{ __html: m }} />;
}

/* ---------- the sample note: one source, both layouts render it ---------- */

type Page = {
  id: string;
  heading: string;
  figure: FigureKind;
  start: Pol;
  caption?: ReactNode;
  body: ReactNode;
};

const TITLE = "Polarization of light";
const LEAD =
  "Light is a transverse wave: its electric field swings at right angles to the way it travels. Polarization is the shape the field traces as it goes by.";

const PAGES: Page[] = [
  {
    id: "transverse",
    heading: "A transverse wave",
    figure: "wave",
    start: { theta: 0, phi: 0 },
    caption: "The blue curve is the tip of the field along the beam; the plane at the end shows the shape it traces there.",
    body: (
      <>
        <p>
          Take a plane wave running along <M m={inline(mi("z"))} />. Its field has no{" "}
          <M m={inline(mi("z"))} /> part; it lives in the <M m={inline(mi("x"), mi("y"))} /> plane, and that leaves
          it two directions to choose from.
        </p>
        <p>
          If it swings only along <M m={inline(mi("x"))} />, the light is{" "}
          <S to={{ theta: 0, phi: 0 }}>horizontally polarized</S>. Only along <M m={inline(mi("y"))} />, it is{" "}
          <S to={{ theta: 90, phi: 0 }}>vertical</S>. Both at once, in step, and the field swings on a{" "}
          <S to={{ theta: 45, phi: 0 }}>diagonal</S>.
        </p>
        <p>
          The interesting cases come when the two parts are <em>not</em> in step. Then the tip of the field no
          longer swings along a line: it goes round, as in{" "}
          <S to={{ theta: 45, phi: 90 }}>circular polarization</S>.
        </p>
      </>
    ),
  },
  {
    id: "ellipse",
    heading: "The polarization ellipse",
    figure: "wave",
    start: { theta: 30, phi: 60 },
    caption: "Drag the figure sideways to turn it.",
    body: (
      <>
        <p>Write the field as two components with a phase φ between them:</p>
        <Eq m={EQ.field} />
        <p>At a fixed point the tip of the field is at</p>
        <Eq m={EQ.parts} />
        <p>
          To find the shape it traces, eliminate the time. The first component gives <M m={inline(cos(tau))} />{" "}
          directly:
        </p>
        <Eq m={EQ.a} />
        <p>Expand the second with the angle-sum formula:</p>
        <Eq m={EQ.b} />
        <p>Substitute the first into the second and move it to the left:</p>
        <Eq m={EQ.c} />
        <p>Square both sides, and replace the sine using the first equation again:</p>
        <Eq m={EQ.d} />
        <p>Collecting terms leaves the equation of an ellipse:</p>
        <Eq m={EQ.ellipse} />
        <p>
          Two limits are worth checking. With <S to={{ theta: 30, phi: 0 }}>φ = 0</S> the right side vanishes and
          the ellipse collapses to a line: linear polarization, at an angle set by the ratio of the amplitudes.
          With equal amplitudes and <S to={{ theta: 45, phi: 90 }}>φ = 90°</S> the cross term vanishes and it
          becomes a circle. Everything between is <S to={{ theta: 30, phi: 60 }}>elliptical</S>.
        </p>
      </>
    ),
  },
  {
    id: "jones",
    heading: "Jones vectors",
    figure: "wave",
    start: { theta: 45, phi: 0 },
    body: (
      <>
        <p>
          The overall size and phase of the wave don&apos;t change its shape, so divide them out. What is left is
          a unit vector of two complex numbers, the <strong>Jones vector</strong>:
        </p>
        <Eq m={EQ.jones} />
        <p>
          θ sets how the amplitude is shared between <M m={inline(mi("x"))} /> and <M m={inline(mi("y"))} />, and
          φ the phase between them. The states you meet most often:
        </p>
        <ul className="nl-states">
          <li>
            <S to={{ theta: 0, phi: 0 }}>H</S> (1, 0) and <S to={{ theta: 90, phi: 0 }}>V</S> (0, 1)
          </li>
          <li>
            <S to={{ theta: 45, phi: 0 }}>D</S> (1, 1)/√2 and <S to={{ theta: 45, phi: 180 }}>A</S> (1, −1)/√2
          </li>
          <li>
            <S to={{ theta: 45, phi: 90 }}>L</S> (1, i)/√2 and <S to={{ theta: 45, phi: -90 }}>R</S> (1, −i)/√2
          </li>
        </ul>
        <p>
          Left and right are named as seen looking back toward the source: L turns anticlockwise. Every pair is
          orthogonal, and each makes a basis for all the others.
        </p>
      </>
    ),
  },
  {
    id: "polarizer",
    heading: "Through a polarizer",
    figure: "malus",
    start: { theta: 0, phi: 0 },
    caption: "Transmission through a linear polarizer, as it is turned through half a circle.",
    body: (
      <>
        <p>
          A linear polarizer at angle α passes the component of the field along its axis. The fraction of the
          intensity that gets through is
        </p>
        <Eq m={EQ.malus} />
        <p>For linear light (φ = 0) this is Malus&apos;s law:</p>
        <Eq m={EQ.malusLinear} />
        <p>
          <S to={{ theta: 0, phi: 0 }}>Horizontal</S> light is blocked at 90°;{" "}
          <S to={{ theta: 45, phi: 0 }}>diagonal</S> light at 135°. Turn on a phase and the dip fills in:{" "}
          <S to={{ theta: 45, phi: 90 }}>circular</S> light passes half its intensity at every angle, so a
          polarizer alone cannot tell circular light from unpolarized light.
        </p>
      </>
    ),
  },
  {
    id: "waveplate",
    heading: "A quarter-wave plate",
    figure: "wave",
    start: { theta: 45, phi: 0 },
    caption: "Slide φ to play the plate's retardance.",
    body: (
      <>
        <p>
          A wave plate slows one component behind the other, adding a retardance Γ to the phase between them:
        </p>
        <Eq m={EQ.plate} />
        <p>
          A quarter-wave plate adds Γ = 90°. Send in <S to={{ theta: 45, phi: 0 }}>diagonal light</S>, with the
          plate&apos;s axes along <M m={inline(mi("x"))} /> and <M m={inline(mi("y"))} />, and it comes out{" "}
          <S to={{ theta: 45, phi: 90 }}>circular</S>:
        </p>
        <Eq m={EQ.qwp} />
        <p>
          Partway, at <S to={{ theta: 45, phi: 45 }}>Γ = 45°</S>, the line has opened into an ellipse. A
          half-wave plate (Γ = 180°) carries it on round to{" "}
          <S to={{ theta: 45, phi: 180 }}>antidiagonal</S>: it mirrors a linear state about the plate&apos;s axis.
        </p>
      </>
    ),
  },
];

/* ---------- each figure keeps its own state; prose and controls set it ---------- */

function usePageFigure(page: Page, mark?: (el: HTMLElement, p: Pol) => () => void) {
  const [pol, setPolState] = useState<Pol>(page.start);
  const [following, setFollowing] = useState(true);
  const setPol = useCallback((p: Pol, from: "text" | "reader") => {
    setPolState(p);
    if (from === "reader") setFollowing(false);
  }, []);
  return { pol, setPol, following, setFollowing, setPolState, mark };
}

/* =====================================================================
   E: pages. Scrolls continuously like a PDF, or one page at a time.
   ===================================================================== */

function Sheet({
  page,
  n,
  total,
  hiddenUntilFound,
  register,
}: {
  page: Page;
  n: number;
  total: number;
  hiddenUntilFound: boolean;
  register: (n: number, el: HTMLElement | null) => void;
}) {
  const fig = usePageFigure(page);
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // React types don't take hidden="until-found" yet; set it by hand
    const el = ref.current;
    if (!el) return;
    if (hiddenUntilFound) el.setAttribute("hidden", "until-found");
    else el.removeAttribute("hidden");
  }, [hiddenUntilFound]);
  return (
    <section
      id={`p${n}`}
      data-page={n}
      className="nb-sheet"
      ref={(el) => {
        ref.current = el;
        register(n, el);
      }}
      aria-label={`Page ${n}: ${page.heading}`}
    >
      <header className="nb-running">
        <span>{TITLE}</span>
        <span>
          §{n} {page.heading}
        </span>
      </header>
      <FigureProvider value={{ pol: fig.pol, setPol: fig.setPol }}>
        <div className="nb-spread">
          <div className="nb-text nl-prose">
            <h2>
              <span className="nb-secno">{n}</span>
              {page.heading}
            </h2>
            {page.body}
          </div>
          <div className="nb-figcol">
            <Figure kind={page.figure} caption={page.caption} />
          </div>
        </div>
      </FigureProvider>
      <footer className="nb-folio">
        {n} / {total}
      </footer>
    </section>
  );
}

function TitleSheet({ register, hiddenUntilFound, onGo }: { register: (n: number, el: HTMLElement | null) => void; hiddenUntilFound: boolean; onGo: (n: number) => void }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (hiddenUntilFound) el.setAttribute("hidden", "until-found");
    else el.removeAttribute("hidden");
  }, [hiddenUntilFound]);
  return (
    <section
      id="p0"
      data-page={0}
      className="nb-sheet nb-sheet--title"
      ref={(el) => {
        ref.current = el;
        register(0, el);
      }}
      aria-label="Title page"
    >
      <p className="nb-kicker">Notes · Classical optics</p>
      <h1 className="toolTitle">{TITLE}</h1>
      <p className="lead nb-lead">{LEAD}</p>
      <ol className="nb-contents">
        {PAGES.map((p, i) => (
          <li key={p.id}>
            <a
              href={`#p${i + 1}`}
              onClick={(e) => {
                e.preventDefault();
                onGo(i + 1);
              }}
            >
              <span>{p.heading}</span>
              <span className="nb-dots" />
              <span>{i + 1}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Overview({
  open,
  onClose,
  onGo,
  current,
  corpus,
}: {
  open: boolean;
  onClose: () => void;
  onGo: (n: number) => void;
  current: number;
  corpus: string[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  const q = query.trim().toLowerCase();
  const hits = PAGES.map((p, i) => {
    const text = corpus[i + 1] ?? "";
    if (!q) return { count: 0, snippet: "" };
    const lower = text.toLowerCase();
    let count = 0;
    for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, at + q.length)) count++;
    const at = lower.indexOf(q);
    const snippet = at === -1 ? "" : "…" + text.slice(Math.max(0, at - 40), at + q.length + 50).trim() + "…";
    return { count, snippet };
  });
  return (
    <dialog ref={dialog} className="nb-overview" onClose={onClose} aria-label="Pages">
      <div className="nb-overview__head">
        <input
          type="search"
          placeholder="Find in this note"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Find in this note"
        />
        <button type="button" className="nb-sign" onClick={onClose}>
          Close
        </button>
      </div>
      <ol className="nb-overview__grid">
        {PAGES.map((p, i) => {
          const n = i + 1;
          const h = hits[i];
          const dim = q && h.count === 0;
          return (
            <li key={p.id} className={`${dim ? "is-dim" : ""} ${n === current ? "is-current" : ""}`}>
              <button
                type="button"
                onClick={() => {
                  onGo(n);
                  onClose();
                }}
              >
                <FigureThumb kind={p.figure} pol={p.start} />
                <span className="nb-overview__title">
                  <span className="nb-secno">{n}</span>
                  {p.heading}
                </span>
                {q ? (
                  <span className="nb-overview__snippet">
                    {h.count ? `${h.count} match${h.count > 1 ? "es" : ""}: ${h.snippet}` : "no match"}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </dialog>
  );
}

function Pages() {
  const total = PAGES.length;
  const [mode, setMode] = useState<"scroll" | "page">("scroll");
  const [current, setCurrent] = useState(0);
  const [overview, setOverview] = useState(false);
  const [corpus, setCorpus] = useState<string[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const sheets = useRef<(HTMLElement | null)[]>([]);
  const register = useCallback((n: number, el: HTMLElement | null) => {
    sheets.current[n] = el;
  }, []);
  const reduce = useRef(false);

  // where am I: the sheet across the reading line
  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hash = /^#p(\d+)$/.exec(window.location.hash);
    if (!hash) return;
    const id = requestAnimationFrame(() => setCurrent(Math.min(total, Number(hash[1]))));
    return () => cancelAnimationFrame(id);
  }, [total]);

  useEffect(() => {
    if (mode !== "scroll") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.page));
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    sheets.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [mode]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.hash = current ? `p${current}` : "";
    window.history.replaceState(window.history.state, "", url);
  }, [current]);

  // find-in-page reaches a hidden page: turn to it
  useEffect(() => {
    const onMatch = (e: Event) => setCurrent(Number((e.target as HTMLElement).dataset.page));
    const els = sheets.current.filter(Boolean) as HTMLElement[];
    els.forEach((el) => el.addEventListener("beforematch", onMatch));
    return () => els.forEach((el) => el.removeEventListener("beforematch", onMatch));
  }, []);

  const go = useCallback(
    (n: number) => {
      const to = Math.max(0, Math.min(total, n));
      setCurrent(to);
      const el = sheets.current[to];
      if (mode === "scroll") el?.scrollIntoView({ behavior: reduce.current ? "auto" : "smooth", block: "start" });
      else document.querySelector(".nb")?.scrollIntoView({ block: "start" });
    },
    [mode, total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || overview) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      const paging = mode === "page" && (e.key === "PageDown" || e.key === "PageUp");
      if (e.key === "ArrowRight" || (paging && e.key === "PageDown")) go(current + 1);
      else if (e.key === "ArrowLeft" || (paging && e.key === "PageUp")) go(current - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, go, mode, overview]);

  const switchMode = (m: "scroll" | "page") => {
    setMode(m);
    if (m === "scroll") requestAnimationFrame(() => sheets.current[current]?.scrollIntoView({ block: "start" }));
  };

  const label = current === 0 ? "Title" : `${current}`;

  return (
    <div className={`nb nb--${mode}`}>
      <div className="nb-bar" role="toolbar" aria-label="Pages">
        <button type="button" className="nb-sign" onClick={() => {
            // prose only: not the figures' controls
            setCorpus(sheets.current.map((el) => el?.querySelector(".nb-text")?.textContent ?? ""));
            setOverview(true);
          }}>
          Pages
        </button>
        <span className="nb-pager">
          <button type="button" className="nb-sign" onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous page">
            ‹
          </button>
          <input
            className="nb-pageinput"
            inputMode="numeric"
            aria-label="Page"
            value={draft ?? label}
            onFocus={(e) => {
              setDraft(current ? String(current) : "0");
              requestAnimationFrame(() => e.target.select());
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => setDraft(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = Number(draft);
                if (Number.isFinite(n)) go(n);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          <span className="nb-of">/ {total}</span>
          <button type="button" className="nb-sign" onClick={() => go(current + 1)} disabled={current === total} aria-label="Next page">
            ›
          </button>
        </span>
        <span className="nb-modes" role="group" aria-label="View">
          <button type="button" className="nb-sign" aria-pressed={mode === "scroll"} onClick={() => switchMode("scroll")}>
            Scroll
          </button>
          <button type="button" className="nb-sign" aria-pressed={mode === "page"} onClick={() => switchMode("page")}>
            Page
          </button>
        </span>
      </div>

      <div className="nb-sheets">
        <TitleSheet register={register} hiddenUntilFound={mode === "page" && current !== 0} onGo={go} />
        {PAGES.map((p, i) => (
          <Sheet
            key={p.id}
            page={p}
            n={i + 1}
            total={total}
            register={register}
            hiddenUntilFound={mode === "page" && current !== i + 1}
          />
        ))}
      </div>

      <Overview open={overview} onClose={() => setOverview(false)} onGo={go} current={current} corpus={corpus} />
    </div>
  );
}

/* =====================================================================
   A: an article. Each section's figure follows the state the text is at.
   ===================================================================== */

function Section({ page, n }: { page: Page; n: number }) {
  const markers = useRef(new Map<HTMLElement, Pol>());
  const [io, setIo] = useState<IntersectionObserver | null>(null);
  const followRef = useRef(true);
  const setFromText = useRef<(p: Pol) => void>(() => {});

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 960px)");
    const obs = new IntersectionObserver(
      (entries) => {
        if (!wide.matches || !followRef.current) return;
        for (const e of entries) {
          const p = markers.current.get(e.target as HTMLElement);
          if (e.isIntersecting && p) setFromText.current(p);
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    markers.current.forEach((_, el) => obs.observe(el));
    setIo(obs);
    return () => obs.disconnect();
  }, []);

  const mark = useCallback(
    (el: HTMLElement, p: Pol) => {
      markers.current.set(el, p);
      io?.observe(el);
      return () => {
        markers.current.delete(el);
        io?.unobserve(el);
      };
    },
    [io],
  );

  const fig = usePageFigure(page, mark);
  const { following, setPolState } = fig;
  useEffect(() => {
    followRef.current = following;
    setFromText.current = setPolState;
  }, [following, setPolState]);

  const ctx = useMemo(() => ({ pol: fig.pol, setPol: fig.setPol, mark }), [fig.pol, fig.setPol, mark]);

  return (
    <section className="ar-section" id={page.id}>
      <FigureProvider value={ctx}>
        <div className="ar-text nl-prose">
          <h2>
            <span className="nb-secno">{n}</span>
            {page.heading}
          </h2>
          {page.body}
        </div>
        <div className="ar-figcol">
          <Figure
            kind={page.figure}
            caption={page.caption}
            extra={
              fig.following ? null : (
                <button type="button" className="nf-follow" onClick={() => fig.setFollowing(true)}>
                  Follow the text
                </button>
              )
            }
          />
        </div>
      </FigureProvider>
    </section>
  );
}

function Article() {
  return (
    <article className="ar">
      <header className="ar-head">
        <p className="nb-kicker">Notes · Classical optics</p>
        <h1 className="toolTitle">{TITLE}</h1>
        <p className="lead">{LEAD}</p>
      </header>
      {PAGES.map((p, i) => (
        <Section key={p.id} page={p} n={i + 1} />
      ))}
    </article>
  );
}

export function NoteLayoutPrototype() {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));
  if (!variant) return null;
  return (
    <>
      {variant === "E" && <Pages />}
      {variant === "A" && <Article />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </>
  );
}
