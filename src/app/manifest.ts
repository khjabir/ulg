import type { MetadataRoute } from "next";
import { GAME_IDS, GAME_META } from "@/games/meta";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/`,
    name: "ULG: Unlimited Logic Games",
    short_name: "ULG",
    description: `Endless logic puzzles that play offline: ${GAME_IDS.map((id) => GAME_META[id].name).join(", ")}.`,
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
    // Android shows up to four shortcuts on a long press of the app icon.
    shortcuts: GAME_IDS.map((id) => ({ name: GAME_META[id].name, url: `${base}/${id}/` })),
  };
}
