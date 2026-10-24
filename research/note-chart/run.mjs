// Drives research/note-chart/page.tsx in a static export (kakitkelvinho/quop#300).
// usage: node research/note-chart/run.mjs [outDir=out] [cpuThrottle=1]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const outDir = process.argv[2] ?? "out";
const throttle = Number(process.argv[3] ?? 1);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };

const server = createServer(async (req, res) => {
  let path = join(outDir, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try {
    if ((await stat(path)).isDirectory()) path = join(path, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(4318, r));
const base = "http://localhost:4318/research-note-chart/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });
const cdp = await page.context().newCDPSession(page);
if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`${m.type()}: ${m.text()}`));

// in the page: which Chart instance a container holds, and a per-frame trace of one point
const helpers = () => {
  window.__chart = (sel) => window.ChartJS.getChart(document.querySelector(`${sel} canvas`));
  window.__trace = (sel, ms) =>
    new Promise((resolve) => {
      const out = [];
      const t0 = performance.now();
      let last = t0;
      const tick = () => {
        const now = performance.now();
        const c = window.__chart(sel);
        const p = c?.getDatasetMeta(0).data[150];
        out.push({ t: Math.round(now - t0), dt: +(now - last).toFixed(1), id: c?.id, y: p ? +p.y.toFixed(2) : null });
        last = now;
        if (now - t0 < ms) requestAnimationFrame(tick);
        else resolve(out);
      };
      requestAnimationFrame(tick);
    });
  // time from setState to the frame after React has committed and Chart.js has run its update
  window.__stepCost = async (k) => {
    const t0 = performance.now();
    window.__step(k);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t0;
  };
};

const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1); };
const results = { throttle };

// 1. All three on one page: remount and tween behaviour
await page.goto(base, { waitUntil: "networkidle" });
await page.evaluate(helpers);
await page.waitForTimeout(1500); // let the first-load animation finish
for (const sel of ["#isc", "#isc-stable", "#bare"]) {
  const before = await page.evaluate((s) => ({ id: window.__chart(s).id, y: window.__chart(s).getDatasetMeta(0).data[150].y }), sel);
  const [trace] = await Promise.all([page.evaluate((s) => window.__trace(s, 1200), sel), page.evaluate(() => window.__step((window.__k = (window.__k ?? 0) + 1)))]);
  const ys = trace.map((f) => f.y);
  const finalY = ys.at(-1);
  const distinct = new Set(ys).size;
  results[sel] = {
    chartIdBefore: before.id,
    chartIdAfter: trace.at(-1).id,
    remounted: before.id !== trace.at(-1).id,
    yBefore: +before.y.toFixed(2),
    yFirstFrame: ys[0],
    yFinal: finalY,
    distinctYOverFrames: distinct,
    framesToSettle: trace.findIndex((f) => f.y === finalY),
    frames: trace.length,
    // every 4th frame: [ms, chart id, y px of series 1 point 150]
    sample: trace.filter((_, i) => i % 4 === 0).map((f) => [f.t, f.id, f.y]),
  };
  // reset so the next chart starts from frame 0 too
  await page.evaluate(() => { window.__k = 0; window.__step(0); });
  await page.waitForTimeout(1500);
}

// 2. Unlabelled datasets on the bare chart: does react-chartjs-2 keep the dataset objects?
await page.evaluate(() => window.__setLabelled(false));
await page.waitForTimeout(1500);
{
  const metaBefore = await page.evaluate(() => { const c = window.__chart("#bare"); window.__m = [0, 1, 2].map((i) => c.getDatasetMeta(i)); return c.getDatasetMeta(1).data[150].y; });
  const [trace] = await Promise.all([page.evaluate(() => window.__trace("#bare", 1200)), page.evaluate(() => window.__step(1))]);
  const same = await page.evaluate(() => { const c = window.__chart("#bare"); return [0, 1, 2].map((i) => c.getDatasetMeta(i) === window.__m[i]); });
  results.unlabelled = { sameMetaPerDataset: same, distinctYds0: new Set(trace.map((f) => f.y)).size, yBeforeDs1: +metaBefore.toFixed(2) };
}
await page.evaluate(() => { window.__setLabelled(true); window.__step(0); });

// 3. Costs, one chart per page
for (const only of ["isc", "stable", "bare"]) {
  await page.goto(`${base}?only=${only}`, { waitUntil: "networkidle" });
  await page.evaluate(helpers);
  await page.waitForTimeout(1500);
  const sel = only === "stable" ? "#isc-stable" : `#${only}`;
  const step = [];
  for (let k = 1; k <= 12; k++) {
    step.push(await page.evaluate((kk) => window.__stepCost(kk), k));
    await page.waitForTimeout(1100);
  }
  // per-frame cadence while an animation runs
  const [trace] = await Promise.all([page.evaluate((s) => window.__trace(s, 1000), sel), page.evaluate(() => window.__step(20))]);
  const dts = trace.slice(1).map((f) => f.dt);
  await page.waitForTimeout(1100);
  // raw Chart.js costs on the chart that ends up on the page
  const raw = await page.evaluate((s) => {
    const c = window.__chart(s);
    const time = (n, fn) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(i); return (performance.now() - t0) / n; };
    const draw = time(50, () => c.draw());
    const updateNone = time(30, (i) => {
      c.data.datasets.forEach((d, j) => { d.data = d.data.map((p) => ({ x: p.x, y: p.y * (1 + 0.001 * ((i + j) % 3 - 1)) })); });
      c.update("none");
    });
    return { drawMs: +draw.toFixed(2), updateNoneMs: +updateNone.toFixed(2), points: c.data.datasets.reduce((n, d) => n + d.data.length, 0) };
  }, sel);
  results[`cost:${only}`] = { stepToFrameMs: { p50: pct(step, 0.5), max: pct(step, 1) }, frameDtDuringAnimMs: { p50: pct(dts, 0.5), p95: pct(dts, 0.95), max: pct(dts, 1), frames: dts.length }, ...raw };
}

results.errors = errors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
server.close();
