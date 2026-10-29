"use client";

import { useId, useState } from "react";

import { formatSignificant } from "@/components/calculators/format-quantity";
import { DISTANCE_UNITS, unitLabel, type DistanceUnit } from "@/components/calculators/linked-pair";

/** A beam: its waist radius and Rayleigh range, in metres. */
type Beam = { waist: number; rayleigh: number };

/** What the plot shows: ±z along the beam and ±r across it, in metres. */
type View = { z: number; r: number };

/** A view that frames `beam`: ±3 Rayleigh ranges, and the beam's width there with room to spare. */
export function fitView(beam: Beam): View {
  return { z: 3 * beam.rayleigh, r: 1.2 * Math.sqrt(10) * beam.waist };
}

const WIDTH = 520;
const HEIGHT = 290;
const PLOT = { left: 56, right: 508, top: 14, bottom: 246 };

// The cross-section is square, at the side view's r scale, so a spot the side
// view shows 100 µm wide is 100 µm wide here too.
const SECTION = { left: 44, top: PLOT.top, size: PLOT.bottom - PLOT.top };
const SECTION_WIDTH = SECTION.left + SECTION.size + 12;

// 113 columns of exactly 4 units, drawn with crisp edges, so no seam shows between them.
const COLUMNS = 113;
const COLUMN_WIDTH = (PLOT.right - PLOT.left) / COLUMNS;
// Each column's gradient spans ±3w(z) of its own beam radius, so a narrow beam
// is sampled as finely as a wide one.
const STOPS = 17;
const CURVE_POINTS = 240;

/** A tick every 1, 2 or 5 × 10ⁿ, about six across the span. */
function ticks(half: number): number[] {
  const raw = (2 * half) / 6;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  const step = (normalised < 1.5 ? 1 : normalised < 3.5 ? 2 : normalised < 7.5 ? 5 : 10) * magnitude;
  const first = Math.ceil(-half / step);
  return Array.from({ length: Math.floor(half / step) - first + 1 }, (_, index) => (first + index) * step);
}

const tickLabel = (value: number) => (Math.abs(value) < 1e-12 ? "0" : String(Number(value.toPrecision(4))));

/**
 * The beam's side view in a fixed window: intensity shaded along z (across)
 * and r (up), the beam radius ±w(z), the far-field cone ±θz it tends to, and
 * ±z_R marked. The window holds still while the beam is edited, so a longer
 * Rayleigh range or a wider waist shows as the beam stretching or swelling;
 * "Fit to beam" frames the current beam again.
 */
