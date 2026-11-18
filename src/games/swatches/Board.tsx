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
  mismatch,
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


export function ClueBadge({ size, shape, color }: { size: number | null; shape: string | null; color: number }) {
  return (
    <span className={`p-clue shape-${shape ?? "any"}`} style={{ "--pc": SWATCH_COLORS[color] } as CSSProperties}>
      {size ?? ""}
    </span>
  );
}

/**
 * A drag. `anchor` is the fixed corner; `editing` is the swatch being reshaped when
 * the drag started on one (its far corner becomes the anchor, so you resize it by
 * dragging the end you grabbed, back and forth).
 */
type Drag = { id: number; start: number; anchor: number; cursor: number; moved: boolean; editing: Rect | null };

export function Board({ puzzle, state, apply, interactive, won, mark, dealing, say, flagged }: BoardProps<SwatchesPuzzle, SwatchesState, number[]>) {
  const { rows, cols, clues } = puzzle;
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  // Rendering copies of the drag (the ref is the source of truth while dragging).
  const [anchor, setAnchor] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const [editing, setEditing] = useState<Rect | null>(null);
  const marked = useMemo(() => new Set(mark ?? []), [mark]);

  const cellAt = (x: number, y: number) => (gridRef.current ? cellFromPoint(gridRef.current, x, y, rows, cols) : null);
  const swatchAt = (cell: number) => state.find((r) => inRect(r, Math.floor(cell / cols), cell % cols));

  const commit = (a: number, b: number, tapped: boolean, editing: Rect | null = null) => {
    const existing = editing ?? swatchAt(a);
    if (tapped && existing) {
      apply(
        state.filter((r) => r !== existing),
        { sound: "erase" },
      );
      return;
    }
    const rect = rectOf(a, b, cols);
    const k = clueIn(puzzle, rect);
    if (k === -1) {
      if (tapped) say("Drag from one corner to the opposite corner to draw a swatch around a clue.");
      else say(editing ? "A swatch needs a clue inside it, so the old one stays." : "A swatch needs a clue inside it.", true);
      return;
    }
    if (k === -2) {
      say(editing ? "A swatch can hold only one clue, so the old one stays." : "A swatch can hold only one clue.", true);
      return;
    }
    if (editing && sameRect(editing, rect)) return;
    // A swatch that breaks its clue still goes down (you may be mid-way through a
    // reshape); the shell's check explains what's wrong and keeps it highlighted.
    apply(addSwatch(state, rect), { sound: mismatch(puzzle, rect) ? "error" : "place", step: area(rect) });
  };

  const clearDrag = () => {
    drag.current = null;
    setAnchor(null);
    setCursor(null);
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
    const anchorCell = grabbed ? farCorner(grabbed, cell) : cell;
    drag.current = { id: e.pointerId, start: cell, anchor: anchorCell, cursor: cell, moved: false, editing: grabbed };
    setKeyboard(false);
    setAnchor(anchorCell);
    setCursor(cell);
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
    setCursor(cell);
    sfx.tap();
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // The release point is the final corner, even if no move event reached it first.
    const end = cellAt(e.clientX, e.clientY) ?? d.cursor;
    const moved = d.moved || end !== d.start;
    clearDrag();
    if (!moved) commit(d.start, d.start, true, d.editing);
    else commit(d.anchor, end, false, d.editing);
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
        commit(anchor, focus, anchor === focus);
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

  const preview = anchor !== null && cursor !== null ? rectOf(anchor, cursor, cols) : null;
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
        className={`p-grid ${keyboard ? "kbd" : ""}`}
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
            clearDrag();
            if (d.moved) commit(d.anchor, d.cursor, false, d.editing);
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
