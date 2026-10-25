"use client";

// PROTOTYPE (#301): the polarization wave in 3D, kept light. Not for main.
// Lines only (no meshes, lights or shadows), an orthographic camera, and the
// frame loop runs only while the figure is on screen. With reduced motion the
// wave stands still and a frame is drawn only when the state changes.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { BufferGeometry, LineSegments, OrthographicCamera } from "three";
import type { Line2 } from "three-stdlib";

import { WAVE, VIEW, cameraBasis, wavePoints, type Pol } from "./note-figures.prototype";

type Palette = { ink: string; muted: string; accent: string };

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  return {
    ink: css.getPropertyValue("--foreground").trim() || "#111",
    muted: css.getPropertyValue("--muted").trim() || "#666",
    accent: css.getPropertyValue("--focus-ring").trim() || "#1a5fb4",
  };
}

function usePalette() {
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    const read = () => setPalette(readPalette());
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return palette;
}

const flat = (pts: [number, number, number][]) => pts.flat();

function Scene({
  pol,
  azimuth,
  still,
  palette,
}: {
  pol: Pol;
  azimuth: RefObject<number>;
  still: boolean;
  palette: Palette;
}) {
  const curve = useRef<Line2>(null);
  const ellipse = useRef<Line2>(null);
  const tip = useRef<Line2>(null);
  const stems = useRef<LineSegments>(null);
  const shown = useRef<Pol>({ ...pol });
  const time = useRef(0);
  const lastAz = useRef(NaN);
  const invalidate = useThree((s) => s.invalidate);

  const first = useMemo(() => wavePoints(pol, 0), []); // eslint-disable-line react-hooks/exhaustive-deps
  const stemBuffer = useMemo(() => new Float32Array(WAVE.stems * 6), []);

  useEffect(() => {
    if (still) invalidate();
  }, [pol, still, invalidate]);

  useFrame((state, dt) => {
    const { camera, size } = state;
    // ease toward the target state; jump straight there when motion is reduced
    const k = still ? 1 : 1 - Math.exp(-dt * 6);
    shown.current.theta += (pol.theta - shown.current.theta) * k;
    shown.current.phi += (pol.phi - shown.current.phi) * k;
    if (!still) time.current += dt * Math.PI; // one period per 2 s

    const { curve: c, ellipse: e, tip: t } = wavePoints(shown.current, time.current);
    curve.current?.geometry.setPositions(flat(c));
    ellipse.current?.geometry.setPositions(flat(e));
    tip.current?.geometry.setPositions(flat([[WAVE.plane, 0, 0], t]));

    const every = WAVE.samples / (WAVE.stems - 1);
    for (let i = 0; i < WAVE.stems; i++) {
      const p = c[Math.round(i * every)];
      stemBuffer.set([p[0], 0, 0, p[0], p[1], p[2]], i * 6);
    }
    const g = stems.current?.geometry as BufferGeometry | undefined;
    if (g) g.attributes.position.needsUpdate = true;

    if (azimuth.current !== lastAz.current) {
      lastAz.current = azimuth.current;
      const { pos } = cameraBasis(azimuth.current, VIEW.elevation);
      camera.position.set(pos[0] * 20, pos[1] * 20, pos[2] * 20);
      camera.lookAt(0, 0, 0);
      if (still) invalidate();
    }
    const cam = camera as OrthographicCamera;
    const zoom = Math.min(size.width / 8.6, size.height / 4);
    if (cam.zoom !== zoom) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }
  });

  return (
    <>
      <Line points={[[-WAVE.half - 0.5, 0, 0], [WAVE.plane + 0.6, 0, 0]]} color={palette.muted} lineWidth={1} />
      <lineSegments ref={stems}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stemBuffer, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={palette.muted} transparent opacity={0.55} />
      </lineSegments>
      <Line ref={ellipse} points={first.ellipse} color={palette.ink} lineWidth={1.25} transparent opacity={0.45} />
      <Line ref={curve} points={first.curve} color={palette.accent} lineWidth={2.5} />
      <Line ref={tip} points={[[WAVE.plane, 0, 0], first.tip]} color={palette.ink} lineWidth={2.5} />
    </>
  );
}

export default function Wave3D({
  pol,
  running,
  azimuth,
}: {
  pol: Pol;
  running: boolean;
  azimuth: RefObject<number>;
}) {
  const palette = usePalette();
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  if (!palette) return null;
  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      frameloop={!running ? "never" : still ? "demand" : "always"}
      camera={{ position: [10, 6, 15], near: 0.1, far: 100, zoom: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ touchAction: "pan-y" }}
    >
      <Scene pol={pol} azimuth={azimuth} still={still} palette={palette} />
    </Canvas>
  );
}