export function GaussianBeamProfile({
  beam,
  rangeUnit,
  waistUnit,
}: {
  beam: Beam | null;
  rangeUnit: DistanceUnit;
  waistUnit: DistanceUnit;
}) {
  const id = useId().replace(/:/g, "");
  const [view, setView] = useState<View>(() => fitView(beam ?? { waist: 100e-6, rayleigh: 30e-3 }));
  // Where the cross-section is cut, in metres from the waist; kept inside the window.
  const [sliceAt, setSliceAt] = useState(0);
  const slice = Math.min(view.z, Math.max(-view.z, sliceAt));

  const x = (z: number) => PLOT.left + ((z + view.z) / (2 * view.z)) * (PLOT.right - PLOT.left);
  const y = (r: number) => PLOT.top + ((view.r - r) / (2 * view.r)) * (PLOT.bottom - PLOT.top);
  const radius = (z: number) => (beam ? beam.waist * Math.sqrt(1 + (z / beam.rayleigh) ** 2) : 0);

  const sliceRadius = radius(slice);
  const slicePeak = beam ? (beam.waist / sliceRadius) ** 2 : 0;
  // cross-section coordinates: centre of the square, and px per metre (same as the side view's r)
  const sectionCentre = { x: SECTION.left + SECTION.size / 2, y: SECTION.top + SECTION.size / 2 };
  const sectionScale = SECTION.size / (2 * view.r);

  const columns = beam
    ? Array.from({ length: COLUMNS }, (_, index) => {
        const z = -view.z + ((index + 0.5) / COLUMNS) * 2 * view.z;
        const w = radius(z);
        const peak = (beam.waist / w) ** 2;
        const stops = Array.from({ length: STOPS }, (_, step) => {
          const offset = step / (STOPS - 1);
          const r = 3 * w * (1 - 2 * offset);
          return { offset, opacity: peak * Math.exp((-2 * r * r) / (w * w)) };
        });
        return { x: PLOT.left + index * COLUMN_WIDTH, top: y(3 * w), bottom: y(-3 * w), stops };
      })
    : [];

  const curve = (sign: 1 | -1, at: (z: number) => number) =>
    Array.from({ length: CURVE_POINTS + 1 }, (_, index) => {
      const z = -view.z + (index / CURVE_POINTS) * 2 * view.z;
      return `${index === 0 ? "M" : "L"}${x(z).toFixed(1)} ${y(sign * at(z)).toFixed(1)}`;
    }).join("");
  const divergence = beam ? beam.waist / beam.rayleigh : 0;
  const cone = (z: number) => divergence * Math.abs(z);

  const zScale = DISTANCE_UNITS[rangeUnit];
  const rScale = DISTANCE_UNITS[waistUnit];
  const zTicks = ticks(view.z / zScale);
  const rTicks = ticks(view.r / rScale);
  const rayleighShown = beam !== null && beam.rayleigh < view.z;
  // the ±z_R names need room beside their lines, or they print over each other
  const rayleighNamed = rayleighShown && x(beam.rayleigh) - x(0) > 24;

  return (
    <figure className="beamProfile">
      <div className="beamProfile__bar">
        <label className="beamProfile__sliceControl">
          <span>
            Cross-section at z ={" "}
            <strong>
              {tickLabel(slice / zScale)} {unitLabel(rangeUnit)}
            </strong>
            {beam ? (
              <>
                {" "}· w(z) ={" "}
                <strong>
                  {formatSignificant(sliceRadius / rScale, 3)} {unitLabel(waistUnit)}
                </strong>
              </>
            ) : null}
          </span>
          <input
            type="range"
            min={-view.z}
            max={view.z}
            step={view.z / 150}
            value={slice}
            onChange={(event) => setSliceAt(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          className="buttonLink beamProfile__fit"
          disabled={beam === null}
          onClick={() => beam && setView(fitView(beam))}
        >
          Fit to beam
        </button>
      </div>
      <div className="beamProfile__views">
      <svg
        className="beamProfile__side"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          beam
            ? `Gaussian beam profile: waist ${formatSignificant(beam.waist / rScale, 3)} ${unitLabel(waistUnit)}, Rayleigh range ${formatSignificant(beam.rayleigh / zScale, 3)} ${unitLabel(rangeUnit)}`
            : "Gaussian beam profile: no beam"
        }
      >
        <defs>
          <clipPath id={`${id}-plot`}>
            <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} />
          </clipPath>
          {columns.map((column, index) => (
            <linearGradient
              key={index}
              id={`${id}-column-${index}`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={column.top}
              y2={column.bottom}
            >
              {column.stops.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} stopOpacity={stop.opacity.toFixed(3)} />
              ))}
            </linearGradient>
          ))}
        </defs>

        <g className="beamProfile__grid">
          {rTicks.map((tick) => (
            <line key={`r${tick}`} x1={PLOT.left} x2={PLOT.right} y1={y(tick * rScale)} y2={y(tick * rScale)} />
          ))}
          {zTicks.map((tick) => (
            <line key={`z${tick}`} x1={x(tick * zScale)} x2={x(tick * zScale)} y1={PLOT.top} y2={PLOT.bottom} />
          ))}
        </g>

        <g clipPath={`url(#${id}-plot)`}>
          <g className="beamProfile__intensity" shapeRendering="crispEdges">
            {columns.map((column, index) => (
              <rect
                key={index}
                x={column.x}
                y={PLOT.top}
                width={COLUMN_WIDTH}
                height={PLOT.bottom - PLOT.top}
                fill={`url(#${id}-column-${index})`}
              />
            ))}
          </g>
          {beam ? (
            <>
              <path className="beamProfile__cone" d={`${curve(1, cone)}${curve(-1, cone)}`} />
              <path className="beamProfile__envelope" d={`${curve(1, radius)}${curve(-1, radius)}`} />
              <line className="beamProfile__slice" x1={x(slice)} x2={x(slice)} y1={PLOT.top} y2={PLOT.bottom} />
            </>
          ) : null}
          {rayleighShown
            ? [-1, 1].map((sign) => (
                <g key={sign}>
                  <line
                    className="beamProfile__rayleigh"
                    x1={x(sign * beam.rayleigh)}
                    x2={x(sign * beam.rayleigh)}
                    y1={PLOT.top}
                    y2={PLOT.bottom}
                  />
                  {rayleighNamed ? (
                    <text
                      className="beamProfile__note"
                      x={x(sign * beam.rayleigh) + sign * 4}
                      y={PLOT.top + 12}
                      textAnchor={sign > 0 ? "start" : "end"}
                    >
                      {sign > 0 ? "" : "−"}z<tspan baselineShift="sub" fontSize="9">R</tspan>
                    </text>
                  ) : null}
                </g>
              ))
            : null}
        </g>

        <g className="beamProfile__axis">
          <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} />
          {zTicks.map((tick) => (
            <text key={`z${tick}`} x={x(tick * zScale)} y={PLOT.bottom + 16} textAnchor="middle">
              {tickLabel(tick)}
            </text>
          ))}
          {rTicks.map((tick) => (
            <text key={`r${tick}`} x={PLOT.left - 6} y={y(tick * rScale) + 4} textAnchor="end">
              {tickLabel(tick)}
            </text>
          ))}
          <text x={(PLOT.left + PLOT.right) / 2} y={HEIGHT - 4} textAnchor="middle">
            z ({unitLabel(rangeUnit)})
          </text>
          <text
            x={12}
            y={(PLOT.top + PLOT.bottom) / 2}
            textAnchor="middle"
            transform={`rotate(-90 12 ${(PLOT.top + PLOT.bottom) / 2})`}
          >
            r ({unitLabel(waistUnit)})
          </text>
        </g>
      </svg>
      <svg
        className="beamProfile__section"
        viewBox={`0 0 ${SECTION_WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          beam
            ? `Cross-section at z = ${tickLabel(slice / zScale)} ${unitLabel(rangeUnit)}: beam radius ${formatSignificant(sliceRadius / rScale, 3)} ${unitLabel(waistUnit)}`
            : "Cross-section: no beam"
        }
      >
        <defs>
          <clipPath id={`${id}-section`}>
            <rect x={SECTION.left} y={SECTION.top} width={SECTION.size} height={SECTION.size} />
          </clipPath>
          {beam ? (
            <radialGradient
              id={`${id}-spot`}
              gradientUnits="userSpaceOnUse"
              cx={sectionCentre.x}
              cy={sectionCentre.y}
              r={3 * sliceRadius * sectionScale}
            >
              {Array.from({ length: STOPS }, (_, step) => {
                const offset = step / (STOPS - 1);
                const r = 3 * offset;
                return <stop key={offset} offset={offset} stopOpacity={(slicePeak * Math.exp(-2 * r * r)).toFixed(3)} />;
              })}
            </radialGradient>
          ) : null}
        </defs>

        <g className="beamProfile__grid">
          {rTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={SECTION.left}
                x2={SECTION.left + SECTION.size}
                y1={sectionCentre.y - tick * rScale * sectionScale}
                y2={sectionCentre.y - tick * rScale * sectionScale}
              />
              <line
                x1={sectionCentre.x + tick * rScale * sectionScale}
                x2={sectionCentre.x + tick * rScale * sectionScale}
                y1={SECTION.top}
                y2={SECTION.top + SECTION.size}
              />
            </g>
          ))}
        </g>

        {beam ? (
          <g clipPath={`url(#${id}-section)`}>
            <rect
              x={SECTION.left}
              y={SECTION.top}
              width={SECTION.size}
              height={SECTION.size}
              fill={`url(#${id}-spot)`}
            />
            <circle
              className="beamProfile__waistRing"
              cx={sectionCentre.x}
              cy={sectionCentre.y}
              r={beam.waist * sectionScale}
            />
            <circle
              className="beamProfile__envelope"
              cx={sectionCentre.x}
              cy={sectionCentre.y}
              r={sliceRadius * sectionScale}
            />
          </g>
        ) : null}

        <g className="beamProfile__axis">
          <rect x={SECTION.left} y={SECTION.top} width={SECTION.size} height={SECTION.size} />
          {rTicks.map((tick) => (
            <g key={tick}>
              <text x={sectionCentre.x + tick * rScale * sectionScale} y={PLOT.bottom + 16} textAnchor="middle">
                {tickLabel(tick)}
              </text>
              <text x={SECTION.left - 6} y={sectionCentre.y - tick * rScale * sectionScale + 4} textAnchor="end">
                {tickLabel(tick)}
              </text>
            </g>
          ))}
          <text x={sectionCentre.x} y={HEIGHT - 4} textAnchor="middle">
            x ({unitLabel(waistUnit)})
          </text>
          <text x={10} y={sectionCentre.y} textAnchor="middle" transform={`rotate(-90 10 ${sectionCentre.y})`}>
            y ({unitLabel(waistUnit)})
          </text>
        </g>
      </svg>
      </div>
      <figcaption className="beamProfile__legend">
        <span>
          <i className="beamProfile__key beamProfile__key--intensity" aria-hidden="true" /> Intensity
        </span>
        <span>
          <i className="beamProfile__key beamProfile__key--envelope" aria-hidden="true" /> Beam radius ±w(z)
        </span>
        <span>
          <i className="beamProfile__key beamProfile__key--cone" aria-hidden="true" /> Far-field cone ±θz
        </span>
        <span>
          <i className="beamProfile__key beamProfile__key--rayleigh" aria-hidden="true" />
          <span>
            ±z<sub>R</sub>, where w = √2 w₀
          </span>
        </span>
        <span>
          <i className="beamProfile__key beamProfile__key--slice" aria-hidden="true" /> Cross-section slice
        </span>
        <span>
          <i className="beamProfile__key beamProfile__key--waist" aria-hidden="true" /> Waist w₀, for scale
        </span>
        <span className="beamProfile__aside">
          The window stays put as you edit, so the beam stretches or swells in it. In the side view z and r are on different scales; the cross-section is to scale.
        </span>
      </figcaption>
    </figure>
  );
}
