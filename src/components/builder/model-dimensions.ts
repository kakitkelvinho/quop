// Measurements of the 3D models that more than the models depend on: where a
// fibre or cable plugs in (connection-jacks.ts), and where a part's port sits
// (each referenceX in COMPONENT_SPECS, types.ts). The models in
// component-models.tsx draw from these same numbers, so the drawing and the
// connections agree. Everything is in mm, in a part's own frame: x along the
// beam (+x the way a laser fires), y up from its optical centre, z across.
//
// This file imports nothing at run time, so types.ts can derive its port
// offsets from it.

/** How far into an SMA a cable's plug starts, up its 8 mm body: the plug sleeves over it. */
export const SMA_SLEEVE_MM = 5;

/** A laser source's head: its length along the beam, centred on the part. */
export const LASER_BODY_MM = 96;
/** The emitter on the head's front: its middle along x, and its length. */
export const LASER_EMITTER = { x: 50, length: 12 } as const;
/** The +x arrow past the emitter showing which way it fires: its middle along x, and its length. */
export const LASER_ARROW = { x: 64, length: 12 } as const;

/** A spectrometer's box, centred on the part: its length along the beam. */
export const SPECTROMETER_BODY_MM = 110;
/** The entrance port on its front (-x), on the beam: its middle along x, and its length. */
export const SPECTROMETER_PORT = { x: -57, length: 10 } as const;
/** How far into the entrance port a fibre's plug reaches. */
export const SPECTROMETER_FIBRE_SEAT_MM = 2;

/** A camera's body: its depth along the beam, and where its front face sits. */
export const CAMERA_DEPTH_MM = 25;
export const CAMERA_FRONT_X = -9;
/** The dark ring at the front of its C-mount barrel: its middle along x, and its thickness. */
export const CAMERA_MOUNT_RING = { x: -22, depth: 2 } as const;

/** A single-photon detector's module: its front face (-x), and its depth behind it. */
export const SPCM_FACE_X = -20;
export const SPCM_DEPTH_MM = 48;
/** Its two SMA pulse outputs out the back (+x): how far below the axis, and where across. */
export const SPCM_JACK_DROP_MM = 6;
export const SPCM_JACK_Z_MM = [-7, 7] as const;
/** The FC receptacle on its face, outward from it: the square flange, the threaded barrel and the ceramic tip. */
export const FC_FLANGE_DEPTH_MM = 1.5;
export const FC_BARREL_LENGTH_MM = 7;
export const FC_TIP_LENGTH_MM = 2;

/** An AOM's crystal: length along the beam, height, width. */
export const AOM_CRYSTAL: [number, number, number] = [30, 14, 12];
/** How far above the crystal's top its SMA stands: on the transducer bonded there. */
export const AOM_SMA_RISE_MM = 3.5;

/** An EOM's crystal bar: its length along the beam, and its square side. */
export const EOM_LENGTH = 44;
export const EOM_SIDE = 9;
/** How far above the bar's top its SMA stands: on the wire up from the top electrode. */
export const EOM_SMA_RISE_MM = 5.5;

/** A time tagger's case, centred on the part: its depth along x. */
export const TAGGER_DEPTH_MM = 150;
/** The panel on its front (-x), and the bulkhead nut each input's SMA stands on. */
export const TAGGER_PANEL_MM = 1.5;
export const TAGGER_NUT_MM = 1.5;
/** Its row of SMA inputs across the front: how many, how far apart along z. */
export const TAGGER_INPUTS = 8;
export const TAGGER_PITCH_MM = 18;
/** the row of inputs is shifted toward +z, leaving the -z end for the status light */
export const TAGGER_ROW_Z_MM = 22;

/** The z of a time tagger's input `index`, counted from -z. */
export function taggerInputZ(index: number): number {
  return TAGGER_ROW_Z_MM + (index - (TAGGER_INPUTS - 1) / 2) * TAGGER_PITCH_MM;
}

/** How far below the beam a delay line's rail runs, and the length of the drive knob at its far end. */
export const DELAY_RAIL_DROP_MM = 26;
export const DELAY_DRIVE_MM = 12;

/** A photodiode's head: the radius of its dome, which bulges away from the beam (+x). */
export const PD_RADIUS = 13;

/**
 * The fibre stubs, from the connector down to the table, as control points of
 * a curve through them, for a part whose optical centre is `axis` up. Each
 * curls to the part's +z.
 */
export type StubPoints = (axis: number) => [number, number, number][];

/** A fibre collimator's jacket: out of its back and down to the table. */
export const collimatorStubPoints: StubPoints = (axis) => [
  [-44, axis, 0],
  [-60, axis - 4, 0],
  [-72, axis * 0.7, 6],
  [-78, axis * 0.33, 14],
  [-86, 4, 26],
  [-104, 1.8, 40],
];

/** A photodiode's fibre: out of the dome's tip (+x) and down to the table. */
export const photodiodeStubPoints: StubPoints = (axis) => {
  const x = PD_RADIUS + 4;
  return [
    [x, axis, 0],
    [x + 14, axis - 2, 0],
    [x + 26, axis * 0.7, 6],
    [x + 32, axis * 0.33, 14],
    [x + 40, 4, 26],
    [x + 58, 1.8, 40],
  ];
};
