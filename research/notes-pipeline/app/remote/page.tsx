// next-mdx-remote/rsc: the note is read as a string and compiled at render
// time (at `next build` for a static export).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkMath from "remark-math";
import rehypeMathjax from "rehype-mathjax/svg";
import { Chart } from "@/components/chart";
import { tex } from "@/lib/tex.mjs";

export default async function Page() {
  const source = await readFile(path.join(process.cwd(), "notes/remote.mdx"), "utf8");
  return (
    <article>
      <MDXRemote
        source={source}
        components={{ Chart }}
        options={{
          mdxOptions: { remarkPlugins: [remarkMath], rehypePlugins: [[rehypeMathjax, { tex }]] },
        }}
      />
    </article>
  );
}
