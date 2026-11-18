// Runs after `next build`: fills out/sw.js with every exported file so the game
// works offline from the very first visit.
import { createHash } from "node:crypto";
import { copyFile, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("out");

// Static hosts serve out/404.html for unknown addresses (it also forwards old game URLs).
try {
  await stat(path.join(OUT, "404.html"));
} catch {
  await copyFile(path.join(OUT, "404/index.html"), path.join(OUT, "404.html")).catch(() => undefined);
}
const BASE = process.env.BASE_PATH ?? "";
const SKIP = new Set(["sw.js", "_not-found.html", "_not-found.txt"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const files = (await walk(OUT))
  .map((f) => path.relative(OUT, f).split(path.sep).join("/"))
  // Launch images and store screenshots are only fetched at install time: don't precache them.
  .filter((f) => !SKIP.has(f) && !f.startsWith("_not-found") && !f.endsWith(".map"))
  .filter((f) => !f.startsWith("splash/") && !f.startsWith("screenshots/"))
  .sort();

const hash = createHash("sha256");
for (const f of files) {
  hash.update(f);
  hash.update(await readFile(path.join(OUT, f)));
}
const version = hash.digest("hex").slice(0, 12);

const urls = files.map((f) => `${BASE}/${f}`);
// pretty routes for each page: /zap/ as well as /zap/index.html
for (const f of files) {
  if (f.endsWith("index.html")) urls.push(`${BASE}/${f.slice(0, -"index.html".length)}`);
}

const swPath = path.join(OUT, "sw.js");
let sw = await readFile(swPath, "utf8");
sw = sw
  .replace(/const VERSION = ".*?";/, `const VERSION = ${JSON.stringify(version)};`)
  .replace(/const PRECACHE = \[\];/, `const PRECACHE = ${JSON.stringify(urls)};`)
  .replace(/const BASE = ".*?";/, `const BASE = ${JSON.stringify(BASE)};`);
await writeFile(swPath, sw);

console.log(`sw.js: precaching ${urls.length} files, version ${version}`);
