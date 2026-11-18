"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { applyMove, areAdjacent, canMerge, cellLabel, type Grid, type Move, type SumbrokePuzzle } from "./engine";
import { Tile } from "./Tile";
import { ChevronIcon } from "@/core/Icons";
import { sfx } from "@/core/sound";
import type { BoardProps } from "@/core/types";

type Props = BoardProps<SumbrokePuzzle, Grid, Move>;

type Drag = {
  from: number;
  id: number;
  x0: number;
  y0: number;
  active: boolean;
  target: number | null;
  pitch: number;
};

const DIRS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function Board({ puzzle, state: grid, apply, interactive, mark: hint, dealing, won }: Props) {
  const { rows, cols } = puzzle;
  const [popAt, setPopAt] = useState<{ cell: number; grid: Grid } | null>(null);
  const onMove = (m: Move) => {
    const next = applyMove(grid, m);
    setPopAt({ cell: m.to, grid: next });
    apply(next, { sound: "pop", step: Math.log2(Math.max(1, next[m.to])) });
  };
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const busy = useRef(false);

  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const [shake, setShake] = useState<{ cell: number; id: number } | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);

  // Drop a selection that no longer points at a tile (after undo, reset, hint rewind…)
  useEffect(() => {
    if (selected !== null && grid[selected] === 0) setSelected(null);
  }, [grid, selected]);

  useEffect(() => {
    if (!interactive) setSelected(null);
  }, [interactive]);

  const pitch = () => {
    const cells = cellRefs.current;
    if (cells[0] && cells[1] && cols > 1) {
      return cells[1].getBoundingClientRect().left - cells[0].getBoundingClientRect().left;
    }
    return cells[0]?.getBoundingClientRect().width ?? 80;
  };

  const doShake = (cell: number) => {
    sfx.error();
    setShake({ cell, id: Date.now() });
    window.setTimeout(() => setShake((s) => (s && s.cell === cell ? null : s)), 340);
  };

  /** Slide the tile onto its neighbour, then commit the merge. */
  const animateTo = (from: number, to: number) => {
    const el = tileRefs.current[from];
    if (!el || prefersReducedMotion()) {
      onMove({ from, to });
      return;
    }
    busy.current = true;
    setMoving(from);
    const p = pitch();
    const dr = Math.floor(to / cols) - Math.floor(from / cols);
    const dc = (to % cols) - (from % cols);
    el.style.transition = "transform 110ms cubic-bezier(.4,0,.6,1)";
    el.style.transform = `translate(${dc * p}px, ${dr * p}px)`;
    window.setTimeout(() => {
      busy.current = false;
      setMoving(null);
      onMove({ from, to });
    }, 115);
  };

  const snapBack = (from: number) => {
    const el = tileRefs.current[from];
    if (!el) return;
    el.style.transition = prefersReducedMotion() ? "none" : "transform 200ms cubic-bezier(.3,1.5,.5,1)";
    el.style.transform = "";
    window.setTimeout(() => {
      if (el) el.style.transition = "";
    }, 220);
  };

  const tap = (i: number) => {
    if (selected === null) {
      setSelected(i);
      sfx.select();
    } else if (selected === i) {
      setSelected(null);
    } else if (areAdjacent(selected, i, cols) && canMerge(grid, selected, i, cols)) {
      const s = selected;
      setSelected(null);
      animateTo(s, i);
    } else {
      setSelected(i);
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, i: number) => {
    if (!interactive || busy.current || e.button !== 0) return;
    setFocusIdx(i);
    if (grid[i] === 0) {
      setSelected(null);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { from: i, id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, target: null, pitch: pitch() };
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.hypot(dx, dy) < 7) return;
      d.active = true;
      sfx.tap();
      setDragging(d.from);
      setSelected(null);
    }
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    let v = horizontal ? dx : dy;
    const r = Math.floor(d.from / cols);
    const c = d.from % cols;
    let nb: number | null;
    if (horizontal) nb = v > 0 ? (c < cols - 1 ? d.from + 1 : null) : c > 0 ? d.from - 1 : null;
    else nb = v > 0 ? (r < rows - 1 ? d.from + cols : null) : r > 0 ? d.from - cols : null;

    // Tiles only travel one cell, and barely budge towards an edge or an empty slot.
    const lim = nb === null || grid[nb] === 0 ? d.pitch * 0.16 : d.pitch;
    v = Math.max(-lim, Math.min(lim, v));
    const el = tileRefs.current[d.from];
    if (el) {
      el.style.transition = "none";
      el.style.transform = horizontal ? `translate(${v}px, 0)` : `translate(0, ${v}px)`;
    }
    const target = nb !== null && grid[nb] !== 0 && Math.abs(v) > d.pitch * 0.4 ? nb : null;
    if (target !== d.target) {
      d.target = target;
      setDropTarget(target);
    }
  };

  const endDrag = (e: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.active) {
      if (!cancelled) tap(d.from);
      return;
    }
    setDragging(null);
    setDropTarget(null);
    if (!cancelled && d.target !== null && canMerge(grid, d.from, d.target, cols)) {
      animateTo(d.from, d.target);
    } else {
      if (!cancelled && d.target !== null) doShake(d.target);
      snapBack(d.from);
    }
  };

  const focusCell = (i: number) => {
    setFocusIdx(i);
    cellRefs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || busy.current) return;
    const dir = DIRS[e.key];
    if (dir) {
      e.preventDefault();
      const origin = selected ?? focusIdx;
      const r = Math.floor(origin / cols) + dir[0];
      const c = (origin % cols) + dir[1];
      if (r < 0 || r >= rows || c < 0 || c >= cols) return;
      const nb = r * cols + c;
      if (selected !== null) {
        if (canMerge(grid, selected, nb, cols)) {
          const s = selected;
          setSelected(null);
          focusCell(nb);
          animateTo(s, nb);
        } else if (grid[nb] !== 0) {
          doShake(nb);
        }
      } else {
        focusCell(nb);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (grid[focusIdx] !== 0) setSelected((s) => (s === focusIdx ? null : focusIdx));
    } else if (e.key === "Escape") {
      setSelected(null);
    }
  };

  const pieces = grid.filter((c) => c !== 0).length;

  let arrow: CSSProperties | null = null;
  if (hint) {
    const r1 = Math.floor(hint.from / cols), c1 = hint.from % cols;
    const r2 = Math.floor(hint.to / cols), c2 = hint.to % cols;
    const rot = c2 > c1 ? 0 : c2 < c1 ? 180 : r2 > r1 ? 90 : -90;
    arrow = { "--mx": (c1 + c2) / 2, "--my": (r1 + r2) / 2, "--rot": `${rot}deg` } as CSSProperties;
  }

  return (
    <div
      ref={boardRef}
      className="sb-board"
      data-cols={cols}
      style={{ "--cols": cols } as CSSProperties}
      role="group"
      aria-label={`Puzzle board, ${pieces} ${pieces === 1 ? "piece" : "pieces"} left. Arrow keys move between cells, Enter picks up a tile, then an arrow key merges it.`}
      onKeyDown={onKeyDown}
    >
      {grid.map((v, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const cls = [
          "sb-cell",
          "fx-cell",
          selected === i && "selected",
          dragging === i && "dragging",
          moving === i && "moving",
          dropTarget === i && dragging !== null && canMerge(grid, dragging, i, cols) && "drop-ok",
          shake?.cell === i && "shake",
          hint?.from === i && "hint-from",
          hint?.to === i && "hint-to",
          won && v !== 0 && "winner",
        ]
          .filter(Boolean)
          .join(" ");
        const label = v === 0 ? "empty" : v < 0 ? `${cellLabel(v)} wildcard` : String(v);
        return (
          <button
            key={i}
            ref={(el) => {
              cellRefs.current[i] = el;
            }}
            type="button"
            className={cls}
            style={{ "--d": r + c } as CSSProperties}
            tabIndex={i === focusIdx ? 0 : -1}
            aria-label={`Row ${r + 1}, column ${c + 1}: ${label}`}
            aria-pressed={v !== 0 ? selected === i : undefined}
            onFocus={() => setFocusIdx(i)}
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endDrag(e, false)}
            onPointerCancel={(e) => endDrag(e, true)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {v !== 0 && (
              <Tile
                key={`${i}:${v}`}
                ref={(el) => {
                  tileRefs.current[i] = el;
                }}
                value={v}
                className={popAt?.cell === i && popAt.grid === grid ? "pop" : dealing ? "deal" : ""}
                style={{ "--i": i } as CSSProperties}
              />
            )}
          </button>
        );
      })}
      {arrow && (
        <div className="sb-hint-arrow" style={arrow} aria-hidden>
          <ChevronIcon />
        </div>
      )}
    </div>
  );
}
