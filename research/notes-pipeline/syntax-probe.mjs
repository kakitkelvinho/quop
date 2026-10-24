// How remark-math reads LaTeX-ish lines a note author may type.
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const probes = {
  "bare \\begin{align} (no $$)": "\\begin{align}\na &= b\n\\end{align}",
  "$$ on one line": "$$ a = b $$",
  "\\[ \\] display": "\\[ a = b \\]",
  "\\( \\) inline": "\\( a = b \\)",
  "two prices": "it costs $5 and $10",
  "escaped dollar": "it costs \\$5",
  "underscore emphasis inside maths": "$a_1 + b_1$ and $c_2$",
};
const p = unified().use(remarkParse).use(remarkMath).use(remarkRehype).use(rehypeStringify);
for (const [name, src] of Object.entries(probes)) {
  const html = String(await p.process(src));
  const kind = /math-display/.test(html) ? "display maths" : /math-inline/.test(html) ? "inline maths" : "text";
  console.log(`${name}: ${kind} -> ${html.replace(/\n/g, " ").slice(0, 90)}`);
}
