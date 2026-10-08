// The colormaps the Image view and the Surface view share, and the one
// routine that paints a frame with them.

import { flipRow } from "./image-axes.ts";

export type ColorMapName = "gray" | "viridis" | "plasma" | "inferno" | "magma";

export const COLOR_MAP_OPTIONS: Array<{ label: string; value: ColorMapName }> = [
  { label: "Gray", value: "gray" },
  { label: "Viridis", value: "viridis" },
  { label: "Plasma", value: "plasma" },
  { label: "Inferno", value: "inferno" },
  { label: "Magma", value: "magma" },
];

export const COLOR_MAP_STOPS: Record<ColorMapName, Array<[number, number, number]>> = {
  gray: [
    [0, 0, 0],
    [255, 255, 255],
  ],
  viridis: [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 97],
    [253, 231, 37],
  ],
  plasma: [
    [13, 8, 135],
    [84, 3, 160],
    [182, 54, 121],
    [251, 136, 97],
    [240, 249, 33],
  ],
  inferno: [
    [0, 0, 4],
    [87, 15, 109],
    [187, 55, 84],
    [249, 142, 8],
    [252, 255, 164],
  ],
  magma: [
    [0, 0, 4],
    [72, 20, 103],
    [149, 52, 110],
    [221, 95, 75],
    [252, 253, 191],
  ],
};

export function interpolateColor(colorMap: ColorMapName, normalized: number) {
  const stops = COLOR_MAP_STOPS[colorMap];

  if (stops.length === 1) {
    return stops[0];
  }

  const clamped = Math.min(Math.max(normalized, 0), 1);
  const scaled = clamped * (stops.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(stops.length - 1, lowerIndex + 1);
  const blend = scaled - lowerIndex;
  const lower = stops[lowerIndex];
  const upper = stops[upperIndex];

  return [0, 1, 2].map((channel) =>
    Math.round(lower[channel] + (upper[channel] - lower[channel]) * blend),
  ) as [number, number, number];
}

/**
 * The colour stops of a colormap, low to high, for a CSS linear-gradient. The
 * direction is left to the stylesheet: the colorbar runs up on wide screens
 * and left to right on phones.
 */
export function buildColorBarStops(colorMap: ColorMapName) {
  const stops = COLOR_MAP_STOPS[colorMap];

  return stops
    .map((stop, index) => {
      const position = (index / Math.max(stops.length - 1, 1)) * 100;
      return `rgb(${stop[0]} ${stop[1]} ${stop[2]}) ${position}%`;
    })
    .join(", ");
}

export type ColormapFrame = {
  height: number;
  max: number;
  min: number;
  pixels: Float32Array;
  width: number;
};

/**
 * The frame as RGBA bytes, one pixel each, in canvas order: scanlines run top
 * to bottom, so the frame's row 0 is the last scanline.
 */
export function colormappedFrameRgba(frame: ColormapFrame, colorMap: ColorMapName) {
  const { width, height, pixels, min, max } = frame;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const span = max - min || 1;

  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index];
    const normalized = Number.isFinite(value)
      ? Math.max(0, Math.min(1, (value - min) / span))
      : 0;
    const scanline = flipRow(Math.floor(index / width), height);
    const pixelIndex = (scanline * width + (index % width)) * 4;
    const [red, green, blue] = interpolateColor(colorMap, normalized);

    rgba[pixelIndex] = red;
    rgba[pixelIndex + 1] = green;
    rgba[pixelIndex + 2] = blue;
    rgba[pixelIndex + 3] = 255;
  }

  return rgba;
}

/** Paints the whole frame into `canvas`, one canvas pixel per frame pixel, row 0 along the bottom. */
export function renderColormappedFrame(
  canvas: HTMLCanvasElement,
  frame: ColormapFrame,
  colorMap: ColorMapName,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const { width, height } = frame;
  const imageData = context.createImageData(width, height);

  imageData.data.set(colormappedFrameRgba(frame, colorMap));
  canvas.width = width;
  canvas.height = height;
  context.putImageData(imageData, 0, 0);
}
