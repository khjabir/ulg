import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/`,
    name: "ulg: Unlimited Logic Games",
    short_name: "ulg",
    description: "Sumbroke, Kings, Tangle, Zap, Sixdoku and Swatches: endless logic puzzles that play offline.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef2ee",
    theme_color: "#1f5f5b",
    categories: ["games", "puzzle"],
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Sumbroke", url: `${base}/sumbroke/` },
      { name: "Kings", url: `${base}/kings/` },
      { name: "Tangle", url: `${base}/tangle/` },
      { name: "Zap", url: `${base}/zap/` },
      { name: "Sixdoku", url: `${base}/sixdoku/` },
      { name: "Swatches", url: `${base}/swatches/` },
    ],
  };
}
