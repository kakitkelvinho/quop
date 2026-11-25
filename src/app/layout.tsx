import type { Metadata } from "next";
import localFont from "next/font/local";

import { AppShell } from "@/components/app-shell";
import { SiteFooter } from "@/components/site-footer";
import { SITE_VERSION } from "@/components/site-version";

import "./globals.css";

// The fonts live in ./fonts so the build never fetches from Google Fonts.
// Source Sans 3: Adobe's open-source sibling of Myriad, a signage-family sans.
// One variable file covers every weight the site sets, 200 to 900.
const sourceSans = localFont({
  src: [{ path: "./fonts/source-sans-3-200-900-normal.woff2", weight: "200 900", style: "normal" }],
  variable: "--font-source-sans",
});

// The home page's chapter diagrams set their labels in italic Garamond.
// Each file is a 400–500 weight variable font cut to Latin, Greek, arrows and ⟨⟩.
const ebGaramond = localFont({
  src: [
    { path: "./fonts/eb-garamond-400-500-normal.woff2", weight: "400 500", style: "normal" },
    { path: "./fonts/eb-garamond-400-500-italic.woff2", weight: "400 500", style: "italic" },
  ],
  variable: "--font-eb-garamond",
  adjustFontFallback: "Times New Roman",
});

// The Tabletop's Space and Blueprint themes: open stand-ins for the film's
// faces. Gillius ADF (from CTAN, GPL with the font exception) for Gill Sans,
// and Archivo Narrow (Google Fonts) for Univers Condensed.
const gillius = localFont({
  src: [
    { path: "./fonts/gillius-adf-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/gillius-adf-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-gillius",
});
const archivoNarrow = localFont({
  src: [{ path: "./fonts/archivo-narrow-400-600-normal.woff2", weight: "400 600", style: "normal" }],
  variable: "--font-archivo-narrow",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kakitkelvinho.github.io/quop";
const description = "Quantum optics notes, calculators, theory, and plotters.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // each page names itself in its tab, so several open tools can be told apart
  title: { default: "QUOP · Quantum optics in the browser", template: "%s · QUOP" },
  description,
  openGraph: {
    title: "QUOP",
    description,
    siteName: "QUOP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "QUOP",
    description,
  },
  // read by report links, so a problem report says which version it's about
  other: { "quop-version": SITE_VERSION },
};

const preferencesScript = `
  (() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const read = (key) => {
      try { return localStorage.getItem(key); } catch { return null; }
    };
    const migrate = (key, oldKey, valid) => {
      const current = read(key);
      if (current !== null) return current;
      const old = read(oldKey);
      if (valid.includes(old)) {
        try {
          localStorage.setItem(key, old);
          localStorage.removeItem(oldKey);
        } catch { /* storage can be unavailable */ }
        return old;
      }
      return null;
    };
    let theme = migrate("site-theme", ["builder", "look"].join("-"), ["station", "2001"]);
    // the Space theme was called 2001 until 1.x; a saved "2001" keeps it
    if (theme === "2001") {
      theme = "space";
      try { localStorage.setItem("site-theme", theme); } catch { /* storage can be unavailable */ }
    }
    document.documentElement.dataset.theme = theme === "space" || theme === "blueprint" ? theme : "station";
    migrate("mode-preference", ["theme", "preference"].join("-"), ["light", "dark"]);
    const applyMode = () => {
      const savedMode = read("mode-preference");
      document.documentElement.dataset.mode = savedMode === "dark" || savedMode === "light"
        ? savedMode : query.matches ? "dark" : "light";
    };
    applyMode();
    // with no saved choice, follow the system as it changes
    query.addEventListener("change", applyMode);
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${sourceSans.variable} ${ebGaramond.variable} ${gillius.variable} ${archivoNarrow.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: preferencesScript }} />
        <AppShell footer={<SiteFooter />}>{children}</AppShell>
      </body>
    </html>
  );
}
