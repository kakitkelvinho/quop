// What KaTeX 0.19 does with each construct a note needs, one call at a time
// (rehype-katex calls katex.renderToString once per formula with shared options).
import katex from "katex";

const probes = {
  align: String.raw`\begin{align} a &= b \\ c &= d \end{align}`,
  "equation+label": String.raw`\begin{equation} E = mc^2 \label{eq:e} \end{equation}`,
  eqref: String.raw`\eqref{eq:e}`,
  "newcommand (same formula)": String.raw`\newcommand{\half}{\tfrac12} \half`,
  "newcommand used in a later formula": String.raw`\half`,
  "config macros": String.raw`\ket{\psi}`,
};
const shared = { macros: { "\\ket": "\\left|#1\\right\\rangle" } };
for (const [name, tex] of Object.entries(probes)) {
  try {
    const html = katex.renderToString(tex, { ...shared, displayMode: true, throwOnError: true });
    console.log(`ok   ${name}${html.includes("eqn-num") ? " (CSS-counter number)" : ""}`);
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
  }
}
// globalGroup: \newcommand writes into the shared macros object, so it then
// leaks into every later formula, in every note processed by the same plugin.
const leaky = { macros: {}, globalGroup: true };
katex.renderToString(String.raw`\newcommand{\half}{\tfrac12}`, leaky);
console.log("globalGroup: later formula sees \\half:", !!katex.renderToString(String.raw`\half`, leaky), Object.keys(leaky.macros));
