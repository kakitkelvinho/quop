// Edit-and-preview loop under `next dev` (Turbopack). Run `next dev -p 3456`
// first. For each pipeline: time the first (cold) request, then edit the note
// and time (a) whether the dev server pushes an HMR message to an open page,
// and (b) how long until a reload shows the edit.
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3456";
const cases = [
  { name: "plain md + MathJax (import.meta.glob)", url: "/md/demo/", file: "notes/demo.md" },
  { name: "@next/mdx", url: "/mdx/", file: "notes/demo.mdx" },
  { name: "next-mdx-remote/rsc (fs read)", url: "/remote/", file: "notes/remote.mdx" },
];

const get = async (url) => (await fetch(BASE + url)).text();
const marker = (html) => (html.match(/MARKER-\d+/) ?? ["none"])[0];

function openHmr() {
  const ws = new WebSocket(BASE.replace("http", "ws") + "/_next/hmr");
  const events = [];
  ws.onmessage = (m) => events.push({ t: performance.now(), data: String(m.data).slice(0, 120) });
  return new Promise((r, j) => { ws.onopen = () => r({ ws, events }); setTimeout(() => j(new Error("HMR socket did not open")), 10000); });
}

let n = 1;
for (const c of cases) {
  let t = performance.now();
  let html = await get(c.url);
  const cold = performance.now() - t;
  t = performance.now();
  await get(c.url);
  const warm = performance.now() - t;

  const { ws, events } = await openHmr();
  await new Promise((r) => setTimeout(r, 1500));
  events.length = 0;

  const src = readFileSync(c.file, "utf8");
  const next = `MARKER-${++n}`;
  writeFileSync(c.file, src.replace(/MARKER-\d+/, next));
  const edited = performance.now();
  await new Promise((r) => setTimeout(r, 3000));
  const pushes = events.filter((e) => !/"ping"|turbopack-connected|"sync"/.test(e.data));

  t = performance.now();
  html = await get(c.url);
  const reload = performance.now() - t;
  ws.close();

  console.log(
    `${c.name}: cold ${cold.toFixed(0)} ms, warm ${warm.toFixed(0)} ms; ` +
      `after edit: ${pushes.length ? `HMR push after ${(pushes[0].t - edited).toFixed(0)} ms (${pushes.map((p) => p.data.slice(0, 50)).join(" | ")})` : "no HMR push"}; ` +
      `reload ${reload.toFixed(0)} ms shows ${marker(html)} (want ${next})`,
  );
}
for (const c of cases) writeFileSync(c.file, readFileSync(c.file, "utf8").replace(/MARKER-\d+/, "MARKER-1"));
process.exit(0);
