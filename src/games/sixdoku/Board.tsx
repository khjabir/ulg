"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { BoardProps } from "@/core/types";
import { EraseIcon, PencilIcon } from "@/core/Icons";
import { sfx } from "@/core/sound";
import { boxOf, BOX_C, BOX_R, conflicts, N, placeDigit, type SudokuPuzzle, type SudokuState } from "./engine";

const EDGE = "#2c2f35";

export function Board({ puzzle, state, apply, interactive, won, mark, dealing, say, flagged }: BoardProps<SudokuPuzzle, SudokuState, number[]>) {
  const [sel, setSel] = useState(() => Math.max(0, puzzle.givens.findIndex((v) => !v)));
  const [notesMode, setNotesMode] = useState(false);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const bad = useMemo(() => conflicts(state.values), [state.values]);
  const marked = useMemo(() => new Set(mark ?? []), [mark]);
  const selDigit = state.values[sel];

  useEffect(() => {
    if (mark?.length) setSel(mark[0]);
  }, [mark]);

  const edges = useMemo(
    () =>
      Array.from({ length: N * N }, (_, i) => {
        const r = Math.floor(i / N);
        const c = i % N;
        const s: string[] = [];
        if (c % BOX_C === BOX_C - 1 && c < N - 1) s.push(`inset -0.45cqi 0 0 ${EDGE}`);
        if (c % BOX_C === 0 && c > 0) s.push(`inset 0.45cqi 0 0 ${EDGE}`);
        if (r % BOX_R === BOX_R - 1 && r < N - 1) s.push(`inset 0 -0.45cqi 0 ${EDGE}`);
        if (r % BOX_R === 0 && r > 0) s.push(`inset 0 0.45cqi 0 ${EDGE}`);
        return s.join(", ");
      }),
    [],
  );

  const input = (d: number) => {
    if (!interactive) return;
    if (puzzle.givens[sel]) {
      sfx.tap();
      say("That digit is part of the puzzle. Pick an empty cell.");
      return;
    }
    if (notesMode && d && !state.values[sel]) {
      const notes = state.notes.slice();
      notes[sel] ^= 1 << d;
      apply({ values: state.values, notes }, { sound: "mark" });
      return;
    }
    if (!d) {
      if (state.values[sel]) apply(placeDigit(state, sel, 0), { sound: "erase" });
      else if (state.notes[sel]) {
        const notes = state.notes.slice();
        notes[sel] = 0;
        apply({ values: state.values, notes }, { sound: "erase" });
      }
      return;
    }
    const value = state.values[sel] === d ? 0 : d;
    const next = placeDigit(state, sel, value);
    const clash = value !== 0 && conflicts(next.values).has(sel);
    apply(next, { sound: value === 0 ? "erase" : clash ? "error" : "place", step: d });
  };

  const select = (i: number) => {
    setSel(i);
    cellRefs.current[i]?.focus();
    sfx.select();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (e.key in moves) {
      e.preventDefault();
      const r = Math.floor(sel / N) + moves[e.key][0];
      const c = (sel % N) + moves[e.key][1];
      if (r >= 0 && r < N && c >= 0 && c < N) select(r * N + c);
    } else if (/^[1-6]$/.test(e.key)) {
      input(Number(e.key));
    } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      e.preventDefault();
      input(0);
    } else if (e.key.toLowerCase() === "n") {
      setNotesMode((m) => !m);
    }
  };

  const remaining = (d: number) => N - state.values.filter((v) => v === d).length;

  return (
    <div className="s-wrap" onKeyDown={onKeyDown}>
      <div className={`tray s-tray ${dealing ? "deal" : ""}`} style={{ "--n": N } as CSSProperties}>
        <div
          className="s-grid"
          role="group"
          aria-label="Sixdoku board. Arrow keys move, 1 to 6 enter a digit, Backspace erases, N toggles notes."
        >
          {state.values.map((v, i) => {
            const given = !!puzzle.givens[i];
            const peer =
              i !== sel && (Math.floor(i / N) === Math.floor(sel / N) || i % N === sel % N || boxOf(i) === boxOf(sel));
            const cls = [
              "s-cell",
              "fx-cell",
              given && "given",
              i === sel && "selected",
              peer && "peer",
              selDigit && v === selDigit && i !== sel && "same",
              bad.has(i) && !given && "bad",
              bad.has(i) && given && "bad-given",
              marked.has(i) && "hinted",
              flagged.has(i) && "flagged",
              won && "winner",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={i}
                ref={(el) => {
                  cellRefs.current[i] = el;
                }}
                type="button"
                className={cls}
                style={{ boxShadow: edges[i] || undefined, "--d": Math.floor(i / N) + (i % N) } as CSSProperties}
                tabIndex={i === sel ? 0 : -1}
                aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${v || "empty"}${given ? ", given" : ""}`}
                onClick={() => {
                  setSel(i);
                  sfx.select();
                }}
              >
                {v ? (
                  <span key={v} className="s-digit">
                    {v}
                  </span>
                ) : state.notes[i] ? (
                  <span className="s-notes" aria-hidden>
                    {[1, 2, 3, 4, 5, 6].map((d) => (
                      <span key={d}>{state.notes[i] & (1 << d) ? d : ""}</span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="s-pad" role="group" aria-label="Number pad">
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <button key={d} type="button" className="s-key" onClick={() => input(d)} disabled={!interactive}>
            {d}
            <small aria-label={`${remaining(d)} left`}>{remaining(d) || ""}</small>
          </button>
        ))}
        <button type="button" className="s-key tool" onClick={() => input(0)} disabled={!interactive} aria-label="Erase">
          <EraseIcon />
        </button>
        <button
          type="button"
          className={`s-key tool ${notesMode ? "on" : ""}`}
          onClick={() => setNotesMode((m) => !m)}
          aria-pressed={notesMode}
          aria-label="Notes"
          disabled={!interactive}
        >
          <PencilIcon />
        </button>
      </div>
    </div>
  );
}
