// The axis gizmo's maths: where the table's three axes point on screen for a
// given camera turn. The scene is millimetres with +Y up and the table in XZ
// (CONTEXT.md, "Table"), so the gizmo tells a viewer which way +X and +Z run
// along the table in whatever view they have orbited to.

export type Quaternion = readonly [x: number, y: number, z: number, w: number];

export type AxisName = "x" | "y" | "z";

export type AxisArrow = {
  axis: AxisName;
  /** screen offset of the tip from the hub, as a fraction of the arm length; +y is down the screen */
  dx: number;
  dy: number;
  /** towards the viewer is positive: arrows pointing away are drawn first and fainter */
  depth: number;
};

const AXES: readonly [AxisName, readonly [number, number, number]][] = [
  ["x", [1, 0, 0]],
  ["y", [0, 1, 0]],
  ["z", [0, 0, 1]],
];

/** Rotate `v` by the inverse of unit quaternion `q`: a world vector in the camera's frame. */
function intoCameraFrame([qx, qy, qz, qw]: Quaternion, [x, y, z]: readonly [number, number, number]) {
  // conjugate: (-qx, -qy, -qz, qw), applied as v + 2w(u×v) + 2u×(u×v)
  const ux = -qx;
  const uy = -qy;
  const uz = -qz;
  const tx = 2 * (uy * z - uz * y);
  const ty = 2 * (uz * x - ux * z);
  const tz = 2 * (ux * y - uy * x);
  return [
    x + qw * tx + (uy * tz - uz * ty),
    y + qw * ty + (uz * tx - ux * tz),
    z + qw * tz + (ux * ty - uy * tx),
  ] as const;
}

/** The three axes as the camera sees them, furthest first so nearer arrows draw over them. */
export function axisArrows(camera: Quaternion): AxisArrow[] {
  return AXES.map(([axis, vector]) => {
    const [x, y, z] = intoCameraFrame(camera, vector);
    return { axis, dx: x, dy: -y, depth: z };
  }).sort((a, b) => a.depth - b.depth);
}
