import type { MetadataRoute } from "next";
import { GAME_IDS, GAME_META } from "@/games/meta";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/`,
    name: "Refill: Bottomless Logic Puzzles",
    short_name: "Refill",
    description: `Endless logic puzzles that play offline: ${GAME_IDS.map((id) => GAME_META[id].name).join(", ")}. Every board is new, and every one has exactly one answer.`,
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    // Opening the app again (or a shortcut) returns to the open window instead of a new one.
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    orientation: "portrait",
    background_color: "#eef2ee",
    theme_color: "#1f5f5b",
    categories: ["games", "puzzle"],
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android shows these in its install sheet, like a store listing.
    screenshots: [
      { src: `${base}/screenshots/hub.webp`, sizes: "780x1688", type: "image/webp", form_factor: "narrow", label: "Pick a game" },
      { src: `${base}/screenshots/zap.webp`, sizes: "780x1688", type: "image/webp", form_factor: "narrow", label: "Zap: one path through every cell" },
      { src: `${base}/screenshots/kings.webp`, sizes: "780x1688", type: "image/webp", form_factor: "narrow", label: "Kings: a crown in every row, column and colour" },
      { src: `${base}/screenshots/sixdoku.webp`, sizes: "780x1688", type: "image/webp", form_factor: "narrow", label: "Sixdoku: mini sudoku" },
    ],
    // Android shows up to four shortcuts on a long press of the app icon.
    shortcuts: GAME_IDS.map((id) => ({ name: GAME_META[id].name, url: `${base}/${id}/` })),
  };
}
