"use client";
// PROTOTYPE (#395), throwaway: lives on branch prototype/traced-beam-display only, never main.
// Question: how should Beams look on the table and in the Beams box when light is traced?
// Variants on /builder/tabletop, switched by ?variant= (now | A | B | B2 | C), plus
// ?scenario= (saved | unsaved | handdrawn) to fake the cases the starter Setup lacks.
// Alt+← / Alt+→ cycle variants (plain arrows already nudge Components).
import { Html, Line } from "@react-three/drei";
import { Fragment, useEffect, useMemo, useState, useSyncExternalStore, type ComponentType } from "react";
import { Color, Vector3 } from "three";
import { traceGuideGeometry } from "@/components/builder/trace-guide";
import {
  scenarioBeams, traceRoutes, undrawnRuns,
  type Route, type Scenario,
} from "@/components/builder/prototype-traced-routes";
import type { TraceResult } from "@/components/builder/trace-scene";
import { measureBeam } from "@/components/builder/beam-measurement";
import {
  BEAM_WIDTH_MM, DEFAULT_LIGHT_COLOR, beamDisplayName, componentDisplayName, lengthToPicoseconds,
  type Beam, type BuilderComponent, type Vec3,
} from "@/components/builder/types";

export type Variant = "now" | "A" | "B" | "B2" | "C";
const VARIANTS: { key: Variant; name: string }[] = [
  { key: "now", name: "Today (fades)" },
  { key: "A", name: "Coloured light + light tree" },
  { key: "B", name: "Saved Beams + status" },
  { key: "B2", name: "Saved Beams + fades for unsaved light" },
  { key: "C", name: "Physical light + checks inline" },
];
const SCENARIOS: { key: Scenario; name: string }[] = [
  { key: "saved", name: "All saved" },
  { key: "unsaved", name: "One branch unsaved" },
  { key: "handdrawn", name: "One Beam hand-drawn" },
];
const UNSAVED_COLOR = "#ff9d5c";

// ---------- URL state ----------
const EVENT = "prototype-traced-display";
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(EVENT, callback);
  };
}
const readSearch = () => window.location.search;
export function usePrototype(): { variant: Variant; scenario: Scenario } {
  const search = useSyncExternalStore(subscribe, readSearch, () => "");
  const params = new URLSearchParams(search);
  const variant = VARIANTS.find((v) => v.key === params.get("variant"))?.key ?? "now";
  const scenario = SCENARIOS.find((s) => s.key === params.get("scenario"))?.key ?? "saved";
  return { variant, scenario };
}
function setParam(name: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(EVENT));
}

// ---------- shared route focus (Beams box hover/select ↔ table) ----------
let focus: { selected: string | null; hovered: string | null } = { selected: null, hovered: null };
const focusListeners = new Set<() => void>();
function setFocus(next: Partial<typeof focus>) {
  focus = { ...focus, ...next };
  focusListeners.forEach((listener) => listener());
}
function useFocus() {
  return useSyncExternalStore(
    (callback) => {
      focusListeners.add(callback);
      return () => focusListeners.delete(callback);
    },
    () => focus,
    () => focus,
  );
}

function useRoutes(trace: TraceResult | null, beams: Beam[], scenario: Scenario) {
  return useMemo(() => {
    if (!trace) return { routes: [] as Route[], beams };
    const shown = scenarioBeams(trace, beams, scenario);
    return { routes: traceRoutes(trace, shown), beams: shown };
  }, [trace, beams, scenario]);
}

const lifted = (points: Vec3[]) => points.map(([x, y, z]) => new Vector3(x, y + 2, z));

// ---------- table ----------
type BeamPathLike = ComponentType<{
  points: Vector3[]; color: string; width?: number; opacity?: number; selected?: boolean; core?: boolean; ghost?: boolean;
}>;
type BeamHitLike = ComponentType<{
  beamId: string; points: Vector3[]; width: number; onClick: (ids: string[], clientX: number, clientY: number) => void;
}>;

