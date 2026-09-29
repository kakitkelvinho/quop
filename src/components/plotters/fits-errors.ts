// Turns an error from reading a FITS file into a sentence a person can act
// on. The library's own message is kept, in brackets after it, for anyone
// who wants the detail. Matching is on the message text, so it works for
// any error, not just @fits-js/core's classes.

/** Thrown by the plotters when a valid FITS file holds no image to show. */
export const NO_IMAGE_MESSAGE =
  "This FITS file has no image to show. Its HDUs hold only tables or headers.";

const FALLBACK =
  "This file couldn't be read as a FITS image. Check that it's a FITS file and try again.";

const PLAIN_MESSAGES: Array<{ match: RegExp; message: string }> = [
  {
    match: /tile-compressed|compressed images/i,
    message:
      "This FITS image is compressed, which the plotter can't read yet. Decompress it (for example with funpack) and upload it again.",
  },
  {
    match: /random-groups/i,
    message:
      "This FITS file uses the old random-groups format, which the plotter can't read. Save it as a plain image HDU and try again.",
  },
  {
    match: /truncated|shorter than one 2880-byte block|past end of input/i,
    message:
      "This FITS file ends early, so part of it is missing. Try copying or exporting it again.",
  },
  {
    match: /BITPIX|NAXIS|SIMPLE|no HDUs|END card|XTENSION/,
    message:
      "This doesn't look like a FITS file: its header is missing or broken. Check that you picked a .fits file, or export it again.",
  },
  {
    match: /read failed/i,
    message: "The browser couldn't read this file. Try choosing it again.",
  },
];

/** A readable message for a failed FITS read, with the raw detail after it. */
export function describeFitsError(error: unknown): string {
  const detail = error instanceof Error ? error.message.trim() : "";

  if (detail === NO_IMAGE_MESSAGE) {
    return NO_IMAGE_MESSAGE;
  }

  const plain = PLAIN_MESSAGES.find(({ match }) => match.test(detail))?.message ?? FALLBACK;

  return detail ? `${plain} (${detail})` : plain;
}
