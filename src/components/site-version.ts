import { version } from "../../package.json";

/**
 * Read at build time, so the footer, the package and the release tag agree.
 * Server-side only: client code reads it from the quop-version meta tag the
 * layout writes, so package.json never ships in the browser bundle.
 */
export const SITE_VERSION = version;