export function PrototypeTableLight({
  trace, beams, selectedBeamId, BeamPath, BeamHit, onBeamClick, interactive,
}: {
  trace: TraceResult;
  beams: Beam[];
  selectedBeamId: string | null;
  BeamPath: BeamPathLike;
  BeamHit: BeamHitLike;
  onBeamClick: (ids: string[], clientX: number, clientY: number) => void;
  interactive: boolean;
}) {
  const { variant, scenario } = usePrototype();
  const { selected, hovered } = useFocus();
  const { routes } = useRoutes(trace, beams, scenario);
  const runs = useMemo(() => undrawnRuns(routes), [routes]);
  const focused = (route: Route) =>
    (hovered === UNSAVED_ALL && !route.saved) || route.key === selected || route.key === hovered || (route.saved !== undefined && route.saved.id === selectedBeamId);

  const hit = (route: Route, points: Vector3[]) => interactive && route.saved
    ? <BeamHit beamId={route.saved.id} points={points} width={route.saved.width ?? BEAM_WIDTH_MM} onClick={onBeamClick} />
    : null;

  if (variant === "A") {
    // every route drawn in full; saved light in its Beam's colour, unsaved light as an orange glow
    return <>{runs.map(({ route, points }, index) => {
      if (route.saved?.hidden) return null;
      const vectors = lifted(points);
      const on = focused(route);
      return (
        <Fragment key={`${route.key}-${index}`}>
          {route.saved ? (
            <BeamPath points={vectors} color={route.saved.color} width={route.saved.width} opacity={route.saved.opacity}
              core={route.saved.arrows !== false} selected={on} />
          ) : (
            <BeamPath points={vectors} color={UNSAVED_COLOR} opacity={on ? 1 : 0.85} core={on} selected={on} />
          )}
          {hit(route, vectors)}
        </Fragment>
      );
    })}</>;
  }

  if (variant === "B") {
    // saved Beams are the drawing; unsaved light is a thin dashed construction line
    return <>{runs.map(({ route, points }, index) => {
      if (route.saved?.hidden) return null;
      const vectors = lifted(points);
      const on = focused(route);
      if (route.saved) {
        return (
          <Fragment key={`${route.key}-${index}`}>
            <BeamPath points={vectors} color={route.saved.color} width={route.saved.width} opacity={route.saved.opacity}
              core={route.saved.arrows !== false} selected={on} />
            {hit(route, vectors)}
          </Fragment>
        );
      }
      return on
        ? <BeamPath key={`${route.key}-${index}`} points={vectors} color={UNSAVED_COLOR} selected />
        : <Line key={`${route.key}-${index}`} points={vectors} color="#9a8f86" lineWidth={1.2} dashed dashSize={6} gapSize={5}
            transparent opacity={0.85} depthWrite={false} />;
    })}</>;
  }

  if (variant === "B2") {
    // saved Beams are the drawing; unsaved light keeps today's short fades until its row is hovered or picked
    const savedSegments = new Set(routes.filter((route) => route.saved).flatMap((route) => route.segments));
    const faded = routes.filter((route) => !route.saved && !focused(route));
    const fadeTrace: TraceResult = {
      trees: [{ laserId: "", segments: [...new Set(faded.flatMap((route) => route.segments))].filter((s) => !savedSegments.has(s)) }],
      checks: [], matchedDrawnBeamIds: [],
    };
    return <>
      <Fades trace={fadeTrace} />
      {runs.map(({ route, points }, index) => {
        if (route.saved?.hidden) return null;
        const vectors = lifted(points);
        const on = focused(route);
        if (route.saved) return (
          <Fragment key={`${route.key}-${index}`}>
            <BeamPath points={vectors} color={route.saved.color} width={route.saved.width} opacity={route.saved.opacity}
              core={route.saved.arrows !== false} selected={on} />
            {hit(route, vectors)}
          </Fragment>
        );
        return on ? <BeamPath key={`${route.key}-${index}`} points={vectors} color={UNSAVED_COLOR} opacity={0.9} core={false} selected /> : null;
      })}
    </>;
  }

  if (variant === "C") {
    // physical light: one light colour, brightness and width follow power; author colours only on focus
    return <>{runs.map(({ route, points, power }, index) => {
      if (route.saved?.hidden) return null;
      const vectors = lifted(points);
      const on = focused(route);
      const mid = vectors[Math.floor((vectors.length - 1) / 2)].clone().lerp(vectors[Math.ceil((vectors.length - 1) / 2)], 0.5);
      return (
        <Fragment key={`${route.key}-${index}`}>
          <BeamPath points={vectors} color={on ? route.saved?.color ?? UNSAVED_COLOR : DEFAULT_LIGHT_COLOR}
            width={BEAM_WIDTH_MM * (0.5 + power)} opacity={on ? 1 : 0.25 + 0.6 * power} core selected={on} />
          {hit(route, vectors)}
          {power < 1 ? (
            <Html position={[mid.x, mid.y + 12, mid.z]} center style={{ pointerEvents: "none" }}>
              <span className="protoPowerTag">{Math.round(power * 100)} %</span>
            </Html>
          ) : null}
        </Fragment>
      );
    })}</>;
  }
  return null;
}

