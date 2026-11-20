"use client";
// PROTOTYPE (#395), throwaway: lives on branch prototype/traced-beam-display only, never main.
// Question: how should Beams look on the table and in the Beams box when light is traced?
// Variants on /builder/tabletop, switched by ?variant= (now | A | B | B2 | C | D), plus
// for B2 and D: ?light= (colours | power) and ?bar= (line | strip | readout | off), plus
// ?scenario= (saved | unsaved | handdrawn) to fake the cases the starter Setup lacks.
// Alt+← / Alt+→ cycle variants (plain arrows already nudge Components).
import { Html, Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps, type ComponentType } from "react";
import { Color, Vector3 } from "three";
import { traceGuideGeometry } from "@/components/builder/trace-guide";
import {
  scenarioBeams, traceRoutes, undrawnRuns,
  type Route, type Scenario,
} from "@/components/builder/prototype-traced-routes";
import type { TraceResult } from "@/components/builder/trace-scene";
import { measureBeam } from "@/components/builder/beam-measurement";
import {
  BEAM_WIDTH_MM, DEFAULT_LIGHT_COLOR, beamDisplayName, componentDisplayName, lengthToPicoseconds, referencePoint,
  type Beam, type BuilderComponent, type Vec3,
} from "@/components/builder/types";

export type Variant = "now" | "A" | "B" | "B2" | "C" | "D";
export type LightView = "colours" | "power";
export type Bar = "line" | "strip" | "readout" | "off";
const BARS: { key: Bar; name: string }[] = [
  { key: "line", name: "Bar: bottom line" },
  { key: "strip", name: "Bar: under the dock" },
  { key: "readout", name: "Bar: corner readout" },
  { key: "off", name: "Bar: off" },
];
const VARIANTS: { key: Variant; name: string }[] = [
  { key: "now", name: "Today (fades)" },
  { key: "A", name: "Coloured light + light tree" },
  { key: "B", name: "Saved Beams + status" },
  { key: "B2", name: "Saved Beams + fades, Aim at…, laser colours" },
  { key: "C", name: "Physical light + checks inline" },
  { key: "D", name: "B2 table + C light panel" },
];
const SCENARIOS: { key: Scenario; name: string }[] = [
  { key: "saved", name: "All saved" },
  { key: "unsaved", name: "One branch unsaved" },
  { key: "handdrawn", name: "One Beam hand-drawn" },
];
const UNSAVED_COLOR = "#ff9d5c";
/** B2: each laser's unsaved light gets its own colour; the first keeps today's orange */
const LASER_LIGHT = ["#ff9d5c", "#22b8cf", "#d946ef", "#84cc16", "#f43f5e", "#6366f1"];
function laserColour(trace: TraceResult, laserId: string) {
  const at = Math.max(0, trace.trees.findIndex((tree) => tree.laserId === laserId));
  return LASER_LIGHT[at % LASER_LIGHT.length];
}

