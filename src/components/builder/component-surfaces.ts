import {
  BEAM_CUBE_EDGE_MM,
  CAMERA_OPENING_RADIUS_MM,
  AOM_CRYSTAL,
  DELAY_RAIL_DROP_MM,
  EOM_SIDE,
  FC_TIP_RADIUS_MM,
  OPTIC_DIAMETER_MM,
  PD_CHIP_SIDE_MM,
  SPECTROMETER_PORT_RADIUS_MM,
} from "./model-dimensions.ts";
import { rotator, waveplate } from "./jones.ts";
import { makeSurface, type Surface } from "./surface.ts";

const opticRadiusMm = OPTIC_DIAMETER_MM / 2;
const cubeHalfMm = BEAM_CUBE_EDGE_MM / 2;
const diagonal = Math.SQRT1_2;

export function mirrorSurfaces(): Surface[] {
  return [makeSurface({
    positionMm: [0, 0, 0], normal: [1, 0, 0],
    aperture: { kind: "circle", radiusMm: opticRadiusMm }, rule: { kind: "reflect" },
  })];
}

export function beamCubeSurfaces(): Surface[] {
  const face = (x: number): Surface => makeSurface({
    positionMm: [x, 0, 0], normal: [1, 0, 0],
    aperture: { kind: "rect", widthMm: BEAM_CUBE_EDGE_MM, heightMm: BEAM_CUBE_EDGE_MM, widthAxis: [0, 0, 1] },
    rule: { kind: "pass" },
  });
  return [
    face(-cubeHalfMm), face(cubeHalfMm),
    makeSurface({
      positionMm: [0, 0, 0], normal: [diagonal, 0, -diagonal],
      aperture: { kind: "rect", widthMm: BEAM_CUBE_EDGE_MM * Math.SQRT2, heightMm: BEAM_CUBE_EDGE_MM, widthAxis: [diagonal, 0, diagonal] },
      rule: { kind: "split", reflectance: 0.5, transmittance: 0.5 },
    }),
  ];
}

export function lensSurfaces(focalLengthMm: number): Surface[] {
  return [makeSurface({
    positionMm: [0, 0, 0], normal: [1, 0, 0],
    aperture: { kind: "circle", radiusMm: opticRadiusMm }, rule: { kind: "thin-lens", focalLengthMm },
  })];
}

export function detectorSurfaces(kind: "photodiode" | "camera" | "spectrometer" | "single-photon-detector"): Surface[] {
  const aperture = kind === "photodiode"
    ? { kind: "rect" as const, widthMm: PD_CHIP_SIDE_MM, heightMm: PD_CHIP_SIDE_MM, widthAxis: [0, 0, 1] as [number, number, number] }
    : { kind: "circle" as const, radiusMm: {
      camera: CAMERA_OPENING_RADIUS_MM,
      spectrometer: SPECTROMETER_PORT_RADIUS_MM,
      "single-photon-detector": FC_TIP_RADIUS_MM,
    }[kind] };
  return [makeSurface({ positionMm: [0, 0, 0], normal: [1, 0, 0], aperture, rule: { kind: "block" } })];
}

export function noSurfaces(): Surface[] {
  return [];
}

export function circularSurface(radiusMm: number, rule: Surface["rule"] = { kind: "pass" }, extraPathMm?: number): Surface[] {
  return [makeSurface({ positionMm: [0, 0, 0], normal: [1, 0, 0], aperture: { kind: "circle", radiusMm }, rule, extraPathMm })];
}

export function rectangularSurface(widthMm: number, heightMm: number, rule: Surface["rule"] = { kind: "block" }): Surface[] {
  return [makeSurface({
    positionMm: [0, 0, 0], normal: [1, 0, 0],
    aperture: { kind: "rect", widthMm, heightMm, widthAxis: [0, 0, 1] }, rule,
  })];
}

export const FIBRE_COLLIMATOR_SURFACES = () => circularSurface(4.5);
export const WAVEPLATE_SURFACES = () => circularSurface(opticRadiusMm, { kind: "pass", jones: waveplate(Math.PI, 0) });
export const FILTER_SURFACES = () => circularSurface(12);
export const IRIS_SURFACES = () => circularSurface(5);
export const TRAP_SURFACES = () => circularSurface(6);
export const CAVITY_SURFACES = () => circularSurface(opticRadiusMm, { kind: "split", reflectance: 0.5, transmittance: 0.5 });
export const OBJECTIVE_SURFACES = () => circularSurface(10);
export const AOM_SURFACES = () => rectangularSurface(AOM_CRYSTAL[2], AOM_CRYSTAL[1], { kind: "pass" });
export const EOM_SURFACES = () => rectangularSurface(EOM_SIDE, EOM_SIDE, { kind: "pass" });
export const ISOLATOR_SURFACES = () => circularSurface(3.5, { kind: "isolator", jones: rotator(Math.PI / 4) });
/**
 * A Delay line stands across the line, so light crosses its port along local z (#360).
 * The stage behind the port blocks a Beam that misses it; it is declared after
 * the port so that a Beam through the port, meeting both at once, meets the port.
 */
export function delayLineSurfaces(extraPathMm: number, railMm: number): Surface[] {
  return [
    makeSurface({
      positionMm: [0, 0, 0], normal: [0, 0, 1],
      aperture: { kind: "circle", radiusMm: opticRadiusMm }, rule: { kind: "pass" }, extraPathMm,
    }),
    makeSurface({
      positionMm: [(opticRadiusMm - railMm) / 2, 0, 0], normal: [0, 0, 1],
      aperture: { kind: "rect", widthMm: railMm + opticRadiusMm, heightMm: 2 * DELAY_RAIL_DROP_MM, widthAxis: [1, 0, 0] },
      rule: { kind: "block" },
    }),
  ];
}
export const PARTICLE_SURFACES = (radiusMm: number) => circularSurface(radiusMm, { kind: "block" });
export const SAMPLE_SURFACES = () => circularSurface(opticRadiusMm);
export const BEAM_BLOCK_SURFACES = () => rectangularSurface(50, 26);
export const TIME_TAGGER_SURFACES = () => rectangularSurface(120, 50);
