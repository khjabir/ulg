import type { GameDef } from "@/core/types";
import { SwatchesIcon } from "@/core/Icons";
import { area, check, hint, initialState, isSolved, type SwatchesPuzzle, type SwatchesState } from "./engine";
import { Board, ClueBadge } from "./Board";

function HowTo() {
  return (
    <>
      <ul className="rules">
        <li>
          <span>Split the grid into rectangles called swatches, each at least 2 cells. Swatches never overlap and cover the whole grid.</span>
        </li>
        <li>
          <span>Each swatch holds exactly one clue. A clue&rsquo;s number, when it has one, is the swatch&rsquo;s size in cells.</span>
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
              <ClueBadge size={5} shape={null} color={4} /> any rectangle
            </span>
            <span>
              <ClueBadge size={null} shape="wide" color={1} /> wide, any size
            </span>
            <span>
              <ClueBadge size={null} shape={null} color={6} /> anything that fits
            </span>
          </span>
          <span>
            The shape behind a clue sets the swatch&rsquo;s shape; crossed dashed bars mean any rectangle. A clue without a
            number can be any size, so work it out from what&rsquo;s left.
          </span>
        </li>
      </ul>
      <p className="fine">
        Drag across the cells to draw a swatch. Start anywhere, even on the clue, and sweep one way, then back the other way.
        A swatch stops at the next clue and at the edge of other swatches. Grab the edge of a swatch to resize it, or tap it
        to remove it. A swatch that doesn&rsquo;t match its clue gets a red outline. Keyboard: arrows move, Enter starts and finishes a
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
    { id: "hard", label: "Hard", detail: "8×8" },
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
