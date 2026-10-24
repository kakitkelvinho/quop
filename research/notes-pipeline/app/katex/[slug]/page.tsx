import "katex/dist/katex.min.css";
import { notes } from "@/lib/notes";
import { renderMarkdown } from "@/lib/markdown";

export function generateStaticParams() {
  return Object.keys(notes).map((slug) => ({ slug }));
}
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <article>{renderMarkdown(notes[slug], "katex")}</article>;
}
