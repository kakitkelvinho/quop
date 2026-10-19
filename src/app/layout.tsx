import type { Metadata } from "next";
import localFont from "next/font/local";

import { AppShell } from "@/components/app-shell";
import { NightInkPrototype } from "@/components/night-ink.prototype";
import { SiteFooter } from "@/components/site-footer";
import { SITE_VERSION } from "@/components/site-version";

import "./globals.css";

// Both fonts live in ./fonts so the build never fetches from Google Fonts.
const ibmPlexSans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ibm-plex-sans-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ibm-plex-sans",
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

const themeScript = `
  (() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const savedTheme = localStorage.getItem("theme-preference");
      const theme = savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : query.matches
          ? "dark"
          : "light";
      document.documentElement.dataset.theme = theme;
    };
    apply();
    // with no saved choice, follow the system as it changes
    query.addEventListener("change", apply);
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${ibmPlexSans.variable} ${ebGaramond.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppShell footer={<SiteFooter />}>{children}</AppShell>
        <NightInkPrototype />
      </body>
    </html>
  );
}
