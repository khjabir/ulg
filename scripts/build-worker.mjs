// Bundles the puzzle engine worker into public/puzzle-worker.js (served as a plain file,
// so it works from any host path and offline). Runs before `next dev` and `next build`.
import { build } from "esbuild";

await build({
  entryPoints: ["src/worker/puzzle.worker.ts"],
  outfile: "public/puzzle-worker.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  legalComments: "none",
});
console.log("public/puzzle-worker.js built");
