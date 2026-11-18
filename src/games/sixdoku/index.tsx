import type { GameDef } from "@/core/types";
import { AUTO_CHECK } from "@/core/settings";
import { SudokuIcon } from "@/core/Icons";
import { check, hint, initialState, isSolved, N, type SudokuPuzzle, type SudokuState } from "./engine";
import { Board } from "./Board";

function HowTo() {
  return (
    <>
      <ul className="rules">
        <li>
          <span>Fill the 6×6 grid with the digits 1 to 6.</span>
        </li>
        <li>
          <span>
            Every row, every column and every box (2 rows by 3 columns) holds each digit exactly once.
          </span>
        </li>
        <li>
          <span>
            Pick a cell, then pick a digit. Tap the same digit again to clear it. Turn on notes (the pencil) to jot down
            candidates.
          </span>
        </li>
      </ul>
      <p className="fine">
        Keyboard: arrow keys move, 1 to 6 enter a digit, Backspace erases, N toggles notes. Repeated digits show in red. Each
        puzzle has exactly one answer.
      </p>
    </>
  );
}

export const sixdoku: GameDef<SudokuPuzzle, SudokuState, number[]> = {
  id: "sixdoku",
  name: "Sixdoku",
  blurb: "Six digits, six rows, six columns, six boxes.",
  levels: [
    { id: "easy", label: "Easy", detail: "6×6" },
    { id: "medium", label: "Medium", detail: "6×6" },
    { id: "hard", label: "Hard", detail: "6×6" },
  ],
  theme: { felt: "#3a4048", feltDeep: "#2a2f35" },
  initialState,
  isSolved,
  progress: (_p, s) => ({ done: s.values.filter(Boolean).length, total: N * N }),
  hint,
  check,
  settings: [
    AUTO_CHECK,
    {
      id: "countRemaining",
      label: "Count remaining numbers",
      help: "Show on each key how many of that digit are still to place.",
      default: true,
    },
    {
      id: "highlightSections",
      label: "Highlight sections",
      help: "Shade the row, column and box of the cell you've selected.",
      default: true,
    },
  ],
  Board,
  HowTo,
  Icon: SudokuIcon,
};
