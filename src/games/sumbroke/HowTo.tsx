import { plusWild, timesWild } from "./engine";
import { Tile } from "./Tile";

const Mini = ({ v }: { v: number }) => (
  <span className={`mini ${v === 0 ? "empty" : ""}`}>{v !== 0 && <Tile value={v} />}</span>
);

const Arrow = () => (
  <span className="demo-arrow" aria-hidden>
    →
  </span>
);

export function HowTo() {
  return (
    <>
      <ul className="rules">
        <li>
          <span className="demo sb-demo" aria-hidden>
            <Mini v={4} />
            <Mini v={4} />
            <Arrow />
            <Mini v={8} />
          </span>
          <span>Drag a number onto a neighbour with the same number. They merge into their sum.</span>
        </li>
        <li>
          <span className="demo sb-demo" aria-hidden>
            <Mini v={5} />
            <Mini v={plusWild(3)} />
            <Arrow />
            <Mini v={8} />
          </span>
          <span>
            Gold tiles are wildcards. They merge with any number: <b>+3</b> adds 3, <b>×2</b> doubles. Each one works once.
          </span>
        </li>
        <li>
          <span className="demo sb-demo" aria-hidden>
            <Mini v={2} />
            <Mini v={timesWild(2)} />
            <Arrow />
            <Mini v={0} />
            <Mini v={4} />
          </span>
          <span>The cell you drag from stays empty. Nothing slides into the gap.</span>
        </li>
        <li>
          <span>
            Only tiles side by side or above and below can merge, never diagonally. Leave a single number on the board to
            win.
          </span>
        </li>
      </ul>
      <p className="fine">
        Prefer tapping? Tap a tile, then tap the neighbour to merge into. On a keyboard, use the arrow keys to move, Enter to
        pick up a tile and an arrow key to merge it. Stuck? A hint takes you back to your last good position and shows the
        next merge.
      </p>
    </>
  );
}
