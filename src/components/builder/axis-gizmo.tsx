"use client";

import { useSyncExternalStore } from "react";
import { axisArrows, type AxisName } from "@/components/builder/axis-arrows";
import { cameraOrientation, subscribeCameraOrientation } from "@/components/builder/camera-orientation";

/** Red, green, blue is the 3D convention for X, Y, Z; each is legible on both modes' plates. */
const AXIS_COLOUR: Record<AxisName, string> = { x: "#e5484d", y: "#3fa34d", z: "#3b82f6" };
const ARM = 16;
const CENTRE = 28;
const LETTER_GAP = 7;

/**
 * Which way +X, +Y and +Z run on screen, turning with the camera. The table is
 * the XZ plane and +Y is up, so this is what tells a viewer which way a
 * Component's X and Z in the inspector are on the table.
 */
export function AxisGizmo() {
  const camera = useSyncExternalStore(subscribeCameraOrientation, cameraOrientation, cameraOrientation);
  const arrows = axisArrows(camera);
  return (
    <svg
      className="builderAxes"
      viewBox={`0 0 ${CENTRE * 2} ${CENTRE * 2}`}
      role="img"
      aria-label="Axes: X and Z run along the table, Y is up"
    >
      <title>X and Z run along the table, Y is up</title>
      {arrows.map(({ axis, dx, dy, depth }) => {
        const tipX = CENTRE + dx * ARM;
        const tipY = CENTRE + dy * ARM;
        // an arrow end-on has no length to draw: its letter sits up and left of the hub, the corner the other two arrows leave free in the top view
        const length = Math.hypot(dx, dy);
        const opacity = depth < -0.2 ? 0.55 : 1;
        return (
          <g key={axis} opacity={opacity} stroke={AXIS_COLOUR[axis]} fill={AXIS_COLOUR[axis]}>
            {length > 0.08 ? <line x1={CENTRE} y1={CENTRE} x2={tipX} y2={tipY} strokeWidth={2.4} strokeLinecap="round" /> : null}
            <circle cx={tipX} cy={tipY} r={length > 0.08 ? 2.2 : 3} stroke="none" />
            <text
              x={CENTRE + (length > 0.08 ? dx * (ARM + LETTER_GAP) : -LETTER_GAP)}
              y={CENTRE + (length > 0.08 ? dy * (ARM + LETTER_GAP) : -LETTER_GAP)}
              textAnchor="middle"
              dominantBaseline="central"
              stroke="none"
              className="builderAxes__letter"
            >
              {axis.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
