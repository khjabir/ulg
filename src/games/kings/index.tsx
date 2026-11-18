import type { GameDef } from "@/core/types";
import { Crown, KingsIcon } from "@/core/Icons";
import { hint, initialState, isSolved, KING, type KingsPuzzle, type KingsState } from "./engine";
import { Board, REGION_COLORS } from "./Board";

function HowTo() {
  const demo = [0, 0, 1, 2, 0, 1, 2, 2, 1];
  return (
    <>
      <ul className="rules">
        <li>
          <span>
            Place one king in every row, every column and every coloured region.
          </span>
        </li>
        <li>
          <span className="q-demo" aria-hidden>
            {demo.map((g, i) => (
              <span key={i} style={{ background: REGION_COLORS[g] }}>
                {i === 4 && <Crown className="q-king" />}
                {[0, 1, 2, 3, 5, 6, 7, 8].includes(i) && <span className="q-x" />}
              </span>
            ))}
          </span>
          <span>Kings can&rsquo;t touch each other, not even at a corner (just like kings in chess). Each king rules out its row, column, region and the eight cells around it.</span>
        </li>
        <li>
          <span>
            Tap a cell once to mark it with an X (no king here), twice for a king, three times to clear it. Drag across cells
            to mark several X&rsquo;s at once.
          </span>
        </li>
      </ul>
      <p className="fine">
        Tip: start with the smallest regions, they have the fewest choices. Keyboard: arrow keys move, Enter cycles, K places a
        king, X marks, Backspace clears. Clashing kings turn red.
      </p>
    </>
  );
}

export const kings: GameDef<KingsPuzzle, KingsState, number[]> = {
  id: "kings",
  name: "Kings",
  blurb: "One crown per row, column and colour. No touching.",
  levels: [
    { id: "easy", label: "Easy", detail: "7×7" },
    { id: "medium", label: "Medium", detail: "8×8" },
    { id: "hard", label: "Hard", detail: "9×9" },
  ],
  theme: { felt: "#4a3a6b", feltDeep: "#36294f" },
  initialState,
  isSolved,
  progress: (p, s) => ({ done: s.filter((v) => v === KING).length, total: p.n }),
  pips: true,
  hint,
  Board,
  HowTo,
  Icon: KingsIcon,
};
