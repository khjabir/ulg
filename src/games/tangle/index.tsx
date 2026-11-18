import type { GameDef } from "@/core/types";
import { AUTO_CHECK } from "@/core/settings";
import { Moon, Sun, TangleIcon } from "@/core/Icons";
import { check, hint, initialState, isSolved, N, type TanglePuzzle, type TangleState } from "./engine";
import { Board } from "./Board";

const S = () => <Sun className="t-piece" />;
const M = () => <Moon className="t-piece" />;

function HowTo() {
  return (
    <>
      <ul className="rules">
        <li>
          <span>Fill every cell with a sun or a moon.</span>
        </li>
        <li>
          <span className="t-demo" aria-hidden>
            <span><S /></span>
            <span><S /></span>
            <span className="t-demo-no"><S /></span>
          </span>
          <span>Never three of the same side by side, across or down.</span>
        </li>
        <li>
          <span className="t-demo" aria-hidden>
            <span><S /></span>
            <span><M /></span>
            <span><S /></span>
            <span><M /></span>
            <span><M /></span>
            <span><S /></span>
          </span>
          <span>Each row and each column holds three suns and three moons.</span>
        </li>
        <li>
          <span className="t-demo" aria-hidden>
            <span><S /></span>
            <b>=</b>
            <span><S /></span>
            <span className="t-demo-gap" />
            <span><S /></span>
            <b>×</b>
            <span><M /></span>
          </span>
          <span>
            <b>=</b> joins cells that match. <b>×</b> joins cells that are opposite.
          </span>
        </li>
      </ul>
      <p className="fine">
        Tap a cell for a sun, again for a moon, a third time to clear it. Keyboard: arrows move, 1 for sun, 2 for moon, Backspace
        clears. Broken rules show in red. Every puzzle has exactly one answer, no guessing needed.
      </p>
    </>
  );
}

export const tangle: GameDef<TanglePuzzle, TangleState, number[]> = {
  id: "tangle",
  name: "Tangle",
  blurb: "Suns and moons, three of each per line, never three in a row.",
  levels: [
    { id: "easy", label: "Easy", detail: "6×6" },
    { id: "medium", label: "Medium", detail: "6×6" },
    { id: "hard", label: "Hard", detail: "6×6" },
  ],
  theme: { felt: "#6b2f4f", feltDeep: "#4f223a" },
  initialState,
  isSolved,
  progress: (_p, s) => ({ done: s.filter(Boolean).length, total: N * N }),
  hint,
  check,
  settings: [AUTO_CHECK],
  Board,
  HowTo,
  Icon: TangleIcon,
};
