"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { BoardProps } from "@/core/types";
import { EraseIcon, PencilIcon } from "@/core/Icons";
import { sfx } from "@/core/sound";
import { boxOf, BOX_C, BOX_R, conflicts, eraseCell, N, placeDigit, type SudokuPuzzle, type SudokuState } from "./engine";

const EDGE = "#2c2f35";

export function Board({ puzzle, state, apply, interactive, won, mark, dealing, say, flagged, settings }: BoardProps<SudokuPuzzle, SudokuState, number[]>) {
  const [sel, setSel] = useState(() => Math.max(0, puzzle.givens.findIndex((v) => !v)));
  const [notesMode, setNotesMode] = useState(false);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Settings: Auto-check marks clashes in red; Count remaining shows how many of each
  // digit are left on the keys; Highlight sections shades the selected cell's row,
  // column and box.
  const autoCheck = settings.autoCheck !== false;
  const showCounts = settings.countRemaining !== false;
  const showSections = settings.highlightSections !== false;
  const hideFinished = settings.hideFinished === true;
  const bad = useMemo(() => (autoCheck ? conflicts(state.values) : new Set<number>()), [state.values, autoCheck]);
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
    // Erase clears the cell for good: its digit and its notes.
    if (!d) {
      if (state.values[sel] || state.notes[sel]) apply(eraseCell(state, sel), { sound: "erase" });
      return;
    }
    const value = state.values[sel] === d ? 0 : d;
    const next = placeDigit(state, sel, value);
    const clash = autoCheck && value !== 0 && conflicts(next.values).has(sel);
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
              showSections &&
              i !== sel &&
              (Math.floor(i / N) === Math.floor(sel / N) || i % N === sel % N || boxOf(i) === boxOf(sel));
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
      <div className="s-pad">
        <div className="s-digits" role="group" aria-label="Numbers">
          {[1, 2, 3, 4, 5, 6].map((d) => {
            const left = remaining(d);
            // Hide finished numbers: a digit placed all six times leaves the keypad.
            const gone = hideFinished && left === 0;
            return (
              <button
                key={d}
                type="button"
                className={`s-key ${showCounts && left === 0 ? "done" : ""} ${gone ? "gone" : ""}`}
                onClick={() => input(d)}
                disabled={!interactive || gone}
                aria-hidden={gone || undefined}
                aria-label={showCounts ? `${d}, ${left === 0 ? "all placed" : `${left} left`}` : String(d)}
              >
                {d}
                {showCounts && <small aria-hidden>{left === 0 ? "✓" : left}</small>}
              </button>
            );
          })}
        </div>
        <div className="s-tools" role="group" aria-label="Tools">
          <button
            type="button"
            className={`s-tool ${notesMode ? "on" : ""}`}
            onClick={() => setNotesMode((m) => !m)}
            aria-pressed={notesMode}
            disabled={!interactive}
          >
            <PencilIcon />
            <span>Notes</span>
            <b className="s-switch" aria-hidden>{notesMode ? "On" : "Off"}</b>
          </button>
          <button type="button" className="s-tool" onClick={() => input(0)} disabled={!interactive}>
            <EraseIcon />
            <span>Erase</span>
          </button>
        </div>
      </div>
    </div>
  );
}
