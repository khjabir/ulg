import type { Metadata } from "next";

/** Server-safe names for routes and page titles (keep in sync with each game's index.tsx). */
export const GAME_META = {
  sumbroke: { name: "Sumbroke", blurb: "Merge matching numbers until only one is left." },
  kings: { name: "Kings", blurb: "One crown per row, column and colour. No touching." },
  tangle: { name: "Tangle", blurb: "Suns and moons, three of each per line, never three in a row." },
  zap: { name: "Zap", blurb: "One path through every cell, numbers in order." },
  sixdoku: { name: "Sixdoku", blurb: "Six digits, six rows, six columns, six boxes." },
  swatches: { name: "Swatches", blurb: "Cut the grid into rectangles, one clue in each." },
} as const;

export type MetaId = keyof typeof GAME_META;
export const GAME_IDS = Object.keys(GAME_META) as MetaId[];

/** Page title and description for a game's route. */
export const gameMetadata = (id: MetaId): Metadata => ({
  title: `${GAME_META[id].name} | ULG`,
  description: GAME_META[id].blurb,
});

/** Earlier ids, so saved progress carries over after each rename. */
export const LEGACY_IDS: Record<string, MetaId> = {
  queens: "kings",
  queenbroke: "kings",
  tango: "tangle",
  tangobroke: "tangle",
  zip: "zap",
  zipbroke: "zap",
  "mini-sudoku": "sixdoku",
  sudobroke: "sixdoku",
  patches: "swatches",
  patchbroke: "swatches",
};
