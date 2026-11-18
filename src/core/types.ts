import type { ComponentType } from "react";
import type { BasePuzzle, GameId, HintResult } from "./puzzle";
import type { SoundName } from "./sound";

export type { BasePuzzle, GameId, HintResult };

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
  Board: ComponentType<BoardProps<P, S, M>>;
  HowTo: ComponentType;
  Icon: ComponentType;
  WinBadge?: ComponentType<{ puzzle: P; state: S }>;
}
