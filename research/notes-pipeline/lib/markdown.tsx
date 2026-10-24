// Plain-Markdown pipeline: remark (parse, GFM, math, directives) -> rehype
// (MathJax SVG or KaTeX) -> React elements via hast-util-to-jsx-runtime.
// Runs in a Server Component, so at `next build` it runs once per note.
import { unified, type PluggableList } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeMathjax from "rehype-mathjax/svg";
import rehypeKatex from "rehype-katex";
import { visit } from "unist-util-visit";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import type { Root } from "mdast";
import { Chart } from "@/components/chart";
import { tex } from "@/lib/tex.mjs";

// Components a note may embed. Anything else stays a plain <div>.
const EMBEDS = new Set(["chart"]);

// `::chart{data="1,2,3"}` and ```` ```chart {json} ```` both become a hast
// element named `chart` whose properties are the props.
function remarkEmbeds() {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (
        (node.type === "leafDirective" || node.type === "containerDirective") &&
        EMBEDS.has(node.name)
      ) {
        node.data = { hName: node.name, hProperties: { ...node.attributes } };
      }
      if (node.type === "code" && node.lang && EMBEDS.has(node.lang) && parent && index != null) {
        parent.children[index] = {
          type: "paragraph",
          children: [],
          data: { hName: node.lang, hProperties: { json: node.value } },
        };
      }
    });
  };
}

function ChartEmbed(props: { data?: string; title?: string; json?: string }) {
  const p = props.json ? JSON.parse(props.json) : props;
  return <Chart data={p.data} title={p.title} />;
}

export function renderMarkdown(source: string, maths: "mathjax" | "katex" = "mathjax") {
  const rehypeMaths: PluggableList =
    maths === "mathjax" ? [[rehypeMathjax, { tex }]] : [[rehypeKatex, { macros: {} }]];
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(remarkEmbeds)
    .use(remarkRehype)
    .use(rehypeMaths);
  const hast = processor.runSync(processor.parse(source));
  return toJsxRuntime(hast, {
    Fragment,
    jsx,
    jsxs,
    components: { chart: ChartEmbed } as never,
  });
}
