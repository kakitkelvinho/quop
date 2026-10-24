import createMDX from "@next/mdx";
import { tex } from "./lib/tex.mjs";

const withMDX = createMDX({
  options: {
    // Strings, not imports: Turbopack (the default bundler in Next 16) only
    // accepts serialisable plugin names and options.
    remarkPlugins: ["remark-math"],
    rehypePlugins: [["rehype-mathjax/svg", { tex }]],
  },
});

export default withMDX({
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  pageExtensions: ["ts", "tsx", "mdx"],
  transpilePackages: ["next-mdx-remote"],
  // mathjax-full 3 finds its version with eval("require") + __dirname, which
  // breaks once bundled; load it from node_modules instead.
  serverExternalPackages: ["mathjax-full"],
  turbopack: {
    root: import.meta.dirname,
    // `import x from "./note.md"` gives the file's text, and puts the note in
    // the module graph so `next dev` sees edits to it.
    rules: { "*.md": { type: "text" } },
  },
});
