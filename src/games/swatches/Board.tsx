"use client";

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { BoardProps } from "@/core/types";
import { cellFromPoint } from "@/core/geometry";
import { sfx } from "@/core/sound";
import {
  addSwatch,
  area,
  clueIn,
  inRect,
  MIN_AREA,
  mismatch,
  overlapping,
  rectCells,
  sameRect,
  swatchFits,
  type SwatchesPuzzle,
  type SwatchesState,
  type Rect,
} from "./engine";

export const SWATCH_COLORS = ["#f28b82", "#f6bf3a", "#a8d672", "#6fc8e0", "#a993e6", "#f49ac1", "#5fc2a7", "#eea36f"];

const rectOf = (a: number, b: number, cols: number): Rect => {
  const ar = Math.floor(a / cols), ac = a % cols, br = Math.floor(b / cols), bc = b % cols;
  return { r0: Math.min(ar, br), c0: Math.min(ac, bc), r1: Math.max(ar, br), c1: Math.max(ac, bc) };
};

const boxStyle = (r: Rect): CSSProperties =>
  ({ "--r0": r.r0, "--c0": r.c0, "--h": r.r1 - r.r0 + 1, "--w": r.c1 - r.c0 + 1, "--d": r.r0 + r.c0 }) as CSSProperties;


/**
 * A clue, drawn like Patches: a tinted cell with a darker shape behind the number.
 * Square, wide bar and tall bar ask for that shape; two crossed dashed bars mean any
 * rectangle. A clue without a number shows the shape alone, and its size is yours to
 * find.
 */
export function ClueBadge({ size, shape, color }: { size: number | null; shape: string | null; color: number }) {
  const kind = shape ?? "any";
  return (
    <span
      className={`p-clue shape-${kind} ${size === null ? "blank" : ""}`}
      style={{ "--pc": SWATCH_COLORS[color] } as CSSProperties}
    >
      <svg viewBox="0 0 100 100" aria-hidden>
        {kind === "square" && <rect x="17" y="17" width="66" height="66" rx="12" />}
        {kind === "wide" && <rect x="7" y="28" width="86" height="44" rx="11" />}
        {kind === "tall" && <rect x="28" y="7" width="44" height="86" rx="11" />}
        {kind === "any" && (
          <>
            <rect className="bar" x="7" y="30" width="86" height="40" rx="10" />
            <rect className="bar" x="30" y="7" width="40" height="86" rx="10" />
          </>
        )}
      </svg>
      {size !== null && <b>{size}</b>}
    </span>
  );
}

/**
 * One axis of a fresh drag. The side of the start the finger is on follows the
 * finger (so pulling back shrinks it), while the other side keeps the furthest point
 * reached. Start on a clue, go up, then sweep down past it: the swatch keeps the top.
 */
type Axis = { start: number; lo: number; hi: number; side: -1 | 0 | 1 };
const axisAt = (start: number): Axis => ({ start, lo: start, hi: start, side: 0 });
function reach(a: Axis, at: number) {
  a.lo = Math.min(a.lo, at);
  a.hi = Math.max(a.hi, at);
  if (at !== a.start) a.side = at < a.start ? -1 : 1;
}
function span(a: Axis, at: number): [number, number] {
  if (a.side < 0) return [Math.min(at, a.start), a.hi];
  if (a.side > 0) return [a.lo, Math.max(at, a.start)];
  return [a.start, a.start];
}

/**
 * A drag. A fresh drag sweeps (see Axis). A drag that starts on a drawn swatch
 * reshapes it: its far corner (`anchor`) stays put and the end you grabbed follows
 * your finger, back and forth.
 */
type Drag = {
  id: number;
  start: number;
  cursor: number;
  moved: boolean;
  editing: Rect | null;
  anchor: number;
  rowAxis: Axis;
  colAxis: Axis;
  /** The last accepted rectangle, and the row and column that produced it. */
  rect: Rect;
  row: number;
  col: number;
};

