// The colormaps the Image view and the Surface view share, and the one
// routine that paints a frame with them.

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

export function buildColorBarGradient(colorMap: ColorMapName) {
  const stops = COLOR_MAP_STOPS[colorMap];

  return `linear-gradient(to top, ${stops
    .map((stop, index) => {
      const position = (index / Math.max(stops.length - 1, 1)) * 100;
      return `rgb(${stop[0]} ${stop[1]} ${stop[2]}) ${position}%`;
    })
    .join(", ")})`;
}

export type ColormapFrame = {
  height: number;
  max: number;
  min: number;
  pixels: Float32Array;
  width: number;
};

/** Paints the whole frame into `canvas`, one canvas pixel per frame pixel. */
export function renderColormappedFrame(
  canvas: HTMLCanvasElement,
  frame: ColormapFrame,
  colorMap: ColorMapName,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const { width, height, pixels, min, max } = frame;
  const imageData = context.createImageData(width, height);
  const span = max - min || 1;

  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index];
    const normalized = Number.isFinite(value)
      ? Math.max(0, Math.min(1, (value - min) / span))
      : 0;
    const pixelIndex = index * 4;
    const [red, green, blue] = interpolateColor(colorMap, normalized);

    imageData.data[pixelIndex] = red;
    imageData.data[pixelIndex + 1] = green;
    imageData.data[pixelIndex + 2] = blue;
    imageData.data[pixelIndex + 3] = 255;
  }

  canvas.width = width;
  canvas.height = height;
  context.putImageData(imageData, 0, 0);
}
