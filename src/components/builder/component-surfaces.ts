import {
  BEAM_CUBE_EDGE_MM,
  CAMERA_OPENING_RADIUS_MM,
  FC_TIP_RADIUS_MM,
  OPTIC_DIAMETER_MM,
  PD_CHIP_SIDE_MM,
  SPECTROMETER_PORT_RADIUS_MM,
} from "./model-dimensions.ts";
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
