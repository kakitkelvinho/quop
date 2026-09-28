import { version } from "../../package.json";

import { ReportLink } from "@/components/report-link";

/** Read at build time, so the footer, the package and the release tag agree. */
export const SITE_VERSION = version;

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <span>quop v{SITE_VERSION}</span>
      <span aria-hidden="true">·</span>
      <ReportLink />
    </footer>
  );
}
