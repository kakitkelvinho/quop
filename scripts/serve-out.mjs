// Serves the static export in out/ the way GitHub Pages does: a folder
// opens its index.html, and anything missing gets 404.html with status 404.
// BASE_PATH mounts it under the path the build was made for (next.config.ts
// builds under /<repo> on GitHub Actions). The Playwright UI tests start
// this; run it by hand with `node scripts/serve-out.mjs` after `npx next build`.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(import.meta.dirname, "..", "out");
const port = Number(process.env.PORT ?? 3100);
const basePath = process.env.BASE_PATH ?? "";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

async function findFile(urlPath) {
  if (!urlPath.startsWith(`${basePath}/`)) return null;
  urlPath = urlPath.slice(basePath.length);
  const path = normalize(join(root, decodeURIComponent(urlPath)));
  if (!path.startsWith(root)) return null;
  try {
    const info = await stat(path);
    if (info.isFile()) return path;
    if (info.isDirectory()) {
      const index = join(path, "index.html");
      if ((await stat(index)).isFile()) return index;
    }
  } catch {
    // missing: falls through to the 404 page
  }
  return null;
}

createServer(async (request, response) => {
  const urlPath = new URL(request.url ?? "/", "http://localhost").pathname;
  const file = await findFile(urlPath);
  const status = file ? 200 : 404;
  const path = file ?? join(root, "404.html");
  response.writeHead(status, {
    "Content-Type": types[extname(path)] ?? "application/octet-stream",
  });
  response.end(await readFile(path));
}).listen(port, () => {
  console.log(`Serving out/ at http://localhost:${port}${basePath}/`);
});
