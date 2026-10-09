import { BlobReader, openFits, readImage, type Hdu, type FitsImage } from "@fits-js/core";

import { NO_IMAGE_MESSAGE } from "@/components/plotters/fits-errors";
import { headerChips, headerSections, type FitsHeaderInfo } from "@/components/plotters/fits-header";

type HeaderAccessor = {
  get: (key: string) => unknown;
};

export type ImageSummary = {
  kind: "image";
  bitpix: number;
  frameCount: number;
  header: FitsHeaderInfo;
  shapeSummary: Array<{ label: string; value: string }>;
  height: number;
  max: number;
  min: number;
  pixels: Float32Array;
  sourceLabel: string;
  width: number;
  xLabel: string;
  yLabel: string;
};

export type SeriesSummary = {
  kind: "series";
  bitpix: number;
  frameCount: number;
  header: FitsHeaderInfo;
  shapeSummary: Array<{ label: string; value: string }>;
  max: number;
  min: number;
  points: Array<{ x: number; y: number }>;
  sourceLabel: string;
  xLabel: string;
  yLabel: string;
};

export type FitsSummary = ImageSummary | SeriesSummary;

function readHeaderNumber(header: HeaderAccessor, key: string) {
  const value = header.get(key);

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "bigint"
      ? Number(value)
      : typeof value === "string" && Number.isFinite(Number(value))
        ? Number(value)
        : null;
}

function readHeaderString(header: HeaderAccessor, key: string) {
  const value = header.get(key);

  return typeof value === "string" && value.trim() ? value : null;
}

function computeRange(values: ArrayLike<number>) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!Number.isFinite(value)) {
      continue;
    }

    if (value < min) {
      min = value;
    }

    if (value > max) {
      max = value;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 };
  }

  return { min, max };
}

function buildAxisLabel(header: HeaderAccessor, fallback: string, axis: number) {
  return readHeaderString(header, `CTYPE${axis}`) ?? fallback;
}

function buildAxisValues(length: number, header: HeaderAccessor) {
  const crval = readHeaderNumber(header, "CRVAL1");
  const cdelt = readHeaderNumber(header, "CDELT1");
  const crpix = readHeaderNumber(header, "CRPIX1") ?? 1;

  return Array.from({ length }, (_, index) => {
    if (crval === null || cdelt === null) {
      return index;
    }

    return crval + (index + 1 - crpix) * cdelt;
  });
}

function buildShapeSummary(shape: readonly number[], bitpix: number) {
  return [
    { label: "BITPIX", value: String(bitpix) },
    { label: "Width", value: String(shape[0] ?? 0) },
    { label: "Height", value: String(shape[1] ?? 1) },
    { label: "Frames", value: String(shape[2] ?? 1) },
  ];
}

function normalizeImageArray(image: FitsImage) {
  return image.data instanceof Float32Array
    ? image.data
    : Float32Array.from(image.data as ArrayLike<number>);
}

function selectImageHdu(hdus: readonly Hdu[]) {
  return hdus.find((hdu) => (hdu.type === "primary" || hdu.type === "image") && hdu.header.get("NAXIS") !== 0);
}

export async function parseFitsFile(file: File): Promise<FitsSummary> {
  const reader = new BlobReader(file);
  const { hdus } = await openFits(reader);
  const hdu = selectImageHdu(hdus);

  if (!hdu) {
    throw new Error(NO_IMAGE_MESSAGE);
  }

  const image = await readImage(hdu, reader);
  const pixels = normalizeImageArray(image);
  const range = computeRange(pixels);
  const bitpix = image.bitpix;
  const shape = image.shape;
  const header = { chips: headerChips(hdu.header.cards), sections: headerSections(hdus, hdu) };
  const shapeSummary = buildShapeSummary(shape, bitpix);
  const width = shape[0] ?? pixels.length;
  const height = shape[1] ?? 1;
  const frameCount = shape[2] ?? 1;

  if (height <= 1 || width <= 1) {
    const length = Math.max(width, height);
    const xValues = buildAxisValues(length, hdu.header);
    const xLabel = buildAxisLabel(hdu.header, "pixel", 1);
    const yLabel = readHeaderString(hdu.header, "BUNIT") ?? "intensity";

    return {
      kind: "series",
      bitpix,
      frameCount,
      header,
      shapeSummary,
      max: range.max,
      min: range.min,
      points: xValues.map((x, index) => ({ x, y: pixels[index] })),
      sourceLabel: file.name,
      xLabel,
      yLabel,
    };
  }

  return {
    kind: "image",
    bitpix,
    frameCount,
    header,
    shapeSummary,
    height,
    max: range.max,
    min: range.min,
    pixels,
    sourceLabel: file.name,
    width,
    xLabel: buildAxisLabel(hdu.header, "x", 1),
    yLabel: buildAxisLabel(hdu.header, "y", 2),
  };
}
