"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";

/** px between a label's edge and its beam's glow, on screen */
const GAP_PX = 4;
/** how far a beam's glow reaches from its axis, × its radius (the selected halo's width) */
const GLOW_REACH = 4;
/** px a leg must have to spare beyond its label's width before the label shows */
const ROOM_PX = 16;

type DistancesProps = { points: Vector3[]; lengths: number[]; color: string; width: number; faded?: boolean };

type Leg = { from: Vector3; to: Vector3; middle: Vector3; text: string };

/**
 * The distance along each leg of a beam, like a smart dimension: a number in
 * the beam's colour, no box, haloed in the background so it reads over parts
 * and shadows alike. It sits at
 * the leg's middle, turned on screen to run along it (never upside down) and
 * set off to one side, clear of the beam's glow at any zoom, so it doesn't
 * read as part of the beam. A leg too short on
 * screen to hold its label goes without.
 *
 * The labels are turned each frame from the camera, through refs, not React
 * state, so orbiting the view doesn't re-render them. They are not
 * `builderLabel`s, so PNG export leaves them out.
 */
export const BeamDistances = memo(function BeamDistances({
  points,
  lengths,
  color,
  width,
  faded = false,
}: {
  /** the beam's reference points */
  points: Vector3[];
  /** each leg's length, mm (beamLegLengthsMm), one fewer than the points */
  lengths: number[];
  /** the beam's colour, which the numbers take */
  color: string;
  /** the beam's width, mm, which sets how far its glow reaches */
  width: number;
  /** a hidden beam's ghost: the numbers fade with it */
  faded?: boolean;
}) {
  const legs = useMemo(() => {
    const result: Leg[] = [];
    for (let index = 1; index < points.length; index += 1) {
      const [from, to] = [points[index - 1], points[index]];
      // a stop met twice in a row has no leg to label
      if (from.distanceTo(to) < 1e-6) continue;
      const middle = new Vector3().addVectors(from, to).multiplyScalar(0.5);
      result.push({ from, to, middle, text: `${Math.round(lengths[index - 1] ?? 0)} mm` });
    }
    return result;
  }, [points, lengths]);

  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const scratch = useMemo(() => [new Vector3(), new Vector3()], []);
  // the canvas draws on demand: ask for a frame so new labels get placed
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => invalidate(), [legs, invalidate]);

  useFrame(() => {
    legs.forEach((leg, index) => {
      const label = labels.current[index];
      if (!label) return;
      const [a, b] = scratch;
      a.copy(leg.from).project(camera);
      b.copy(leg.to).project(camera);
      const dx = ((b.x - a.x) / 2) * size.width;
      const dy = (-(b.y - a.y) / 2) * size.height;
      const behind = a.z > 1 || b.z > 1;
      if (behind || Math.hypot(dx, dy) < label.offsetWidth + ROOM_PX) {
        label.style.visibility = "hidden";
        return;
      }
      let angle = Math.atan2(dy, dx);
      // keep the text upright: a leg pointing left reads from its other end
      if (angle > Math.PI / 2) angle -= Math.PI;
      else if (angle < -Math.PI / 2) angle += Math.PI;
      // the side above the text, which after the flip is always the same side
      // an orthographic camera draws a millimetre as `zoom` pixels
      const offset = (width / 2) * GLOW_REACH * camera.zoom + label.offsetHeight / 2 + GAP_PX;
      const offX = Math.sin(angle) * offset;
      const offY = -Math.cos(angle) * offset;
      label.style.transform = `translate(${offX}px, ${offY}px) rotate(${angle}rad)`;
      label.style.visibility = "visible";
    });
  });

  return (
    <>
      {legs.map((leg, index) => (
        <Html
          key={index}
          position={leg.middle}
          center
          zIndexRange={[0, 0]}
          className="builderHtmlLayer"
        >
          <span
            ref={(element) => {
              labels.current[index] = element;
            }}
            className={faded ? "builderDistance is-faded" : "builderDistance"}
            style={{ visibility: "hidden", color }}
          >
            {leg.text}
          </span>
        </Html>
      ))}
    </>
  );
}, sameDistances);

/** The points are rebuilt on every render, so they and the lengths are compared by value. */
function sameDistances(before: DistancesProps, after: DistancesProps): boolean {
  const [a, b] = [before.points, after.points];
  return (
    before.color === after.color &&
    before.width === after.width &&
    before.faded === after.faded &&
    a.length === b.length &&
    a.every((point, index) => point.equals(b[index])) &&
    before.lengths.length === after.lengths.length &&
    before.lengths.every((length, index) => length === after.lengths[index])
  );
}