const UNSAVED_ALL = "unsaved:all";

function Fades({ trace }: { trace: TraceResult }) {
  const guide = useMemo(() => {
    const data = traceGuideGeometry(trace, []);
    const orange = new Color(UNSAVED_COLOR);
    const points: [number, number, number][] = [];
    const colors: [number, number, number, number][] = [];
    for (let at = 0; at < data.opacity.length; at++) {
      points.push([data.positions[at * 3], data.positions[at * 3 + 1], data.positions[at * 3 + 2]]);
      colors.push([orange.r, orange.g, orange.b, data.opacity[at]]);
    }
    return { points, colors };
  }, [trace]);
  if (guide.points.length === 0) return null;
  return <Line segments points={guide.points} vertexColors={guide.colors} lineWidth={2.5} depthTest={false} depthWrite={false} renderOrder={3} />;
}

// ---------- Beams box ----------
type BoxProps = {
  components: BuilderComponent[];
  beams: Beam[];
  trace: TraceResult | null;
  selectedBeamId: string | null;
  onSelectBeam: (id: string) => void;
  onSetHidden: (id: string, hidden: boolean) => void;
  onSelectComponent: (id: string) => void;
};

export function PrototypeBeamsBox(props: BoxProps) {
  const { variant, scenario } = usePrototype();
  const { routes, beams } = useRoutes(props.trace, props.beams, scenario);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 2400);
    return () => window.clearTimeout(timer);
  }, [note]);
  if (!props.trace) return null;
  const ctx = { ...props, beams, routes, trace: props.trace, stub: setNote };
  return (
    <section className="builderIsland protoBox" aria-label="Beams (prototype)">
      {variant === "A" ? <BoxA {...ctx} /> : variant === "B" || variant === "B2" ? <BoxB {...ctx} /> : <BoxC {...ctx} />}
      {note ? <p className="protoNote">{note}</p> : null}
    </section>
  );
}

type Ctx = Omit<BoxProps, "trace"> & { routes: Route[]; trace: TraceResult; stub: (note: string) => void };

const nameOf = (components: BuilderComponent[], id: string | null) => {
  const component = id ? components.find((c) => c.id === id) : undefined;
  return component ? componentDisplayName(component) : "open table";
};
const handDrawn = (ctx: Ctx) => ctx.beams.filter((beam) => !ctx.trace.matchedDrawnBeamIds.includes(beam.id));
const checkFor = (ctx: Ctx, beam: Beam) =>
  ctx.trace.checks.find((check) => check.message.startsWith(`${beam.label || beam.id}:`));

function RouteRow({ ctx, route, children }: { ctx: Ctx; route: Route; children: React.ReactNode }) {
  const { selected } = useFocus();
  const on = route.key === selected || (route.saved !== undefined && route.saved.id === ctx.selectedBeamId);
  return (
    <li
      className={`protoRow${on ? " is-on" : ""}${route.saved?.hidden ? " is-hidden" : ""}`}
      style={{ paddingLeft: `${0.4 + route.depth * 0.9}rem` }}
      onMouseEnter={() => setFocus({ hovered: route.key })}
      onMouseLeave={() => setFocus({ hovered: null })}
    >
      <button type="button" className="protoRow__main" onClick={() => {
        setFocus({ selected: route.key });
        if (route.saved) ctx.onSelectBeam(route.saved.id);
      }}>
        {children}
      </button>
      {route.saved ? (
        <button type="button" className="protoMini" onClick={() => ctx.onSetHidden(route.saved!.id, !route.saved!.hidden)}>
          {route.saved.hidden ? "show" : "hide"}
        </button>
      ) : (
        <button type="button" className="protoMini is-accent" onClick={() => ctx.stub("Prototype: would save this light as a Beam, with a name and colour.")}>
          save
        </button>
      )}
    </li>
  );
}

