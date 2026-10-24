// Which ordinary Markdown-with-LaTeX lines does the MDX 3 compiler reject?
// (Same compiler @next/mdx and next-mdx-remote use.)
import { compile } from "@mdx-js/mdx";
import remarkMath from "remark-math";

const probes = {
  "less-than in prose": "If x < y then done.",
  "less-than before a letter": "the set <a, b> of pairs",
  "braces in prose": "the set {1, 2} has two members",
  "HTML comment": "<!-- todo: fix sign -->",
  "maths with braces and <": "$\\frac{a}{b} < \\{x\\}$",
  "display maths": "$$\n\\begin{align} a &= b \\\\ c &< d \\end{align}\n$$",
  "LaTeX outside maths": "see \\cite{x} and \\ref{y}",
  "JSX embed": "<Chart data={[1, 2, 3]} />",
};
for (const [name, src] of Object.entries(probes)) {
  try {
    await compile(src, { remarkPlugins: [remarkMath] });
    console.log(`ok   ${name}`);
  } catch (e) {
    console.log(`FAIL ${name}: ${String(e.reason ?? e.message).split("\n")[0]}`);
  }
}
