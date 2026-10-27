// Where a fibre or cable meets a part: the fibre stub it takes the place of,
// or the connector it plugs into. Plain numbers, in the part's frame about its
// body's centre (height from the table); connection-path.tsx turns them into
// a route.

import {
  AOM_CRYSTAL,
  AOM_SMA_RISE_MM,
  CAMERA_DEPTH_MM,
  CAMERA_FRONT_X,
  DELAY_DRIVE_MM,
  DELAY_RAIL_DROP_MM,
  EOM_SIDE,
  EOM_SMA_RISE_MM,
  FC_BARREL_LENGTH_MM,
  FC_FLANGE_DEPTH_MM,
  FC_TIP_LENGTH_MM,
  LASER_ARROW,
  LASER_BODY_MM,
  SMA_SLEEVE_MM,
  SPCM_DEPTH_MM,
  SPCM_FACE_X,
  SPCM_JACK_DROP_MM,
  SPCM_JACK_Z_MM,
  SPECTROMETER_BODY_MM,
  SPECTROMETER_FIBRE_SEAT_MM,
  SPECTROMETER_PORT,
  TAGGER_DEPTH_MM,
  TAGGER_INPUTS,
  TAGGER_NUT_MM,
  TAGGER_PANEL_MM,
  TAGGER_PITCH_MM,
  TAGGER_ROW_Z_MM,
  collimatorStubPoints,
  photodiodeStubPoints,
  taggerInputZ,
  type StubPoints,
} from "./model-dimensions.ts";
import {
  CONNECTION_KINDS,
  clamp,
  delayRailMm,
  kindsWhere,
  type BuilderComponent,
  type ComponentType,
  type ConnectionKind,
  type Vec3,
} from "./types.ts";

/**
 * The parts that draw a fibre stub down to the table, and its curve from the
 * connector out. A fibre connected to one takes the stub's place: it leaves
 * the same connector along the same curve, in the connection's colour.
 */
export const FIBER_STUBS: Partial<Record<ComponentType, StubPoints>> = {
  "fiber-collimator": collimatorStubPoints,
  photodiode: photodiodeStubPoints,
};

/**
 * The parts whose one connector takes a cable as well as a fibre: a
 * photodiode's jack on the back of its head is where its signal leaves.
 */
const ANY_KIND_STUBS = kindsWhere((spec) => spec.stubTakesCable === true);

/**
 * Whether a connection of `kind` at a part of `type` leaves from the part's
 * stub, along the stub's curve, and so takes the stub's place.
 */
export function leavesFromStub(type: ComponentType, kind: ConnectionKind): boolean {
  return FIBER_STUBS[type] !== undefined && (CONNECTION_KINDS[kind].usesFiberStub || ANY_KIND_STUBS.has(type));
}

/**
 * Where a connection plugs into a part that has a connector for it, in the
 * part's frame about its body's centre (height from the table), and the way
 * it leaves: straight out of the connector, along x or up. A cable goes into
 * an instrument's back, where its signal or power is: a camera's or a
 * spectrometer's back face, a single-photon counter's SMA outputs, a laser's
 * back, a delay line's drive, the SMA on a modulator, or the time tagger's
 * input facing the other end. A fibre goes into a spectrometer's or a
 * counter's fibre port, and leaves a laser out of its front. `towardZ` is
 * where the other end lies across the part, in the same frame.
 */
export type ConnectionJack = { at: Vec3; out: Vec3 };

export function connectionJack(part: BuilderComponent, kind: ConnectionKind, towardZ: number): ConnectionJack | undefined {
  const axis = part.position[1];
  const jack = (x: number, y: number, z: number, out: Vec3): ConnectionJack => ({ at: [x, y, z], out });
  if (part.type === "delay-line") {
    return jack(-delayRailMm(part) / 2 - DELAY_DRIVE_MM, axis - DELAY_RAIL_DROP_MM, 0, [-1, 0, 0]);
  }
  if (kind === "fiber") {
    // a fibre-coupled laser's fibre leaves from the tip of its +x arrow, the way it fires
    if (part.type === "laser-source") return jack(LASER_ARROW.x + LASER_ARROW.length / 2, axis, 0, [1, 0, 0]);
    if (part.type === "spectrometer") {
      const portEnd = SPECTROMETER_PORT.x - SPECTROMETER_PORT.length / 2;
      return jack(portEnd + SPECTROMETER_FIBRE_SEAT_MM, axis, 0, [-1, 0, 0]);
    }
    if (part.type === "single-photon-detector") {
      // the middle of the FC receptacle's ceramic tip
      return jack(SPCM_FACE_X - FC_FLANGE_DEPTH_MM - FC_BARREL_LENGTH_MM - FC_TIP_LENGTH_MM / 2, axis, 0, [-1, 0, 0]);
    }
    return undefined;
  }
  switch (part.type) {
    case "camera":
      return jack(CAMERA_FRONT_X + CAMERA_DEPTH_MM, axis, 0, [1, 0, 0]);
    case "spectrometer":
      return jack(SPECTROMETER_BODY_MM / 2, axis, 0, [1, 0, 0]);
    case "laser-source":
      return jack(-LASER_BODY_MM / 2, axis, 0, [-1, 0, 0]);
    case "single-photon-detector":
      return jack(
        SPCM_FACE_X + SPCM_DEPTH_MM + SMA_SLEEVE_MM,
        axis - SPCM_JACK_DROP_MM,
        SPCM_JACK_Z_MM[towardZ < 0 ? 0 : 1],
        [1, 0, 0],
      );
    case "aom":
      return jack(0, axis + AOM_CRYSTAL[1] / 2 + AOM_SMA_RISE_MM + SMA_SLEEVE_MM, 0, [0, 1, 0]);
    case "eom":
      return jack(0, axis + EOM_SIDE / 2 + EOM_SMA_RISE_MM + SMA_SLEEVE_MM, 0, [0, 1, 0]);
    case "time-tagger": {
      // the input in the row nearest the other end
      const index = clamp(Math.round((towardZ - TAGGER_ROW_Z_MM) / TAGGER_PITCH_MM + (TAGGER_INPUTS - 1) / 2), [0, TAGGER_INPUTS - 1]);
      return jack(-TAGGER_DEPTH_MM / 2 - TAGGER_PANEL_MM - TAGGER_NUT_MM - SMA_SLEEVE_MM, axis, taggerInputZ(index), [-1, 0, 0]);
    }
    default:
      return undefined;
  }
}
