import { fontFamilyNames } from "./svg-export.ts";

// A chart as a PDF: the SVG file svg-export.ts draws, set by svg2pdf.js on a
// page the figure's own size, with the web font it names embedded. Text stays
// text, and a paper can include the file at its drawn size.

/** CSS pixels are 1/96 in, PDF points 1/72 in. */
const POINTS_PER_PIXEL = 72 / 96;

/** A web font to embed, under the family name the SVG file gives it. */
export type PdfFont = { family: string; webFamily: string };

/** jsPDF's page for a figure `width` × `height` CSS pixels: the same size in points, no margins. */
export function pdfPageFormat(width: number, height: number) {
  const format: [number, number] = [width * POINTS_PER_PIXEL, height * POINTS_PER_PIXEL];
  // jsPDF swaps the sides of a page whose orientation disagrees with them
  return { format, orientation: width > height ? "landscape" : "portrait" } as const;
}

/** Where the page loaded a web font from, read off its @font-face rule. */
function webFontUrl(webFamily: string): string {
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // another origin's sheet can't be read
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      if (fontFamilyNames(rule.style.getPropertyValue("font-family"))[0] !== webFamily) continue;
      const src = /url\(\s*(["']?)(.+?)\1\s*\)/.exec(rule.style.getPropertyValue("src"))?.[2];
      if (src) return new URL(src, sheet.href ?? document.baseURI).href;
    }
  }
  throw new Error(`The page has no @font-face for ${webFamily}`);
}

/** The web font's WOFF2 file as the TrueType binary string jsPDF embeds (it keeps only the glyphs used). */
async function trueTypeFont(url: string): Promise<string> {
  const [{ default: decompress }, response] = await Promise.all([import("woff2-encoder/decompress"), fetch(url)]);
  if (!response.ok) throw new Error(`Fetching ${url} failed: ${response.status}`);
  const sfnt = await decompress(await response.arrayBuffer());
  let binary = "";
  for (let start = 0; start < sfnt.length; start += 0x8000) {
    binary += String.fromCharCode(...sfnt.subarray(start, start + 0x8000));
  }
  return binary;
}

const BEYOND_LATIN_1 = /([^\u0000-\u007f\u00a0-\u00ff]+)/;

/**
 * The PDF's built-in fonts (Helvetica, Times, Courier) spell only Latin-1. As a
 * browser falls back glyph by glyph, set the rest of a text, such as a Greek λ
 * or a minus sign, in the embedded font.
 */
function fallBackBeyondLatin1(text: Element, family: string) {
  const walker = text.ownerDocument.createTreeWalker(text, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const parts = node.data.split(BEYOND_LATIN_1);
    if (parts.length === 1) continue;
    node.replaceWith(
      ...parts
        .map((part, index) => {
          if (index % 2 === 0) return part;
          const tspan = text.ownerDocument.createElementNS(text.namespaceURI, "tspan");
          tspan.setAttribute("font-family", `'${family}'`);
          tspan.textContent = part;
          return tspan;
        })
        .filter((part) => part !== ""),
    );
  }
}

/** An SVG file `width` × `height` CSS pixels as a PDF file, returned as a data URL. */
export async function renderChartPdf(svg: string, width: number, height: number, font: PdfFont): Promise<string> {
  const [{ jsPDF }, { svg2pdf }, fontFile] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
    trueTypeFont(webFontUrl(font.webFamily)),
  ]);
  const { format, orientation } = pdfPageFormat(width, height);
  // four decimals of a point is far finer than print; jsPDF writes sixteen unless told
  const pdf = new jsPDF({ unit: "pt", format, orientation, compress: true, floatPrecision: 4 });
  pdf.addFileToVFS("embedded-font.ttf", fontFile);
  pdf.addFont("embedded-font.ttf", font.family, "normal");

  const element = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
  for (const text of element.querySelectorAll("text")) {
    // svg2pdf.js reads a baseline from alignment-baseline only; svgcanvas writes dominant-baseline
    const baseline = text.getAttribute("dominant-baseline");
    if (baseline) text.setAttribute("alignment-baseline", baseline);
    if (fontFamilyNames(text.getAttribute("font-family") ?? "")[0] !== font.family) fallBackBeyondLatin1(text, font.family);
  }
  await svg2pdf(element, pdf, { x: 0, y: 0, width: format[0], height: format[1] });
  return pdf.output("datauristring");
}
