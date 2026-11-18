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

/**
 * Something on the board the player should know about, found by a game's `check`.
 *  - "rule": a rule is broken right now. Fixing the highlighted cells clears it.
 *  - "stuck": no rule is broken yet, but the board can't be finished from here
 *    without taking something back (a dead end, no moves left, no room left).
 */
export interface Problem {
  kind: "rule" | "stuck";
  /** One or two short sentences: what's wrong, then how to get out of it. */
  message: string;
  /** Cell indexes to highlight on the board. */
  cells: number[];
}
