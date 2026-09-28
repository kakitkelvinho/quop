import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeFitsError, NO_IMAGE_MESSAGE } from "./fits-errors.ts";

describe("describeFitsError", () => {
  it("says a file with a broken header isn't FITS, and keeps the detail", () => {
    const raw = "HDU 0: BITPIX undefined is not 8, 16, 32, 64, -32 or -64";
    const message = describeFitsError(new Error(raw));

    assert.match(message, /^This doesn't look like a FITS file/);
    assert.ok(message.endsWith(`(${raw})`));
  });

  it("puts the plain sentence first and the library text last", () => {
    const message = describeFitsError(new Error("HDU 2 image data is truncated"));

    assert.match(message, /^This FITS file ends early/);
    assert.ok(message.indexOf("(HDU 2") > message.indexOf("again."));
  });

  it("names compressed images", () => {
    const message = describeFitsError(
      new Error("HDU 1 is a tile-compressed image (RICE_1); compressed images are not supported yet"),
    );

    assert.match(message, /compressed/);
    assert.match(message, /funpack/);
  });

  it("names random groups", () => {
    assert.match(
      describeFitsError(new Error("random-groups format is not supported")),
      /^This FITS file uses the old random-groups format/,
    );
  });

  it("says when the browser couldn't read the file", () => {
    assert.match(
      describeFitsError(new Error("Blob read failed")),
      /^The browser couldn't read this file/,
    );
  });

  it("passes the no-image message through unchanged", () => {
    assert.equal(describeFitsError(new Error(NO_IMAGE_MESSAGE)), NO_IMAGE_MESSAGE);
  });

  it("falls back to a plain sentence for unknown errors", () => {
    assert.equal(
      describeFitsError(new Error("something odd")),
      "This file couldn't be read as a FITS image. Check that it's a FITS file and try again. (something odd)",
    );
  });

  it("leaves off empty brackets when there is no detail", () => {
    assert.equal(
      describeFitsError("not an error"),
      "This file couldn't be read as a FITS image. Check that it's a FITS file and try again.",
    );
  });
});