// ---------- B2: "Aim at…" pick on the table ----------
let aimPick: string | null = null;
const aimListeners = new Set<() => void>();
export function getAimPick() { return aimPick; }
export function setAimPick(id: string | null) {
  aimPick = id;
  aimListeners.forEach((listener) => listener());
}
function useAimPick() {
  return useSyncExternalStore(
    (callback) => {
      aimListeners.add(callback);
      return () => aimListeners.delete(callback);
    },
    () => aimPick,
    () => null,
  );
}
export function AimPickButton({ id }: { id: string }) {
  const { variant } = usePrototype();
  const picking = useAimPick();
  useEffect(() => {
    if (picking !== id) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setAimPick(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking, id]);
  // aiming is split out of the shipping design (D); B2 keeps it for the aiming issue
  if (variant !== "B2") return null;
  return picking === id
    ? <button type="button" className="protoPick is-on" onClick={() => setAimPick(null)}>Click a Component on the table… (Esc)</button>
    : <button type="button" className="protoPick" onClick={() => setAimPick(id)}>⌖ Pick on table</button>;
}

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
export function usePrototype(): { variant: Variant; scenario: Scenario; light: LightView; bar: Bar } {
  const search = useSyncExternalStore(subscribe, readSearch, () => "");
  const params = new URLSearchParams(search);
  const variant = VARIANTS.find((v) => v.key === params.get("variant"))?.key ?? "now";
  const scenario = SCENARIOS.find((s) => s.key === params.get("scenario"))?.key ?? "saved";
  const light: LightView = params.get("light") === "power" ? "power" : "colours";
  const bar = BARS.find((b) => b.key === params.get("bar"))?.key ?? "line";
  return { variant, scenario, light, bar };
}
const isLate = (variant: Variant) => variant === "B2" || variant === "D";
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

export function PrototypeTableLight(props: ComponentProps<typeof TableLightInner>) {
  const { variant } = usePrototype();
  return (
    <>
      <TableLightInner {...props} />
      {isLate(variant) ? <AimFlash trace={props.trace} components={props.components} BeamPath={props.BeamPath} /> : null}
    </>
  );
}

// ---------- D: when a part takes a new aim, its light draws itself in and fades ----------
type Flash = { key: string; legs: [Vec3, Vec3][]; color: string; startMs: number };
const GROW_MS = 400;
const HOLD_MS = 600;
const FADE_MS = 800;

function AimFlash({ trace, components, BeamPath }: { trace: TraceResult; components: BuilderComponent[]; BeamPath: BeamPathLike }) {
  const seen = useRef<Map<string, string | undefined> | null>(null);
  const pending = useRef(new Set<string>());
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const aims = new Map(components.map((part) => [part.id, part.aim]));
    const before = seen.current;
    seen.current = aims;
    if (!before) return;
    for (const part of components) if (part.aim && before.get(part.id) !== part.aim) pending.current.add(part.id);
    const found: Flash[] = [];
    const segments = trace.trees.flatMap((tree) => tree.segments.map((segment) => ({ segment, laserId: tree.laserId })));
    for (const id of [...pending.current]) {
      const part = components.find((p) => p.id === id);
      if (!part?.aim) { pending.current.delete(id); continue; }
      // the trace can lag the new aim by a frame; wait until light leaves for the target
      const out = segments.find(({ segment }) => segment.fromId === id && segment.toId === part.aim);
      if (!out) continue;
      pending.current.delete(id);
      const into = segments.find(({ segment }) => segment.toId === id);
      const legs: [Vec3, Vec3][] = [];
      if (into) legs.push([into.segment.fromMm, into.segment.toMm]);
      legs.push([out.segment.fromMm, out.segment.toMm]);
      found.push({ key: `${id}-${part.aim}-${performance.now()}`, legs, color: laserColour(trace, out.laserId), startMs: performance.now() });
    }
    // prototype: the flash is transient view state started by a scene change
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (found.length) setFlashes((current) => [...current, ...found]);
  }, [components, trace]);

  // the canvas draws on demand, so the flash runs its own clock and asks for each frame
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!flashes.length) return;
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      setNowMs(now);
      invalidate();
      const live = flashes.filter((flash) => now - flash.startMs < flash.legs.length * GROW_MS + HOLD_MS + FADE_MS);
      if (live.length !== flashes.length) setFlashes(live);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [flashes, invalidate]);

  // new meshes don't ask for a frame themselves: redraw after each committed step
  useEffect(() => {
    if (flashes.length) invalidate();
  }, [nowMs, flashes, invalidate]);

  return <>{flashes.map((flash) => {
    const age = nowMs - flash.startMs;
    const grown = flash.legs.length * GROW_MS;
    const opacity = age < grown + HOLD_MS ? 1 : Math.max(0, 1 - (age - grown - HOLD_MS) / FADE_MS);
    return flash.legs.map(([from, to], leg) => {
      const progress = Math.min(1, Math.max(0, (age - leg * GROW_MS) / GROW_MS));
      if (progress <= 0) return null;
      const end: Vec3 = [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress, from[2] + (to[2] - from[2]) * progress];
      return <BeamPath key={`${flash.key}-${leg}`} points={lifted([from, end])} color={flash.color} opacity={opacity} core selected />;
    });
  })}</>;
}

