import { formatSignificant } from "@/components/calculators/format-quantity";

// A Gaussian beam is the same shape at every size: in units of the Rayleigh
// range along z and of the waist across it, the intensity, the beam radius and
// the far-field cone never change. So the picture is drawn once, in those
// units, and only the axis numbers follow the beam.

/** How far the plot reaches: ±Z_SPAN Rayleigh ranges, ±R_SPAN waists. */
const Z_SPAN = 3;
const R_SPAN = 3.6;

const WIDTH = 520;
const HEIGHT = 290;
const PLOT = { left: 56, right: 508, top: 14, bottom: 246 };

const x = (u: number) => PLOT.left + ((u + Z_SPAN) / (2 * Z_SPAN)) * (PLOT.right - PLOT.left);
const y = (v: number) => PLOT.top + ((R_SPAN - v) / (2 * R_SPAN)) * (PLOT.bottom - PLOT.top);

/** Beam radius over the waist, w(z)/w₀, at z = u·z_R. */
const radius = (u: number) => Math.sqrt(1 + u * u);

// The intensity, (w₀/w)² exp(−2r²/w²), as columns along z, each shaded
// across r by a gradient sampled from the Gaussian.
// 113 columns of exactly 4 units, drawn with crisp edges, so no seam shows between them.
const COLUMNS = 113;
const STOPS = 25;
const columns = Array.from({ length: COLUMNS }, (_, index) => {
  const u = -Z_SPAN + ((index + 0.5) / COLUMNS) * 2 * Z_SPAN;
  const w = radius(u);
  const stops = Array.from({ length: STOPS }, (_, step) => {
    const offset = step / (STOPS - 1);
    const v = R_SPAN - offset * 2 * R_SPAN;
    return { offset, opacity: Math.exp((-2 * v * v) / (w * w)) / (w * w) };
  });
  return { x: x(-Z_SPAN + (index / COLUMNS) * 2 * Z_SPAN), stops };
});
const COLUMN_WIDTH = (PLOT.right - PLOT.left) / COLUMNS;

const curve = (sign: 1 | -1, at: (u: number) => number) =>
  Array.from({ length: 121 }, (_, index) => {
    const u = -Z_SPAN + (index / 120) * 2 * Z_SPAN;
    return `${index === 0 ? "M" : "L"}${x(u).toFixed(1)} ${y(sign * at(u)).toFixed(1)}`;
  }).join("");

const ENVELOPE = `${curve(1, radius)}${curve(-1, radius)}`;
const CONE = `M${x(-Z_SPAN)} ${y(Z_SPAN)}L${x(Z_SPAN)} ${y(-Z_SPAN)}M${x(-Z_SPAN)} ${y(-Z_SPAN)}L${x(Z_SPAN)} ${y(Z_SPAN)}`;

const Z_TICKS = [-3, -2, -1, 0, 1, 2, 3];
const R_TICKS = [-3, -2, -1, 0, 1, 2, 3];

/**
 * The beam's side view: intensity shaded along z (across) and r (up), the
 * beam radius ±w(z), the far-field cone ±θz it tends to, and ±z_R marked.
 * `rayleigh` and `waist` are in the units the axes are labelled in.
 */
export function GaussianBeamProfile({
  rayleigh,
  waist,
  rangeUnit,
  waistUnit,
}: {
  rayleigh: number | null;
  waist: number | null;
  rangeUnit: string;
  waistUnit: string;
}) {
  const ready = rayleigh !== null && waist !== null;
  const label = (multiple: number, scale: number | null) =>
    scale === null ? "" : multiple === 0 ? "0" : formatSignificant(multiple * scale, 3);

  return (
    <figure className="beamProfile">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          ready
            ? `Gaussian beam profile: waist ${formatSignificant(waist, 3)} ${waistUnit}, Rayleigh range ${formatSignificant(rayleigh, 3)} ${rangeUnit}`
            : "Gaussian beam profile"
        }
      >
        <defs>
          {columns.map((column, index) => (
            <linearGradient key={index} id={`beamProfile-${index}`} x1="0" y1="0" x2="0" y2="1">
              {column.stops.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} stopOpacity={stop.opacity.toFixed(3)} />
              ))}
            </linearGradient>
          ))}
        </defs>

        <g className="beamProfile__intensity" shapeRendering="crispEdges">
          {columns.map((column, index) => (
            <rect
              key={index}
              x={column.x}
              y={PLOT.top}
              width={COLUMN_WIDTH}
              height={PLOT.bottom - PLOT.top}
              fill={`url(#beamProfile-${index})`}
            />
          ))}
        </g>

        <g className="beamProfile__grid">
          {R_TICKS.map((tick) => (
            <line key={`r${tick}`} x1={PLOT.left} x2={PLOT.right} y1={y(tick)} y2={y(tick)} />
          ))}
          {Z_TICKS.map((tick) => (
            <line key={`z${tick}`} x1={x(tick)} x2={x(tick)} y1={PLOT.top} y2={PLOT.bottom} />
          ))}
        </g>

        <path className="beamProfile__cone" d={CONE} />
        <line className="beamProfile__rayleigh" x1={x(-1)} x2={x(-1)} y1={PLOT.top} y2={PLOT.bottom} />
        <line className="beamProfile__rayleigh" x1={x(1)} x2={x(1)} y1={PLOT.top} y2={PLOT.bottom} />
        <path className="beamProfile__envelope" d={ENVELOPE} />

        <text className="beamProfile__note" x={x(1) + 4} y={PLOT.top + 12}>
          z<tspan baselineShift="sub" fontSize="9">R</tspan>
        </text>
        <text className="beamProfile__note" x={x(-1) - 4} y={PLOT.top + 12} textAnchor="end">
          −z<tspan baselineShift="sub" fontSize="9">R</tspan>
        </text>

        <g className="beamProfile__axis">
          <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} />
          {Z_TICKS.map((tick) => (
            <text key={`z${tick}`} x={x(tick)} y={PLOT.bottom + 16} textAnchor="middle">
              {label(tick, rayleigh)}
            </text>
          ))}
          {R_TICKS.map((tick) => (
            <text key={`r${tick}`} x={PLOT.left - 6} y={y(tick) + 4} textAnchor="end">
              {label(tick, waist)}
            </text>
          ))}
          <text x={(PLOT.left + PLOT.right) / 2} y={HEIGHT - 4} textAnchor="middle">
            z ({rangeUnit})
          </text>
          <text x={12} y={(PLOT.top + PLOT.bottom) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(PLOT.top + PLOT.bottom) / 2})`}>
            r ({waistUnit})
          </text>
        </g>
      </svg>
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
        <span className="beamProfile__aside">z and r are on different scales.</span>
      </figcaption>
    </figure>
  );
}