export function Board({ puzzle, state, apply, interactive, won, mark, dealing, say, flagged }: BoardProps<SwatchesPuzzle, SwatchesState, number[]>) {
  const { rows, cols, clues } = puzzle;
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  // The drag's current rectangle, for drawing (the ref is the source of truth).
  const [dragRect, setDragRect] = useState<Rect | null>(null);
  // Keyboard drawing: Enter sets a corner, the arrows move the other.
  const [anchor, setAnchor] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const [editing, setEditing] = useState<Rect | null>(null);
  const marked = useMemo(() => new Set(mark ?? []), [mark]);

  const cellAt = (x: number, y: number) => (gridRef.current ? cellFromPoint(gridRef.current, x, y, rows, cols) : null);
  const swatchAt = (cell: number) => state.find((r) => inRect(r, Math.floor(cell / cols), cell % cols));

  /** Swatches never overlap: does `rect` run into one already drawn (other than `editing`)? */
  const hitsOthers = (rect: Rect, editing: Rect | null) => state.some((r) => r !== editing && overlapping(r, rect));

  /**
   * Move a drag to the cell under the finger and return the rectangle it now covers.
   * A swatch holds one clue and never overlaps another swatch, so the drag stops at
   * a second clue and at the edge of any swatch already drawn: it tries the whole
   * move, then the move along one direction only (so you can still slide along that
   * edge), and otherwise stays where it was. Pulling back works as usual.
   */
  const rectFor = (d: Drag, at: number): Rect => {
    const row = Math.floor(at / cols);
    const col = at % cols;
    const tries: [number, number][] = [
      [row, col],
      [row, d.col],
      [d.row, col],
    ];
    for (const [r, c] of tries) {
      const rowAxis = { ...d.rowAxis };
      const colAxis = { ...d.colAxis };
      let rect: Rect;
      if (d.editing) rect = rectOf(d.anchor, r * cols + c, cols);
      else {
        reach(rowAxis, r);
        reach(colAxis, c);
        const [r0, r1] = span(rowAxis, r);
        const [c0, c1] = span(colAxis, c);
        rect = { r0, c0, r1, c1 };
      }
      if (clueIn(puzzle, rect) === -2 || hitsOthers(rect, d.editing)) continue;
      Object.assign(d, { rowAxis, colAxis, row: r, col: c, rect });
      return rect;
    }
    return d.rect;
  };

  const commit = (rect: Rect, tapped: boolean, editing: Rect | null = null) => {
    const existing = editing ?? swatchAt(rect.r0 * cols + rect.c0);
    if (tapped && existing) {
      apply(
        state.filter((r) => r !== existing),
        { sound: "erase" },
      );
      return;
    }
    const k = clueIn(puzzle, rect);
    if (k === -1) {
      if (tapped) say("Drag across the cells to draw a swatch around a clue.");
      else say(editing ? "A swatch needs a clue inside it, so the old one stays." : "A swatch needs a clue inside it.");
      return;
    }
    if (k === -2) {
      say(editing ? "A swatch can hold only one clue, so the old one stays." : "A swatch can hold only one clue.");
      return;
    }
    if (editing && sameRect(editing, rect)) return;
    // As in Patches, there are no one-cell swatches: every clue covers 2 cells or more.
    if (area(rect) < MIN_AREA) {
      if (tapped) say("Drag from the clue across the cells to draw its swatch.");
      else say(editing ? "A swatch covers at least 2 cells, so the old one stays." : "A swatch covers at least 2 cells.");
      return;
    }
    if (hitsOthers(rect, editing)) {
      say("Swatches can't overlap. Tap the one in the way to remove it, or drag its edge to make room.");
      return;
    }
    // A swatch that breaks its clue still goes down (you may be mid-way through a
    // reshape); the shell's check explains what's wrong and keeps it highlighted.
    apply(addSwatch(state, rect), { sound: mismatch(puzzle, rect) ? "error" : "place", step: area(rect) });
  };

  const clearDrag = () => {
    drag.current = null;
    setDragRect(null);
    setEditing(null);
  };

  /** Grabbing a drawn swatch: keep its far corner fixed (per axis), move the near one. */
  const farCorner = (r: Rect, cell: number) => {
    const row = Math.floor(cell / cols);
    const col = cell % cols;
    const clue = clues[clueIn(puzzle, r)]?.cell ?? cell;
    const pick = (lo: number, hi: number, at: number, clueAt: number) => {
      if (lo === hi) return lo;
      const dLo = at - lo;
      const dHi = hi - at;
      if (dLo !== dHi) return dLo > dHi ? lo : hi;
      return clueAt <= at ? lo : hi; // a tie: keep the clue's side fixed
    };
    return (
      pick(r.r0, r.r1, row, Math.floor(clue / cols)) * cols + pick(r.c0, r.c1, col, clue % cols)
    );
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.button !== 0) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell === null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const grabbed = swatchAt(cell) ?? null;
    const d: Drag = {
      id: e.pointerId,
      start: cell,
      cursor: cell,
      moved: false,
      editing: grabbed,
      anchor: grabbed ? farCorner(grabbed, cell) : cell,
      rowAxis: axisAt(Math.floor(cell / cols)),
      colAxis: axisAt(cell % cols),
      rect: grabbed ?? rectOf(cell, cell, cols),
      row: Math.floor(cell / cols),
      col: cell % cols,
    };
    drag.current = d;
    setKeyboard(false);
    setAnchor(null);
    setCursor(null);
    setDragRect(rectFor(d, cell));
    setEditing(grabbed);
    setFocus(cell);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell === null || cell === d.cursor) return;
    d.cursor = cell;
    d.moved = true;
    setDragRect(rectFor(d, cell));
    sfx.tap();
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // The release point is the final corner, even if no move event reached it first.
    const end = cellAt(e.clientX, e.clientY) ?? d.cursor;
    const moved = d.moved || end !== d.start;
    const rect = rectFor(d, end);
    clearDrag();
    commit(moved ? rect : rectOf(d.start, d.start, cols), !moved, d.editing);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    setKeyboard(true);
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (e.key in moves) {
      e.preventDefault();
      const r = Math.floor(focus / cols) + moves[e.key][0];
      const c = (focus % cols) + moves[e.key][1];
      if (r < 0 || r >= rows || c < 0 || c >= cols) return;
      setFocus(r * cols + c);
      if (anchor !== null) {
        setCursor(r * cols + c);
        sfx.tap();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (anchor === null) {
        setAnchor(focus);
        setCursor(focus);
      } else {
        commit(rectOf(anchor, focus, cols), anchor === focus);
        setAnchor(null);
        setCursor(null);
      }
    } else if (e.key === "Escape") {
      setAnchor(null);
      setCursor(null);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      const p = swatchAt(focus);
      if (p) apply(state.filter((r) => r !== p), { sound: "erase" });
    }
  };

  const preview = dragRect ?? (anchor !== null && cursor !== null ? rectOf(anchor, cursor, cols) : null);
  const previewClue = preview ? clueIn(puzzle, preview) : -1;
  const previewOk = preview !== null && previewClue >= 0 && swatchFits(puzzle, preview);
  // A problem swatch gets one ring around it; any other flagged cell gets its own.
  const flaggedSwatches = new Set(
    flagged.size ? state.filter((r) => rectCells(r, cols).every((c) => flagged.has(c))) : [],
  );
  const loose = [...flagged].filter((c) => ![...flaggedSwatches].some((r) => inRect(r, Math.floor(c / cols), c % cols)));

  return (
    <div className={`tray p-tray ${dealing ? "deal" : ""}`} style={{ "--rows": rows, "--cols": cols } as CSSProperties}>
      <div
        ref={gridRef}
        className={`p-grid ${keyboard ? "kbd" : ""} ${won ? "won" : ""}`}
        role="application"
        tabIndex={0}
        aria-label={`Swatches board, ${rows} by ${cols}, ${clues.length} clues, ${state.length} swatches drawn. Arrow keys move, Enter starts and finishes a swatch, Delete removes the swatch under the cursor.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={clearDrag}
        onLostPointerCapture={(e) => {
          // the browser ended the drag (e.g. a system gesture): finish it where it was
          const d = drag.current;
          if (d && d.id === e.pointerId) {
            const rect = rectFor(d, d.cursor);
            clearDrag();
            if (d.moved) commit(rect, false, d.editing);
          }
        }}
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: rows * cols }, (_, i) => (
          <div
            key={i}
            data-cell={i}
            className={`p-cell fx-cell ${marked.has(i) ? "hinted" : ""}`}
            style={{ "--d": Math.floor(i / cols) + (i % cols) } as CSSProperties}
          />
        ))}
        {state.map((r) => {
          if (editing && sameRect(editing, r)) return null;
          const ci = clueIn(puzzle, r);
          const color = ci >= 0 ? SWATCH_COLORS[clues[ci].color] : "#ccc";
          return (
            <div
              key={`${r.r0}-${r.c0}-${r.r1}-${r.c1}`}
              className={`p-swatch ${swatchFits(puzzle, r) ? "" : "bad"} ${flaggedSwatches.has(r) ? "flagged" : ""} ${won ? "winner" : ""}`}
              style={{ ...boxStyle(r), "--pc": color } as CSSProperties}
            />
          );
        })}
        {preview && (
          <div
            className={`p-preview ${previewClue < 0 ? "no" : previewOk ? "ok" : ""}`}
            style={{ ...boxStyle(preview), ...(previewClue >= 0 ? { "--pc": SWATCH_COLORS[clues[previewClue].color] } : {}) } as CSSProperties}
          >
            <span>{area(preview)}</span>
          </div>
        )}
        {loose.map((c) => (
          <span
            key={`f${c}`}
            className="p-flag flagged"
            style={{ "--r": Math.floor(c / cols), "--c": c % cols } as CSSProperties}
            aria-hidden
          />
        ))}
        {clues.map((cl, k) => (
          <span
            key={k}
            className="p-clue-slot"
            style={{ "--r": Math.floor(cl.cell / cols), "--c": cl.cell % cols } as CSSProperties}
            aria-hidden
          >
            <ClueBadge size={cl.size} shape={cl.shape} color={cl.color} />
          </span>
        ))}
        {keyboard && (
          <span className="p-focus" style={{ "--r": Math.floor(focus / cols), "--c": focus % cols } as CSSProperties} aria-hidden />
        )}
      </div>
    </div>
  );
}
