import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Shown in the app menu, so players can tell which version they're on.
const version = (JSON.parse(readFileSync("package.json", "utf8")) as { version?: string }).version ?? "0.0.0";
const builtOn = new Date().toISOString().slice(0, 10);

// Set BASE_PATH=/repo-name when hosting under a sub-path (e.g. GitHub Pages project sites).
const basePath = process.env.BASE_PATH ?? "";
// RELATIVE_ASSETS=1 builds a copy that runs from any folder (e.g. opened from a sub-path).
const relative = process.env.RELATIVE_ASSETS === "1";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  ...(relative ? { assetPrefix: "." } : {}),
  images: { unoptimized: true },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_RELATIVE_ASSETS: relative ? "1" : "",
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_BUILD_DATE: builtOn,
  },
};

export default nextConfig;
