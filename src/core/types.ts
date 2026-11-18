import type { ComponentType } from "react";
import type { BasePuzzle, GameId, HintResult, Problem } from "./puzzle";
import type { SoundName } from "./sound";

export type { BasePuzzle, GameId, HintResult, Problem };

/** How a move should sound: a sound name (default "place"), "none", and a pitch step. */
export interface MoveFx {
  sound?: SoundName | "none";
  step?: number;
}

export interface Level {
  id: string;
  label: string;
  detail: string;
}

export interface BoardProps<P, S, M> {
  puzzle: P;
  state: S;
  /** Commit a new state (one undo step), with an optional sound. */
  apply: (next: S, fx?: MoveFx) => void;
  interactive: boolean;
  won: boolean;
  /** Cells or move highlighted by the last hint. */
  mark: M | null;
  /** True for a moment after a fresh puzzle appears. */
  dealing: boolean;
  /** Show a short message under the board. */
  say: (text: string, alert?: boolean) => void;
  /** Cells the current problem points at (see GameDef.check). Give them the `flagged` class. */
  flagged: ReadonlySet<number>;
}

export interface GameDef<P extends BasePuzzle = any, S = any, M = any> {
  id: GameId;
  name: string;
  /** One line for the hub. */
  blurb: string;
  levels: Level[];
  theme: { felt: string; feltDeep: string };
  initialState(p: P): S;
  isSolved(p: P, s: S): boolean;
  progress(p: P, s: S): { done: number; total: number };
  /** Show progress as one pip per step (small totals) instead of a bar. */
  pips?: boolean;
  hint(p: P, history: S[]): HintResult<S, M> | Promise<HintResult<S, M>>;
  /**
   * Look for a broken rule or a dead end after every move. Return null when all is
   * well. Keep it fast and never use the solution: only report what the player could
   * work out from the board. The shell shows the message, buzzes once when a new
   * problem appears, shakes the board when stuck, and passes `cells` to the board.
   */
  check?(p: P, s: S): Problem | null;
  Board: ComponentType<BoardProps<P, S, M>>;
  HowTo: ComponentType;
  Icon: ComponentType;
  WinBadge?: ComponentType<{ puzzle: P; state: S }>;
}
