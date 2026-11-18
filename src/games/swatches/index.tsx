import type { GameDef } from "@/core/types";
import { SwatchesIcon } from "@/core/Icons";
import { area, check, hint, initialState, isSolved, type SwatchesPuzzle, type SwatchesState } from "./engine";
import { Board, ClueBadge } from "./Board";

function HowTo() {
  return (
    <>
      <ul className="rules">
        <li>
          <span>Split the grid into rectangles called swatches. Swatches never overlap and cover the whole grid.</span>
        </li>
        <li>
          <span>Each swatch holds exactly one clue. A clue&rsquo;s number is the swatch&rsquo;s size in cells.</span>
        </li>
        <li>
          <span className="p-legend" aria-hidden>
            <span>
              <ClueBadge size={4} shape="square" color={2} /> square
            </span>
            <span>
              <ClueBadge size={6} shape="wide" color={3} /> wider than tall
            </span>
            <span>
              <ClueBadge size={3} shape="tall" color={0} /> taller than wide
            </span>
            <span>
              <ClueBadge size={null} shape={null} color={4} /> any rectangle
            </span>
          </span>
          <span>The clue&rsquo;s outline gives the shape. Some clues give no size, some give neither.</span>
        </li>
      </ul>
      <p className="fine">
        Drag from one corner to the opposite corner to draw a swatch. Tap a swatch to remove it. Drawing over a swatch replaces it.
        Swatches that don&rsquo;t match their clue get a red outline. Keyboard: arrows move, Enter starts and finishes a
        swatch, Delete removes one.
      </p>
    </>
  );
}

export const swatches: GameDef<SwatchesPuzzle, SwatchesState, number[]> = {
  id: "swatches",
  name: "Swatches",
  blurb: "Cut the grid into rectangles, one clue in each.",
  levels: [
    { id: "easy", label: "Easy", detail: "5×5" },
    { id: "medium", label: "Medium", detail: "6×6" },
    { id: "hard", label: "Hard", detail: "7×7" },
  ],
  theme: { felt: "#7a5a1e", feltDeep: "#5c4416" },
  initialState,
  isSolved,
  progress: (p, s) => ({ done: s.reduce((n, r) => n + area(r), 0), total: p.rows * p.cols }),
  hint,
  check,
  Board,
  HowTo,
  Icon: SwatchesIcon,
};
