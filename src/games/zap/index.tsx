import type { GameDef } from "@/core/types";
import { ZapIcon } from "@/core/Icons";
import { check, hint, initialState, isSolved, type ZapPuzzle, type ZapState } from "./engine";
import { Board } from "./Board";

function HowTo() {
  return (
    <>
      <ul className="rules">
        <li>
          <svg className="z-demo" viewBox="0 0 4 2" aria-hidden>
            <rect width="4" height="2" rx="0.25" fill="#fff8e8" />
            <polyline points="0.5,0.5 3.5,0.5 3.5,1.5 0.5,1.5" />
            <circle cx="0.5" cy="0.5" r="0.27" />
            <circle cx="0.5" cy="1.5" r="0.27" />
            <text x="0.5" y="0.6">1</text>
            <text x="0.5" y="1.6">2</text>
          </svg>
          <span>Draw one path from 1 that passes through the numbers in order and ends on the last one.</span>
        </li>
        <li>
          <span>The path must fill every cell exactly once. Reaching the last number isn&rsquo;t enough on its own.</span>
        </li>
        <li>
          <span>Move up, down, left or right, never diagonally. Thick lines are walls: go around them.</span>
        </li>
      </ul>
      <p className="fine">
        Drag from the end of your path to extend it, drag back over it to undo steps, or tap any cell on the path to cut it
        there. Keyboard: arrow keys extend or step back. A hint takes the path back to its first mistake and shows the next
        steps.
      </p>
    </>
  );
}

export const zap: GameDef<ZapPuzzle, ZapState, number[]> = {
  id: "zap",
  name: "Zap",
  blurb: "One path through every cell, numbers in order.",
  levels: [
    { id: "easy", label: "Easy", detail: "6×6" },
    { id: "medium", label: "Medium", detail: "7×7" },
    { id: "hard", label: "Hard", detail: "8×8" },
  ],
  theme: { felt: "#1f4a6e", feltDeep: "#163651" },
  initialState,
  isSolved,
  progress: (p, s) => ({ done: s.length, total: p.rows * p.cols }),
  hint,
  check,
  Board,
  HowTo,
  Icon: ZapIcon,
};
