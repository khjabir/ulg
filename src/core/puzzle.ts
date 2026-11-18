/** Worker-safe shared types. */

export type GameId = "sumbroke" | "kings" | "tangle" | "zap" | "sixdoku" | "swatches";

export interface BasePuzzle {
  game: GameId;
  level: string;
  seed: number;
}

/**
 * What a hint does to the player's history: keep the first `keep` states (rewind),
 * then optionally push `state`, and highlight `mark`.
 */
export interface HintResult<S, M> {
  keep: number;
  state?: S;
  mark?: M | null;
  message: string;
}