function TableLightInner({
  trace, beams, selectedBeamId, BeamPath, BeamHit, onBeamClick, interactive, components, selectedIds,
}: {
  components: BuilderComponent[];
  selectedIds: string[];
  trace: TraceResult;
  beams: Beam[];
  selectedBeamId: string | null;
  BeamPath: BeamPathLike;
  BeamHit: BeamHitLike;
  onBeamClick: (ids: string[], clientX: number, clientY: number) => void;
  interactive: boolean;
}) {
  const { variant, scenario, light } = usePrototype();
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

  if (isLate(variant) && light === "power") {
    // the physical view: each laser's light in its colour, brightness and width follow power
    return <>{runs.map(({ route, points, power }, index) => {
      if (route.saved?.hidden) return null;
      const vectors = lifted(points);
      const on = focused(route);
      const mid = vectors[Math.floor((vectors.length - 1) / 2)].clone().lerp(vectors[Math.ceil((vectors.length - 1) / 2)], 0.5);
      return (
        <Fragment key={`${route.key}-${index}`}>
          <BeamPath points={vectors} color={on ? route.saved?.color ?? laserColour(trace, route.laserId) : laserColour(trace, route.laserId)}
            width={BEAM_WIDTH_MM * (0.5 + power)} opacity={on ? 1 : 0.3 + 0.6 * power} core selected={on} />
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

  if (isLate(variant)) {
    // saved Beams are the drawing; unsaved light keeps today's short fades until its row is hovered or picked
    const savedSegments = new Set(routes.filter((route) => route.saved).flatMap((route) => route.segments));
    const faded = routes.filter((route) => !route.saved && !focused(route));
    const lasers = [...new Set(faded.map((route) => route.laserId))];
    const only = selectedIds.length === 1 ? components.find((part) => part.id === selectedIds[0]) : undefined;
    const target = only?.aim ? components.find((part) => part.id === only.aim) : undefined;
    return <>
      {lasers.map((laserId) => (
        <Fades key={laserId} color={laserColour(trace, laserId)} trace={{
          trees: [{ laserId, segments: [...new Set(faded.filter((route) => route.laserId === laserId).flatMap((route) => route.segments))].filter((s) => !savedSegments.has(s)) }],
          checks: [], matchedDrawnBeamIds: [],
        }} />
      ))}
      {variant === "B2" && only && target ? (
        <>
          <Line points={[referencePoint(only), referencePoint(target)]} color="#8a8178" lineWidth={1} dashed dashSize={4} gapSize={4}
            transparent opacity={0.7} depthWrite={false} />
          {/* a crosshair on what the part aims at */}
          <Html position={referencePoint(target)} center style={{ pointerEvents: "none" }}>
            <svg className="protoReticle" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
              <circle cx="15" cy="15" r="8" />
              <path d="M15 1v8M15 21v8M1 15h8M21 15h8" />
            </svg>
          </Html>
        </>
      ) : null}
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
        return on ? <BeamPath key={`${route.key}-${index}`} points={vectors} color={laserColour(trace, route.laserId)} opacity={0.9} core={false} selected /> : null;
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

// depth-tested and on the axis (today's guide floats 2 mm up and draws over the hardware),
// so a mount hides light behind it and the laser's light leaves its cone
function Fades({ trace, color }: { trace: TraceResult; color: string }) {
  const guide = useMemo(() => {
    const data = traceGuideGeometry(trace, []);
    const tint = new Color(color);
    const points: [number, number, number][] = [];
    const colors: [number, number, number, number][] = [];
    for (let at = 0; at < data.opacity.length; at++) {
      points.push([data.positions[at * 3], data.positions[at * 3 + 1] - 2, data.positions[at * 3 + 2]]);
      colors.push([tint.r, tint.g, tint.b, data.opacity[at]]);
    }
    return { points, colors };
  }, [trace, color]);
  if (guide.points.length === 0) return null;
  return <Line segments points={guide.points} vertexColors={guide.colors} lineWidth={2.5} transparent depthWrite={false} renderOrder={3} />;
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
                <span className="protoDot is-hollow" style={{ borderColor: laserColour(ctx.trace, route.laserId) }} />
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
                    {route.saved ? <><span className="protoDot" style={{ background: route.saved.color }} /> {beamDisplayName(route.saved)}</> : <><span className="protoDot is-hollow" style={{ borderColor: laserColour(ctx.trace, route.laserId) }} /> <em>not saved</em></>}
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

// ---------- status bar (B2, D) ----------
type ModeHint = { label: string; hints: [string, string][] } | null;

function useBarState(trace: TraceResult | null, mode: ModeHint) {
  const { scenario } = usePrototype();
  const picking = useAimPick();
  const shownMode: ModeHint = picking
    ? { label: "Aim", hints: [["Click", "a target"], ["Esc", "cancel"]] }
    : mode;
  const checks = trace?.checks.length ?? 0;
  const upgraded = scenario === "handdrawn" ? "Upgraded from v16 · 1 Beam kept hand-drawn" : null;
  return { shownMode, checks, upgraded };
}

function LightSwitch() {
  const { light } = usePrototype();
  return (
    <span className="protoSeg" role="group" aria-label="Light view">
      {(["colours", "power"] as const).map((key) => (
        <button key={key} type="button" aria-pressed={light === key} onClick={() => setParam("light", key)}>
          {key === "colours" ? "Colours" : "Power"}
        </button>
      ))}
    </span>
  );
}

function ChecksState({ trace, onSelectComponent, opens }: {
  trace: TraceResult; onSelectComponent: (id: string) => void; opens: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const checks = trace.checks.length;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!checks) return <span className="protoBarOk">✓<span className="protoWide"> Light reaches every stop</span></span>;
  return (
    <span className="protoChecksPop">
      <button type="button" className="protoBarWarn protoChecksPop__btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        ⚠ {checks}<span className="protoWide"> check{checks === 1 ? "" : "s"}</span> {open ? "▾" : "▸"}
      </button>
      {open ? (
        <span className={`protoChecksPop__list is-${opens}`} role="list">
          {trace.checks.map((check) => (
            <button type="button" role="listitem" key={`${check.kind}-${check.componentId}-${check.message}`} className="protoCheck"
              onClick={() => { onSelectComponent(check.componentId); setOpen(false); }}>⚠ {check.message}</button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** The view switch keeps the page's other settings; ?traced=0 lasts one visit, so the way back is a plain link too. */
function ViewSwitch({ traced }: { traced: boolean }) {
  const go = (event: React.MouseEvent) => {
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set("traced", traced ? "0" : "1");
    window.location.assign(url);
  };
  return traced
    ? <a className="protoLink" href="?traced=0" onClick={go}>Legacy view</a>
    : <a className="protoLink is-strong" href="?traced=1" onClick={go}>Switch to traced Beams</a>;
}

export function PrototypeStatusBar({ where, mode, status, trace, onSelectComponent }: {
  where: "top" | "bottom"; mode: ModeHint; status: string | null; trace: TraceResult | null; onSelectComponent: (id: string) => void;
}) {
  const { variant, bar } = usePrototype();
  const { shownMode, upgraded } = useBarState(trace, mode);
  useEffect(() => {
    document.body.dataset.protoBar = isLate(variant) ? bar : "";
    return () => { document.body.dataset.protoBar = ""; };
  }, [variant, bar]);
  if (!isLate(variant)) return null;
  const traced = trace !== null;

  if (bar === "line" && where === "bottom") {
    // one hairline-topped strip along the bottom edge, like an editor's: the corner HUD lifts above it
    return (
      <div className="protoLine" role="status" aria-live="polite">
        <span className="protoLine__mode">
          {shownMode ? <><i className="protoMarker" /><b>{shownMode.label}</b>{shownMode.hints.map(([k, a]) => <span key={k + a}><kbd>{k}</kbd> {a}</span>)}</> : <span className="protoMuted">Select</span>}
        </span>
        {traced ? <>
          <span className="protoLine__cell"><ChecksState trace={trace} onSelectComponent={onSelectComponent} opens="up" /></span>
          <span className="protoLine__cell"><LightSwitch /></span>
          {upgraded ? <span className="protoLine__cell protoBarWarn protoWide">{upgraded}</span> : null}
        </> : <span className="protoLine__cell protoBarWarn">Legacy view: drawn Beams, not traced</span>}
        <span className="protoLine__fill">{status}</span>
        <span className="protoLine__cell"><ViewSwitch traced={traced} /></span>
      </div>
    );
  }
  if (bar === "strip" && where === "top") {
    // no new place: the state joins the Show strip under the dock, and the mode badge stays as it is
    return (
      <p className="protoStrip">
        {traced ? <>
          <ChecksState trace={trace} onSelectComponent={onSelectComponent} opens="down" />
          <span className="protoStrip__sep" />
          <LightSwitch />
          <span className="protoStrip__sep" />
          {upgraded ? <span className="protoBarWarn protoWide">{upgraded} ·</span> : null}
        </> : <span className="protoBarWarn">Legacy view: drawn Beams ·</span>}
        <ViewSwitch traced={traced} />
      </p>
    );
  }
  if (bar === "readout" && where === "bottom") {
    // an instrument's readout above the camera: labels left, values right, tabular figures
    if (!trace) return (
      <dl className="protoReadout" role="status" aria-live="polite">
        <div className="protoReadout__mode"><dt>Mode</dt><dd>{shownMode ? <b>{shownMode.label}</b> : "Select"}</dd></div>
        <div><dt>Light</dt><dd className="protoBarWarn">Legacy view: drawn Beams</dd></div>
        <div><dt>View</dt><dd><ViewSwitch traced={false} /></dd></div>
      </dl>
    );
    const routes = trace.trees.reduce((n, tree) => n + tree.segments.filter((s) => !tree.segments.some((o) => o.fromId === s.toId && o !== s)).length, 0);
    return (
      <dl className="protoReadout" role="status" aria-live="polite">
        <div className="protoReadout__mode"><dt>Mode</dt><dd>{shownMode ? <><b>{shownMode.label}</b> {shownMode.hints.map(([k, a]) => <span key={k + a}><kbd>{k}</kbd> {a} </span>)}</> : "Select"}</dd></div>
        <div><dt>Light</dt><dd>{trace.trees.length} laser{trace.trees.length === 1 ? "" : "s"} · {routes} end{routes === 1 ? "" : "s"}</dd></div>
        <div><dt>Checks</dt><dd><ChecksState trace={trace} onSelectComponent={onSelectComponent} opens="up" /></dd></div>
        <div><dt>View</dt><dd><LightSwitch /></dd></div>
        <div><dt>File</dt><dd>{upgraded ? <span className="protoBarWarn">{upgraded}</span> : "v20 · autosaved"} · <ViewSwitch traced /></dd></div>
      </dl>
    );
  }
  return null;
}

// ---------- switcher ----------
export function PrototypeSwitcher() {
  const { variant, scenario, bar } = usePrototype();
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
      {isLate(variant) ? (
        <select value={bar} onChange={(event) => setParam("bar", event.target.value)} aria-label="Status bar">
          {BARS.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
        </select>
      ) : null}
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
.protoPick{margin:.25rem 0 .1rem;border:1px solid var(--builder-hairline);border-radius:var(--builder-radius,4px);background:none;color:inherit;font:inherit;font-size:.78rem;padding:.3rem .55rem;cursor:pointer}
.protoPick.is-on{border-color:var(--focus-ring);color:var(--accent-strong);background:var(--builder-hover)}
.protoPill,.protoMini,.protoPick,.protoPower,.protoPowerTag{border-radius:var(--builder-radius,2px)!important}
.protoSwitcher{bottom:calc(2.6rem + env(safe-area-inset-bottom,0px))}
.protoMarker{display:inline-block;width:.5rem;height:.5rem;background:var(--accent);margin-right:.1rem}
.protoBarOk{color:#2f8a4c}
.protoBarWarn{color:#b45309}
.protoLink{color:var(--accent-strong);text-decoration:underline;text-underline-offset:2px}
.protoSeg{display:inline-flex;border:1px solid var(--builder-hairline);border-radius:var(--builder-radius,2px);overflow:hidden}
.protoSeg button{border:0;background:none;color:inherit;font:inherit;font-size:.7rem;padding:.1rem .5rem;cursor:pointer}
.protoSeg button[aria-pressed="true"]{background:var(--foreground);color:var(--background)}
kbd{font:500 .62rem/1 var(--font-source-sans,system-ui);font-variant-numeric:tabular-nums;border:1px solid var(--builder-hairline);border-radius:2px;padding:.08rem .25rem;margin-right:.15rem}
.protoLine{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;align-items:center;gap:0;height:1.7rem;padding:0 .9rem env(safe-area-inset-bottom,0px);background:var(--surface-strong);border-top:1px solid var(--builder-hairline);font-size:.72rem;font-weight:500;font-variant-numeric:tabular-nums;color:var(--foreground)}
.protoLine>span,.protoLine>a{display:inline-flex;align-items:center;gap:.4rem;padding:0 .75rem;height:100%;border-left:1px solid var(--builder-hairline)}
.protoLine__mode{border-left:0!important;padding-left:0!important;min-width:14rem}
.protoLine__mode b{font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:.7rem}
.protoLine__fill{flex:1;justify-content:flex-end;color:var(--muted,inherit);border-left:0!important}
body[data-proto-bar="line"] .builderHud__viewRow,body[data-proto-bar="line"] .builderRail{bottom:calc(0.9rem + 1.7rem)}
body[data-proto-bar="line"] .builderHud__lists{bottom:calc(var(--builder-rail-clear) + 1.7rem)}
body[data-proto-bar="line"] .builderPanels.is-on{bottom:1.7rem}
body[data-proto-bar="line"] .builderPanels.is-on .builderHud__lists{bottom:var(--builder-rail-clear)}
.protoLink.is-strong{font-weight:700}
.protoLine>span,.protoLine>a{white-space:nowrap}
body[data-proto-bar="line"] .builderStatus,body[data-proto-bar="line"] .builderModeBadge{display:none}
body[data-proto-bar="readout"] .builderStatus{bottom:12.5rem}
.protoStrip{display:flex;align-items:center;justify-content:center;gap:.6rem;margin:.35rem auto 0;font-size:.72rem;font-weight:500;font-variant-numeric:tabular-nums;color:var(--foreground);width:max-content;max-width:calc(100vw - 2rem);flex-wrap:wrap}
.protoStrip__sep{width:1px;height:.9rem;background:var(--builder-hairline)}
.protoReadout{position:fixed;right:.9rem;bottom:3.9rem;z-index:40;margin:0;min-width:15rem;padding:.45rem .6rem;background:var(--surface-strong);border:1px solid var(--builder-hairline);border-radius:var(--builder-radius,2px);font-size:.72rem;font-weight:500;font-variant-numeric:tabular-nums}
.protoReadout>div{display:grid;grid-template-columns:3.6rem 1fr;align-items:center;gap:.5rem;padding:.12rem 0}
.protoReadout>div+div{border-top:1px solid color-mix(in srgb,var(--foreground) 8%,transparent)}
.protoReadout dt{font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
.protoReadout dd{margin:0}
.protoReadout b{font-weight:700;letter-spacing:.12em;text-transform:uppercase}
@media (max-width:640px){.protoLine__mode,.protoReadout__mode,.protoWide{display:none!important}.protoLine{padding-inline:.3rem}.protoLine>span,.protoLine>a{padding:0 .5rem}.protoLine>span:first-of-type+span{border-left:0}.protoReadout{left:.9rem;right:.9rem;min-width:0}.protoSwitcher span{display:none}.protoSwitcher{bottom:calc(2.6rem + env(safe-area-inset-bottom,0px))}.protoSwitcher select{max-width:7.5rem}}
.protoReticle{display:block;fill:none;stroke:var(--accent-strong);stroke-width:1.5}
.protoReticle circle{stroke-dasharray:none}
.protoChecksPop{position:relative;display:inline-flex}
.protoChecksPop__btn{border:0;background:none;font:inherit;padding:0;cursor:pointer}
.protoChecksPop__list{position:absolute;left:-.5rem;z-index:60;display:flex;flex-direction:column;min-width:17rem;max-height:14rem;overflow-y:auto;padding:.25rem;background:var(--surface-strong);border:1px solid var(--builder-hairline);border-radius:var(--builder-radius,2px)}
.protoChecksPop__list.is-up{bottom:calc(100% + .45rem)}
.protoChecksPop__list.is-down{top:calc(100% + .45rem)}
.protoReadout .protoChecksPop__list{left:auto;right:-.6rem}
.protoNote{margin:.4rem .35rem 0;padding:.35rem .5rem;border-radius:6px;background:#111;color:#fff;font-size:.72rem}
`;