function Checks({ ctx, compact }: { ctx: Ctx; compact?: boolean }) {
  const list = ctx.trace.checks.map((check) => (
    <button type="button" key={`${check.kind}-${check.componentId}-${check.message}`} className="protoCheck"
      onClick={() => ctx.onSelectComponent(check.componentId)}>⚠ {check.message}</button>
  ));
  if (compact) {
    return ctx.trace.checks.length ? (
      <details className="protoChecks"><summary>⚠ {ctx.trace.checks.length} check{ctx.trace.checks.length === 1 ? "" : "s"}</summary>{list}</details>
    ) : <p className="protoMuted">✓ Light reaches every stop</p>;
  }
  return (
    <div className="protoChecks">
      <h4>Checks</h4>
      {list.length ? list : <p className="protoMuted">No checks</p>}
    </div>
  );
}

function HandDrawn({ ctx, title }: { ctx: Ctx; title: string }) {
  const drawn = handDrawn(ctx);
  if (!drawn.length) return null;
  return (
    <div className="protoSection">
      <h4>{title}</h4>
      <ul>
        {drawn.map((beam) => (
          <li key={beam.id} className={`protoRow${beam.id === ctx.selectedBeamId ? " is-on" : ""}`}>
            <button type="button" className="protoRow__main" onClick={() => ctx.onSelectBeam(beam.id)}>
              <span className="protoDot is-dashed" style={{ borderColor: beam.color }} />
              <span className="protoName">{beamDisplayName(beam)}</span>
              <span className="protoSub">{checkFor(ctx, beam)?.message.split(": ")[1] ?? "not on traced light"}</span>
              <span className="protoLen">{Math.round(measureBeam(ctx.components, beam).lengthMm)} mm</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A: the trace is the list. One row per route of light, in tree order; saved names ride on it. */
function BoxA(ctx: Ctx) {
  const lasers = [...new Set(ctx.routes.map((route) => route.laserId))];
  return (
    <>
      <h3 className="protoTitle">Light</h3>
      {lasers.map((laserId) => (
        <div key={laserId} className="protoSection">
          <h4>{nameOf(ctx.components, laserId)}</h4>
          <ul>
            {ctx.routes.filter((route) => route.laserId === laserId).map((route) => (
              <RouteRow key={route.key} ctx={ctx} route={route}>
                {route.depth ? <span className="protoSub">↳ {nameOf(ctx.components, route.splitAtId)}</span> : null}
                <span className={`protoDot${route.saved ? "" : " is-hollow"}`}
                  style={route.saved ? { background: route.saved.color } : { borderColor: UNSAVED_COLOR }} />
                <span className="protoName">
                  {route.saved ? beamDisplayName(route.saved) : <em>unnamed → {nameOf(ctx.components, route.endId)}</em>}
                </span>
                <span className="protoLen">{Math.round(route.lengthMm)} mm</span>
              </RouteRow>
            ))}
          </ul>
        </div>
      ))}
      <HandDrawn ctx={ctx} title="Hand-drawn, not on traced light" />
      <Checks ctx={ctx} />
    </>
  );
}

/** B: the saved Beams stay the list, in the author's order, each with whether light follows it. */
function BoxB(ctx: Ctx) {
  const unsaved = ctx.routes.filter((route) => !route.saved);
  return (
    <>
      <h3 className="protoTitle">Beams</h3>
      <ul>
        {ctx.beams.map((beam) => {
          const matched = ctx.trace.matchedDrawnBeamIds.includes(beam.id);
          const route = ctx.routes.find((r) => r.saved?.id === beam.id);
          return (
            <li key={beam.id} className={`protoRow${beam.id === ctx.selectedBeamId ? " is-on" : ""}${beam.hidden ? " is-hidden" : ""}`}
              style={{ paddingLeft: beam.parentId ? "1.3rem" : "0.4rem" }}>
              <button type="button" className="protoRow__main" onClick={() => ctx.onSelectBeam(beam.id)}>
                <span className="protoDot" style={{ background: beam.color }} />
                <span className="protoName">{beam.parentId ? "↳ " : ""}{beamDisplayName(beam)}</span>
                <span className={`protoPill${matched ? " is-ok" : " is-warn"}`}>{matched ? "traced" : "hand-drawn"}</span>
                <span className="protoLen">{Math.round(route?.lengthMm ?? measureBeam(ctx.components, beam).lengthMm)} mm</span>
              </button>
              <button type="button" className="protoMini" onClick={() => ctx.onSetHidden(beam.id, !beam.hidden)}>{beam.hidden ? "show" : "hide"}</button>
            </li>
          );
        })}
      </ul>
      {unsaved.length ? (
        <details className="protoSection" open>
          <summary onMouseEnter={() => setFocus({ hovered: UNSAVED_ALL })} onMouseLeave={() => setFocus({ hovered: null })}>
            {unsaved.length} branch{unsaved.length === 1 ? "" : "es"} of light not saved as a Beam</summary>
          <ul>
            {unsaved.map((route) => (
              <RouteRow key={route.key} ctx={ctx} route={{ ...route, depth: 0 }}>
                <span className="protoDot is-hollow" style={{ borderColor: UNSAVED_COLOR }} />
                <span className="protoName">→ {nameOf(ctx.components, route.endId)}</span>
                <span className="protoLen">{Math.round(route.lengthMm)} mm</span>
              </RouteRow>
            ))}
          </ul>
        </details>
      ) : null}
      <Checks ctx={ctx} compact />
    </>
  );
}

/** C: a light inspector. Routes by where they end, with power, time of flight, and the checks that sit on them. */
function BoxC(ctx: Ctx) {
  const placed = new Set<string>();
  const lasers = [...new Set(ctx.routes.map((route) => route.laserId))];
  const checksOn = (route: Route) => ctx.trace.checks.filter((check) => {
    const on = route.path.includes(check.componentId) && !placed.has(check.message);
    if (on) placed.add(check.message);
    return on;
  });
  const sections = lasers.map((laserId) => (
    <div key={laserId} className="protoSection">
      <h4>{nameOf(ctx.components, laserId)} · light</h4>
      <ul>
        {ctx.routes.filter((route) => route.laserId === laserId).map((route) => {
          const checks = checksOn(route);
          return (
            <Fragment key={route.key}>
              <RouteRow ctx={ctx} route={{ ...route, depth: 0 }}>
                <span className="protoStack">
                  <span className="protoName">→ {nameOf(ctx.components, route.endId)}</span>
                  <span className="protoSub">
                    {route.saved ? <><span className="protoDot" style={{ background: route.saved.color }} /> {beamDisplayName(route.saved)}</> : <em>not saved</em>}
                    {route.splitAtId && route.depth ? ` · via ${nameOf(ctx.components, route.splitAtId)}` : ""}
                  </span>
                </span>
                <span className="protoStack is-right">
                  <span className="protoLen">{Math.round(route.lengthMm)} mm · {Math.round(lengthToPicoseconds(route.lengthMm))} ps</span>
                  <span className="protoPower"><span style={{ width: `${route.power * 100}%` }} /><b>{Math.round(route.power * 100)} %</b></span>
                </span>
              </RouteRow>
              {checks.map((check) => (
                <li key={check.message}><button type="button" className="protoCheck is-inline" onClick={() => ctx.onSelectComponent(check.componentId)}>⚠ {check.message}</button></li>
              ))}
            </Fragment>
          );
        })}
      </ul>
    </div>
  ));
  const rest = ctx.trace.checks.filter((check) => !placed.has(check.message));
  return (
    <>
      <h3 className="protoTitle">Light</h3>
      {sections}
      <HandDrawn ctx={ctx} title="Drawn by hand" />
      {rest.length ? (
        <div className="protoChecks"><h4>Elsewhere</h4>{rest.map((check) => (
          <button type="button" key={check.message} className="protoCheck" onClick={() => ctx.onSelectComponent(check.componentId)}>⚠ {check.message}</button>
        ))}</div>
      ) : null}
    </>
  );
}

// ---------- switcher ----------
export function PrototypeSwitcher() {
  const { variant, scenario } = usePrototype();
  const at = VARIANTS.findIndex((v) => v.key === variant);
  const go = (step: number) => setParam("variant", VARIANTS[(at + step + VARIANTS.length) % VARIANTS.length].key);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      event.stopPropagation();
      go(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="protoSwitcher" role="toolbar" aria-label="Prototype variants">
      <button type="button" onClick={() => go(-1)} aria-label="Previous variant">←</button>
      <span><b>{variant}</b> {VARIANTS[at].name}</span>
      <button type="button" onClick={() => go(1)} aria-label="Next variant">→</button>
      <select value={scenario} onChange={(event) => setParam("scenario", event.target.value)} aria-label="Scenario">
        {SCENARIOS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
      </select>
      <style>{PROTO_CSS}</style>
    </div>
  );
}

const PROTO_CSS = `
.protoSwitcher{position:fixed;left:50%;bottom:calc(1rem + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:1000;display:flex;align-items:center;gap:.5rem;padding:.35rem .5rem;border-radius:999px;background:#111;color:#fff;font:500 .8rem/1 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.protoSwitcher button{border:0;border-radius:999px;background:#333;color:#fff;width:1.8rem;height:1.8rem;cursor:pointer}
.protoSwitcher b{color:#ffcf5c;margin-right:.3rem}
.protoSwitcher select{background:#222;color:#fff;border:1px solid #444;border-radius:999px;padding:.25rem .5rem;font:inherit}
.protoBox{display:block!important;padding:.45rem .5rem .55rem;width:min(21rem,calc(100vw - 2rem));max-height:min(26rem,55vh);overflow-y:auto;font-size:.8rem}
.protoBox ul{list-style:none;margin:0;padding:0}
.protoTitle{margin:.1rem .3rem .35rem;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;opacity:.7}
.protoSection{margin-top:.35rem}
.protoSection h4,.protoChecks h4{margin:.4rem .35rem .2rem;font-size:.72rem;font-weight:600;opacity:.75}
.protoSection summary,.protoChecks summary{cursor:pointer;margin:.45rem .35rem .2rem;font-size:.75rem;opacity:.85}
.protoRow{display:flex;align-items:center;border:1px solid transparent;border-radius:var(--builder-radius,4px)}
.protoRow:hover{background:var(--builder-hover)}
.protoRow.is-on{border-color:var(--focus-ring);color:var(--accent-strong)}
.protoRow.is-hidden .protoRow__main{opacity:.45}
.protoRow__main{flex:1;display:flex;align-items:center;gap:.45rem;min-width:0;min-height:1.9rem;padding:.15rem .3rem;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.protoDot{flex:none;width:.6rem;height:.6rem;border-radius:999px;display:inline-block}
.protoDot.is-hollow{border:2px dotted;background:transparent}
.protoDot.is-dashed{border:2px dashed;background:transparent}
.protoName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.protoSub{font-size:.7rem;opacity:.65;white-space:nowrap}
.protoLen{font-variant-numeric:tabular-nums;opacity:.75;white-space:nowrap}
.protoStack{display:flex;flex-direction:column;gap:.15rem;min-width:0;flex:1}
.protoStack.is-right{flex:none;align-items:flex-end}
.protoPill{font-size:.65rem;padding:.1rem .4rem;border-radius:999px;border:1px solid}
.protoPill.is-ok{color:#2f8a4c;border-color:#2f8a4c66}
.protoPill.is-warn{color:#b8730b;border-color:#b8730b88;background:#b8730b14}
.protoMini{flex:none;border:1px solid var(--builder-hairline);border-radius:999px;background:none;color:inherit;font-size:.68rem;padding:.12rem .45rem;margin-right:.2rem;cursor:pointer}
.protoMini.is-accent{border-color:${UNSAVED_COLOR};color:#c46a2c}
.protoChecks{margin-top:.4rem;border-top:1px solid var(--builder-hairline);padding-top:.2rem}
.protoCheck{display:block;width:100%;text-align:left;border:0;background:none;color:#b8730b;font:inherit;font-size:.75rem;padding:.2rem .35rem;cursor:pointer;border-radius:4px}
.protoCheck:hover{background:var(--builder-hover)}
.protoCheck.is-inline{padding-left:1.1rem}
.protoMuted{margin:.25rem .35rem;opacity:.6;font-size:.75rem}
.protoPower{position:relative;display:inline-block;width:4.2rem;height:.75rem;border-radius:999px;background:var(--builder-hover);overflow:hidden}
.protoPower span{position:absolute;inset:0 auto 0 0;background:${DEFAULT_LIGHT_COLOR}88}
.protoPower b{position:relative;display:block;text-align:center;font-size:.6rem;line-height:.75rem;font-weight:600}
.protoPowerTag{font:600 10px/1 system-ui,sans-serif;padding:2px 5px;border-radius:999px;background:#fff;color:#c2410c;border:1px solid #fdba74;white-space:nowrap}
.protoNote{margin:.4rem .35rem 0;padding:.35rem .5rem;border-radius:6px;background:#111;color:#fff;font-size:.72rem}
`;
