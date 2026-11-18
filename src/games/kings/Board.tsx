"use client";

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { BoardProps } from "@/core/types";
import { Crown } from "@/core/Icons";
import { cellFromPoint } from "@/core/geometry";
import { sfx } from "@/core/sound";
import { conflicts, EMPTY, MARK, KING, type KingsPuzzle, type KingsState } from "./engine";

export const REGION_COLORS = [
  "#f4b7a2",
  "#f7d67f",
  "#b9dd9a",
  "#9fd3e6",
  "#c8b6ec",
  "#f2a8c9",
  "#a9e2cd",
  "#e6c39b",
  "#b3c1f2",
  "#dfe59a",
  "#f0c2a8",
];

const EDGE = "#26211c";

type Drag = { start: number; id: number; mode: "mark" | "erase" | "none"; moved: boolean; last: number; draft: KingsState | null };

export function Board({ puzzle, state, apply, interactive, won, mark, dealing }: BoardProps<KingsPuzzle, KingsState, number[]>) {
  const { n, regions } = puzzle;
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<KingsState | null>(null);
  const [focus, setFocus] = useState(0);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = draft ?? state;
  const bad = useMemo(() => conflicts(puzzle, shown), [puzzle, shown]);
  const marked = useMemo(() => new Set(mark ?? []), [mark]);

  // Thick lines where regions meet.
  const edges = useMemo(
    () =>
      regions.map((g, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const w = "0.55cqi";
        const s: string[] = [];
        if (c < n - 1 && regions[i + 1] !== g) s.push(`inset -${w} 0 0 ${EDGE}`);
        if (c > 0 && regions[i - 1] !== g) s.push(`inset ${w} 0 0 ${EDGE}`);
        if (r < n - 1 && regions[i + n] !== g) s.push(`inset 0 -${w} 0 ${EDGE}`);
        if (r > 0 && regions[i - n] !== g) s.push(`inset 0 ${w} 0 ${EDGE}`);
        return s.join(", ");
      }),
    [regions, n],
  );

  /** Commit a change, with a sound that says what happened (a clash sounds wrong). */
  const commit = (next: KingsState, cell: number) => {
    const v = next[cell];
    const clash = v === KING && conflicts(puzzle, next).has(cell);
    apply(next, { sound: clash ? "error" : v === KING ? "place" : v === MARK ? "mark" : "erase", step: Math.floor(cell / n) });
  };

  const cycle = (i: number) => {
    const next = state.slice();
    next[i] = state[i] === EMPTY ? MARK : state[i] === MARK ? KING : EMPTY;
    commit(next, i);
  };

  const set = (i: number, v: number) => {
    if (state[i] === v) return;
    const next = state.slice();
    next[i] = v;
    commit(next, i);
  };

  const cellAt = (x: number, y: number) => (gridRef.current ? cellFromPoint(gridRef.current, x, y, n, n, 0.6) : null);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    if (!interactive || e.button !== 0) return;
    e.preventDefault();
    gridRef.current?.setPointerCapture(e.pointerId);
    setFocus(i);
    const mode = state[i] === EMPTY ? "mark" : state[i] === MARK ? "erase" : "none";
    drag.current = { start: i, id: e.pointerId, mode, moved: false, last: i, draft: null };
  };

  const paint = (d: Drag, cell: number) => {
    const next = (d.draft ?? state).slice();
    const apply1 = (j: number) => {
      if (d.mode === "mark" && next[j] === EMPTY) {
        next[j] = MARK;
        sfx.mark();
      }
      if (d.mode === "erase" && next[j] === MARK) {
        next[j] = EMPTY;
        sfx.tap();
      }
    };
    if (!d.moved) {
      d.moved = true;
      apply1(d.start);
    }
    apply1(cell);
    d.draft = next;
    setDraft(next);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || d.mode === "none") return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell === null || cell === d.last) return;
    d.last = cell;
    paint(d, cell);
  };

  const finish = (e: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    // include the release point, even if no move event reached it
    if (!cancelled && d.mode !== "none" && e.type === "pointerup") {
      const cell = cellAt(e.clientX, e.clientY);
      if (cell !== null && cell !== d.last && (d.moved || cell !== d.start)) paint(d, cell);
    }
    setDraft(null);
    if (d.moved && d.draft) apply(d.draft, { sound: "none" });
    else if (!cancelled) cycle(d.start);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const moves: Record<string, number> = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 };
    if (e.key in moves) {
      e.preventDefault();
      const r = Math.floor(focus / n);
      const c = focus % n;
      const t = focus + moves[e.key];
      if ((e.key === "ArrowLeft" && c === 0) || (e.key === "ArrowRight" && c === n - 1)) return;
      if ((e.key === "ArrowUp" && r === 0) || (e.key === "ArrowDown" && r === n - 1)) return;
      setFocus(t);
      cellRefs.current[t]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cycle(focus);
    } else if (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "q") set(focus, KING);
    else if (e.key.toLowerCase() === "x") set(focus, MARK);
    else if (e.key === "Backspace" || e.key === "Delete") set(focus, EMPTY);
  };

  return (
    <div className={`tray q-tray ${dealing ? "deal" : ""}`} style={{ "--n": n } as CSSProperties}>
      <div
        ref={gridRef}
        className="q-grid"
        role="group"
        aria-label={`Kings board, ${n} by ${n}. Arrow keys move, Enter cycles a cell through X and king, K places a king, X marks, Backspace clears.`}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
        onKeyDown={onKeyDown}
      >
        {shown.map((v, i) => {
          const label = v === KING ? "king" : v === MARK ? "marked" : "empty";
          return (
            <button
              key={i}
              ref={(el) => {
                cellRefs.current[i] = el;
              }}
              type="button"
              data-cell={i}
              className={["q-cell", "fx-cell", bad.has(i) && "bad", marked.has(i) && "hinted", won && v === KING && "winner"]
                .filter(Boolean)
                .join(" ")}
              style={
                {
                  background: REGION_COLORS[regions[i] % REGION_COLORS.length],
                  boxShadow: edges[i] || undefined,
                  "--d": Math.floor(i / n) + (i % n),
                } as CSSProperties
              }
              tabIndex={i === focus ? 0 : -1}
              aria-label={`Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}, region ${regions[i] + 1}: ${label}`}
              onFocus={() => setFocus(i)}
              onPointerDown={(e) => onPointerDown(e, i)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {v === KING && <Crown className="q-king" />}
              {v === MARK && <span className="q-x" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
