import { ReportLink } from "@/components/report-link";
import { SITE_VERSION } from "@/components/site-version";

export function SiteFooter() {
  return (
    // the same column as <main>, so the footer's edges line up with the page
    <footer className="siteFooter mx-auto w-full max-w-6xl px-4 sm:px-6">
      <span>quop v{SITE_VERSION}</span>
      <span aria-hidden="true">·</span>
      <ReportLink />
    </footer>
  );
}
