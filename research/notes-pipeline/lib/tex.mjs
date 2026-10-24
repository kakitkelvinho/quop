// Shared MathJax TeX input options. Plain JSON, so Turbopack can hand them to
// the @next/mdx loader (it cannot take functions or imported plugin objects).
export const tex = {
  tags: "ams",
  macros: { ket: ["\\left|#1\\right\\rangle", 1], R: "\\mathbb{R}" },
};
