// Bundles a TypeScript script with esbuild and runs it in Node: node scripts/run-ts.mjs file.ts
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const entry = process.argv[2];
const outfile = path.join(tmpdir(), `ulg-${path.basename(entry, ".ts")}-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile, logLevel: "warning" });
await import(pathToFileURL(outfile).href);
