// Same probe against MathJax 4 (@mathjax/src), the successor of mathjax-full.
// Forward \eqref (a reference above its \label). rehype-mathjax converts each
// formula on its own (document.convert), so a forward reference prints (???).
// MathJax's own page pipeline (document.render) recompiles formulas whose
// references were unresolved. Does that fix it at build time?
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
// MathJax 4 has no AllPackages: import each TeX package a note needs.
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js";
const AllPackages = ["base", "ams", "newcommand", "configmacros"];

const decode = (s) =>
  [...s.matchAll(/data-c="([0-9A-F]+)"/g)].map((m) => String.fromCodePoint(parseInt(m[1], 16))).join("");

const formulas = [
  [String.raw`\eqref{eq:later}`, false],
  [String.raw`\begin{equation} a = b \label{eq:first} \end{equation}`, true],
  [String.raw`\begin{equation} c = d \label{eq:later} \end{equation}`, true],
];

const adaptor = liteAdaptor();
const handler = RegisterHTMLHandler(adaptor);

// 1. Per-formula convert, as rehype-mathjax does.
{
  const doc = mathjax.document("", { InputJax: new TeX({ packages: AllPackages, tags: "ams" }), OutputJax: new SVG() });
  const out = formulas.map(([t, display]) => decode(adaptor.outerHTML(doc.convert(t, { display }))));
  console.log("convert per formula:", out.join("  |  "));
}

// 2. Whole note through document.render(), MathJax's page pipeline.
{
  const html = formulas.map(([t, d]) => (d ? `<p>\\[${t}\\]</p>` : `<p>\\(${t}\\)</p>`)).join("");
  const doc = mathjax.document(`<html><body>${html}</body></html>`, {
    InputJax: new TeX({ packages: AllPackages, tags: "ams" }),
    OutputJax: new SVG({ fontCache: "none" }),
  });
  doc.render();
  const body = adaptor.innerHTML(adaptor.body(doc.document));
  const parts = body.split("<mjx-container").slice(1).map((p) => decode(p));
  console.log("document.render():  ", parts.join("  |  "));
}
mathjax.handlers.unregister(handler);
