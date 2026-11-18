import type { NextConfig } from "next";

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
  },
};

export default nextConfig;
