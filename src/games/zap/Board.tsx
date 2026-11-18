"use client";

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { BoardProps } from "@/core/types";
import { cellFromPoint } from "@/core/geometry";
import { sfx } from "@/core/sound";
import { canStep, lastNumber, nextNumber, wallKey, type ZapPuzzle, type ZapState } from "./engine";

export function Board({ puzzle, state, apply, interactive, won, mark, dealing, say }: BoardProps<ZapPuzzle, ZapState, number[]>) {
  const { rows, cols, numbers } = puzzle;
  const n = rows * cols;
  const K = lastNumber(puzzle);
  const walls = useMemo(() => new Set(puzzle.walls.map(([a, b]) => wallKey(a, b))), [puzzle.walls]);
  const gridRef = useRef<HTMLDivElement>(null);
  // The drag works on a ref so quick moves never read a stale path; state only renders it.
  const liveRef = useRef<ZapState | null>(null);
  const drag = useRef<{ id: number; warned: boolean } | null>(null);
  const [live, setLive] = useState<ZapState | null>(null);
  const path = live ?? state;
  const onPath = useMemo(() => new Set(path), [path]);
  const marked = useMemo(() => new Set(mark ?? []), [mark]);
  const head = path[path.length - 1];

  // Walls drawn as thick inner edges on both sides.
  const edges = useMemo(() => {
    const out: string[] = new Array(n).fill("");
    const w = "0.7cqi";
    const col = "#1d1d1f";
    for (let i = 0; i < n; i++) {
      const s: string[] = [];
      const c = i % cols;
      if (c < cols - 1 && walls.has(wallKey(i, i + 1))) s.push(`inset -${w} 0 0 ${col}`);
      if (c > 0 && walls.has(wallKey(i, i - 1))) s.push(`inset ${w} 0 0 ${col}`);
      if (i + cols < n && walls.has(wallKey(i, i + cols))) s.push(`inset 0 -${w} 0 ${col}`);
      if (i - cols >= 0 && walls.has(wallKey(i, i - cols))) s.push(`inset 0 ${w} 0 ${col}`);
      out[i] = s.join(", ");
    }
    return out;
  }, [walls, n, cols]);

  const cellAt = (x: number, y: number) => (gridRef.current ? cellFromPoint(gridRef.current, x, y, rows, cols) : null);

  /** Why the head can't step onto `cell` (for a one-line explanation), or null. */
  const blockedReason = (p: ZapState, cell: number): string | null => {
    const h = p[p.length - 1];
    const adjacent = Math.abs(Math.floor(h / cols) - Math.floor(cell / cols)) + Math.abs((h % cols) - (cell % cols)) === 1;
    if (!adjacent || p.includes(cell)) return null;
    if (walls.has(wallKey(h, cell))) return "A wall blocks that way. Go around it.";
    if (numbers[h] === K && nextNumber(puzzle, p) > K) return `Fill every cell before finishing on ${K}. Drag back to free up the path.`;
    const k = numbers[cell];
    if (k && k !== nextNumber(puzzle, p)) return `Reach ${nextNumber(puzzle, p)} before ${k}.`;
    return null;
  };

  /** Add a step and give it a sound: rising pitch, chime on checkpoints. */
  const push = (p: ZapState, cell: number): ZapState => {
    const next = p.concat([cell]);
    if (numbers[cell]) sfx.checkpoint(numbers[cell]);
    else sfx.step(next.length / n);
    return next;
  };

  /** Move the path's head towards `target`, one cell at a time. */
  const extendTowards = (p: ZapState, target: number): ZapState => {
    let cur = p;
    for (let guard = 0; guard < n; guard++) {
      const h = cur[cur.length - 1];
      if (h === target) break;
      if (cur.length >= 2 && cur[cur.length - 2] === target) {
        sfx.tap();
        return cur.slice(0, -1);
      }
      const hr = Math.floor(h / cols), hc = h % cols;
      const tr = Math.floor(target / cols), tc = target % cols;
      const steps: number[] = [];
      const dr = Math.sign(tr - hr);
      const dc = Math.sign(tc - hc);
      if (Math.abs(tr - hr) >= Math.abs(tc - hc)) {
        if (dr) steps.push(h + dr * cols);
        if (dc) steps.push(h + dc);
      } else {
        if (dc) steps.push(h + dc);
        if (dr) steps.push(h + dr * cols);
      }
      const back = steps.find((s) => cur.length >= 2 && cur[cur.length - 2] === s);
      if (back !== undefined) {
        sfx.tap();
        cur = cur.slice(0, -1);
        continue;
      }
      const step = steps.find((s) => canStep(puzzle, cur, s, walls));
      if (step === undefined) {
        const d = drag.current;
        const why = steps.map((s) => blockedReason(cur, s)).find(Boolean);
        if (why && d && !d.warned) {
          d.warned = true;
          say(why, true);
        }
        break;
      }
      cur = push(cur, step);
    }
    return cur;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.button !== 0) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell === null) return;
    e.preventDefault();
    const idx = state.indexOf(cell);
    let start: ZapState | null = null;
    if (idx >= 0) {
      start = state.slice(0, idx + 1);
      if (idx < state.length - 1) sfx.tap();
    } else if (canStep(puzzle, state, cell, walls)) {
      start = push(state, cell);
    }
    if (!start) {
      say(blockedReason(state, cell) ?? "Draw from the end of your path, or tap a cell on it to go back there.");
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, warned: false };
    liveRef.current = start;
    setLive(start);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const cur = liveRef.current;
    if (!d || d.id !== e.pointerId || !cur) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell === null || cell === cur[cur.length - 1]) return;
    const next = extendTowards(cur, cell);
    if (next !== cur) {
      liveRef.current = next;
      setLive(next);
    }
  };

  const finish = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // take the release point into account too
    let result = liveRef.current;
    const cell = e.type === "pointerup" ? cellAt(e.clientX, e.clientY) : null;
    if (result && cell !== null && cell !== result[result.length - 1]) result = extendTowards(result, cell);
    drag.current = null;
    liveRef.current = null;
    setLive(null);
    if (result && (result.length !== state.length || result.some((c, i) => c !== state[i]))) apply(result, { sound: "none" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (!(e.key in d)) return;
    e.preventDefault();
    const r = Math.floor(head / cols) + d[e.key][0];
    const c = (head % cols) + d[e.key][1];
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const t = r * cols + c;
    if (state.length >= 2 && state[state.length - 2] === t) apply(state.slice(0, -1), { sound: "tap" });
    else if (canStep(puzzle, state, t, walls)) apply(push(state, t), { sound: "none" });
    else {
      const why = blockedReason(state, t);
      if (why) say(why, true);
    }
  };

  const points = path.map((cell) => `${(cell % cols) + 0.5},${Math.floor(cell / cols) + 0.5}`).join(" ");
  const hr = Math.floor(head / cols);
  const hc = head % cols;

  return (
    <div className={`tray z-tray ${dealing ? "deal" : ""} ${won ? "won" : ""}`} style={{ "--rows": rows, "--cols": cols } as CSSProperties}>
      <div
        ref={gridRef}
        className="z-grid"
        role="application"
        tabIndex={0}
        aria-label={`Zap board, ${rows} by ${cols}. ${path.length} of ${n} cells filled. Arrow keys extend the path from its end or step back.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            data-cell={i}
            className={["z-cell", "fx-cell", onPath.has(i) && "on", marked.has(i) && "hinted"].filter(Boolean).join(" ")}
            style={{ boxShadow: edges[i] || undefined, "--d": Math.floor(i / cols) + (i % cols) } as CSSProperties}
          />
        ))}
        <svg className="z-path" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" aria-hidden>
          {path.length > 1 && <polyline points={points} />}
          <circle className="z-head" r={0.3} style={{ cx: hc + 0.5, cy: hr + 0.5 } as CSSProperties} />
        </svg>
        {numbers.map((k, i) =>
          k ? (
            <span
              key={i}
              className={`z-num ${onPath.has(i) ? "reached" : ""}`}
              style={{ "--r": Math.floor(i / cols), "--c": i % cols } as CSSProperties}
              aria-hidden
            >
              {k}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
