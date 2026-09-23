import type { Metadata } from "next";
import { EB_Garamond, IBM_Plex_Sans } from "next/font/google";

import { AppShell } from "@/components/app-shell";

import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
});

// The chalkboard hero sets its equations in italic Garamond.
const ebGaramond = EB_Garamond({
  subsets: ["latin", "greek"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
  variable: "--font-eb-garamond",
});

export const metadata: Metadata = {
  title: "quop",
  description: "Quantum optics notes, calculators, theory, and plotters.",
};

const themeScript = `
  (() => {
    const savedTheme = localStorage.getItem("theme-preference");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : prefersDark
        ? "dark"
        : "light";
    document.documentElement.dataset.theme = theme;
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
