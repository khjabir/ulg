"use client";

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { BoardProps } from "@/core/types";
import { Moon, Sun } from "@/core/Icons";
import { sfx } from "@/core/sound";
import { errors, MOON, N, SUN, type TanglePuzzle, type TangleState } from "./engine";

export function Board({ puzzle, state, apply, interactive, won, mark, dealing, say }: BoardProps<TanglePuzzle, TangleState, number[]>) {
  const [focus, setFocus] = useState(() => Math.max(0, puzzle.givens.findIndex((v) => !v)));
  const [nudge, setNudge] = useState<{ cell: number; k: number } | null>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const err = useMemo(() => errors(puzzle, state), [puzzle, state]);
  const marked = useMemo(() => new Set(mark ?? []), [mark]);

  const set = (i: number, v: number) => {
    if (!interactive || state[i] === v) return;
    if (puzzle.givens[i]) {
      // fixed cells can't change: wiggle and say so, instead of silently ignoring the tap
      setNudge({ cell: i, k: Date.now() });
      sfx.tap();
      say("The darker cells are part of the puzzle and can't be changed.");
      return;
    }
    const next = state.slice();
    next[i] = v;
    const before = errors(puzzle, state);
    const after = errors(puzzle, next);
    const worse = after.cells.size + after.signs.size > before.cells.size + before.signs.size;
    apply(next, { sound: worse ? "error" : v ? "place" : "erase", step: v === SUN ? 4 : 2 });
  };
  const cycle = (i: number) => set(i, state[i] === 0 ? SUN : state[i] === SUN ? MOON : 0);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (e.key in moves) {
      e.preventDefault();
      const r = Math.floor(focus / N) + moves[e.key][0];
      const c = (focus % N) + moves[e.key][1];
      if (r < 0 || r >= N || c < 0 || c >= N) return;
      setFocus(r * N + c);
      cellRefs.current[r * N + c]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cycle(focus);
    } else if (e.key === "1" || e.key.toLowerCase() === "s") set(focus, SUN);
    else if (e.key === "2" || e.key.toLowerCase() === "m") set(focus, MOON);
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") set(focus, 0);
  };

  return (
    <div className={`tray t-tray ${dealing ? "deal" : ""}`} style={{ "--n": N } as CSSProperties}>
      <div
        className="t-grid tray-grid"
        role="group"
        aria-label="Tangle board. Arrow keys move, Enter cycles sun, moon and empty, 1 places a sun, 2 a moon."
        onKeyDown={onKeyDown}
      >
        {state.map((v, i) => {
          const given = !!puzzle.givens[i];
          const label = v === SUN ? "sun" : v === MOON ? "moon" : "empty";
          return (
            <button
              ref={(el) => {
                cellRefs.current[i] = el;
              }}
              type="button"
              key={nudge?.cell === i ? `${i}-${nudge.k}` : i}
              className={["t-cell", "fx-cell", given && "given", err.cells.has(i) && "bad", marked.has(i) && "hinted", won && "winner", nudge?.cell === i && "nudge"]
                .filter(Boolean)
                .join(" ")}
              tabIndex={i === focus ? 0 : -1}
              style={{ "--d": Math.floor(i / N) + (i % N) } as CSSProperties}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${label}${given ? ", fixed" : ""}`}
              onFocus={() => setFocus(i)}
              onClick={() => {
                setFocus(i);
                cycle(i);
              }}
            >
              {v === SUN && <Sun className="t-piece" />}
              {v === MOON && <Moon className="t-piece" />}
            </button>
          );
        })}
      </div>
      {puzzle.signs.map((sg, k) => {
        const r = Math.floor(sg.a / N);
        const c = sg.a % N;
        const horizontal = sg.b === sg.a + 1;
        const style = {
          "--sx": horizontal ? c + 1 : c + 0.5,
          "--sy": horizontal ? r + 0.5 : r + 1,
        } as CSSProperties;
        return (
          <span key={k} className={`t-sign ${err.signs.has(k) ? "bad" : ""}`} style={style} aria-hidden>
            {sg.same ? "=" : "×"}
          </span>
        );
      })}
    </div>
  );
}
