import type { GameDef } from "@/core/types";
import { SumbrokeIcon } from "@/core/Icons";
import { requestWorkerHint } from "@/core/workerClient";
import { isSolved, pieceCount, type Grid, type Hint, type Move, type SumbrokePuzzle } from "./engine";
import { Board } from "./Board";
import { HowTo } from "./HowTo";
import { Tile } from "./Tile";

export const sumbroke: GameDef<SumbrokePuzzle, Grid, Move> = {
  id: "sumbroke",
  name: "Sumbroke",
  blurb: "Merge matching numbers until only one is left.",
  levels: [
    { id: "easy", label: "Easy", detail: "3×3" },
    { id: "medium", label: "Medium", detail: "4×4" },
    { id: "hard", label: "Hard", detail: "5×5" },
  ],
  theme: { felt: "#1f5f5b", feltDeep: "#174a47" },
  initialState: (p) => p.grid,
  isSolved: (_p, g) => isSolved(g),
  progress: (p, g) => ({ done: p.rows * p.cols - pieceCount(g), total: p.rows * p.cols - 1 }),
  pips: true,
  async hint(p, history) {
    const h = await requestWorkerHint<Hint>("sumbroke", p, history);
    const back = history.length - 1 - h.rewindTo;
    return {
      keep: h.rewindTo + 1,
      mark: h.move,
      message:
        back > 0
          ? `Went back ${back} ${back === 1 ? "move" : "moves"}, to the last position that can still be solved. Merge the highlighted tiles next.`
          : "Merge the highlighted tiles next.",
    };
  },
  Board,
  HowTo,
  Icon: SumbrokeIcon,
  WinBadge: ({ state }) => <Tile value={state.find((c) => c > 0) ?? 0} />,
};
