/** Worker-safe map of every game's generator (no React, no DOM). */
import type { BasePuzzle, GameId } from "../core/puzzle";
import { generate as sumbroke, findHintStates } from "./sumbroke/engine";
import { generate as kings } from "./kings/engine";
import { generate as tangle } from "./tangle/engine";
import { generate as zap } from "./zap/engine";
import { generate as sixdoku } from "./sixdoku/engine";
import { generate as swatches } from "./swatches/engine";
import type { SumbrokePuzzle, Grid } from "./sumbroke/engine";

export const generators: Record<GameId, (level: string, seed: number) => BasePuzzle> = {
  sumbroke,
  kings,
  tangle,
  zap,
  sixdoku,
  swatches,
};

/** Hints that need real searching run in the worker too. */
export const workerHints = {
  sumbroke: (puzzle: SumbrokePuzzle, states: Grid[]) => findHintStates(puzzle, states),
};
