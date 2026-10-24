// Inspect the exported HTML: what each pipeline did with the maths and embeds.
// MathJax SVG draws glyphs as <use data-c="HEX">, so we decode those to text.
import { readFileSync } from "node:fs";

const pages = process.argv.slice(2);
for (const file of pages) {
  const html = readFileSync(file, "utf8");
  console.log(`\n== ${file} (${(html.length / 1024).toFixed(0)} KB)`);
  const svgBlocks = html.match(/<mjx-container[\s\S]*?<\/mjx-container>/g) ?? [];
  if (svgBlocks.length) {
    console.log(`mathjax containers: ${svgBlocks.length}`);
    svgBlocks.forEach((b, i) => {
      const text = [...b.matchAll(/data-c="([0-9A-F]+)"/g)]
        .map((m) => String.fromCodePoint(parseInt(m[1], 16)))
        .join("");
      const ids = [...b.matchAll(/id="(mjx-eqn[^"]*)"/g)].map((m) => decodeURIComponent(m[1]));
      const links = [...b.matchAll(/href="#(mjx-eqn[^"]*)"/g)].map((m) => decodeURIComponent(m[1]));
      const err = /data-mml-node="merror"/.test(b) ? " MERROR" : "";
      console.log(`  [${i}] ${text.slice(0, 70)}${err}${ids.length ? " ids=" + ids : ""}${links.length ? " links=" + links : ""}`);
    });
  }
  const katex = html.match(/class="katex(-display)?"/g)?.length ?? 0;
  if (katex) {
    console.log(`katex spans: ${katex}; eqn-num: ${html.match(/eqn-num/g)?.length ?? 0}`);
    for (const m of html.matchAll(/katex-error"[^>]*title="([^"]*)"/g)) console.log("  katex-error:", m[1].slice(0, 120));
    for (const m of html.matchAll(/<span class="katex-mathml"><math[^>]*>[\s\S]*?<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)) {
      if (/color:#cc0000|mathcolor="#cc0000"/.test(m[0])) console.log("  red:", m[1].slice(0, 80));
    }
    const red = html.match(/mathcolor="#cc0000"[^>]*>[^<]*/g) ?? [];
    red.forEach((r) => console.log("  undefined control sequence:", r.replace(/.*>/, "")));
  }
  for (const m of html.matchAll(/data-chart="([^"]*)"/g)) console.log(`  chart props: ${m[1].replace(/&quot;/g, '"')}`);
  for (const m of html.matchAll(/<figcaption>([\s\S]*?)<\/figcaption>/g)) console.log(`  chart caption: ${m[1].replace(/<!-- -->/g, "")}`);
  console.log(`  prose check: lt=${html.includes("x &lt; y")} brace=${html.includes("{brace}")} MARKER=${(html.match(/MARKER-\d+/) ?? ["none"])[0]}`);
}
