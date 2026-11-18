"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { BoardProps } from "@/core/types";
import { cellFromPoint } from "@/core/geometry";
import { sfx } from "@/core/sound";
import { canStep, lastNumber, nextNumber, wallKey, type ZapPuzzle, type ZapState } from "./engine";

/** How far past a cell border (in cells) the finger must go before the path follows. Stops flicker on borders. */
const CROSS = 0.62;

type Point = { x: number; y: number }; // position in cell units, (0,0) = grid's top-left corner

export function Board({ puzzle, state, apply, interactive, won, mark, dealing, say }: BoardProps<ZapPuzzle, ZapState, number[]>) {
  const { rows, cols, numbers } = puzzle;
  const n = rows * cols;
  const K = lastNumber(puzzle);
  const walls = useMemo(() => new Set(puzzle.walls.map(([a, b]) => wallKey(a, b))), [puzzle.walls]);
  const gridRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<SVGLineElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  // The drag works on refs; React only re-renders when the path gains or loses a cell.
  const liveRef = useRef<ZapState | null>(null);
  const pointer = useRef<Point | null>(null);
  const frame = useRef(0);
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

  /** Pointer position in cell units, kept within half a cell of the grid. */
  const toGrid = (x: number, y: number): Point | null => {
    const g = gridRef.current;
    if (!g) return null;
    const b = g.getBoundingClientRect();
    return {
      x: Math.min(cols + 0.4, Math.max(-0.4, ((x - b.left) / b.width) * cols)),
      y: Math.min(rows + 0.4, Math.max(-0.4, ((y - b.top) / b.height) * rows)),
    };
  };

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

  /**
   * Follow the finger: step into a neighbour once the finger is well inside it,
   * step back when it returns to the previous cell. One cell at a time, so the path
   * never jumps or cuts a corner.
   */
  const advance = (p: ZapState, f: Point): ZapState => {
    let cur = p;
    for (let guard = 0; guard < n; guard++) {
      const h = cur[cur.length - 1];
      const hr = Math.floor(h / cols);
      const hc = h % cols;
      const dx = f.x - (hc + 0.5);
      const dy = f.y - (hr + 0.5);
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (Math.max(ax, ay) < CROSS) break;
      const options: [number, number][] = [];
      if (ax >= ay) {
        options.push([0, Math.sign(dx)]);
        if (ay >= CROSS) options.push([Math.sign(dy), 0]);
      } else {
        options.push([Math.sign(dy), 0]);
        if (ax >= CROSS) options.push([0, Math.sign(dx)]);
      }
      let moved = false;
      for (const [dr, dc] of options) {
        const r = hr + dr;
        const c = hc + dc;
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        const nb = r * cols + c;
        if (cur.length >= 2 && cur[cur.length - 2] === nb) {
          sfx.tap();
          cur = cur.slice(0, -1);
          moved = true;
          break;
        }
        if (canStep(puzzle, cur, nb, walls)) {
          cur = push(cur, nb);
          moved = true;
          break;
        }
      }
      if (!moved) {
        const d = drag.current;
        const [dr, dc] = options[0];
        const r = hr + dr;
        const c = hc + dc;
        const why = r >= 0 && r < rows && c >= 0 && c < cols ? blockedReason(cur, r * cols + c) : null;
        if (why && d && !d.warned) {
          d.warned = true;
          say(why, true);
        }
        break;
      }
    }
    return cur;
  };

  /** Draw the line from the head's centre towards the finger, so the path end moves with it. */
  const drawLead = () => {
    frame.current = 0;
    const p = liveRef.current ?? state;
    const h = p[p.length - 1];
    const hx = (h % cols) + 0.5;
    const hy = Math.floor(h / cols) + 0.5;
    let x = hx;
    let y = hy;
    const f = pointer.current;
    if (f && drag.current) {
      const dx = f.x - hx;
      const dy = f.y - hy;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const dr = horizontal ? 0 : Math.sign(dy);
      const dc = horizontal ? Math.sign(dx) : 0;
      const r = Math.floor(h / cols) + dr;
      const c = (h % cols) + dc;
      const nb = r * cols + c;
      const open =
        r >= 0 && r < rows && c >= 0 && c < cols && ((p.length >= 2 && p[p.length - 2] === nb) || canStep(puzzle, p, nb, walls));
      const reach = Math.min(open ? 0.5 : 0.14, horizontal ? Math.abs(dx) : Math.abs(dy));
      x = hx + dc * reach;
      y = hy + dr * reach;
    }
    leadRef.current?.setAttribute("x1", String(hx));
    leadRef.current?.setAttribute("y1", String(hy));
    leadRef.current?.setAttribute("x2", String(x));
    leadRef.current?.setAttribute("y2", String(y));
    headRef.current?.setAttribute("cx", String(x));
    headRef.current?.setAttribute("cy", String(y));
  };

  const scheduleLead = () => {
    if (!frame.current) frame.current = requestAnimationFrame(drawLead);
  };

  // keep the path end in place when the path changes outside a drag (undo, hints, keys)
  useEffect(() => {
    if (!drag.current) drawLead();
  });
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

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
    pointer.current = toGrid(e.clientX, e.clientY);
    setLive(start);
    scheduleLead();
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const cur = liveRef.current;
    if (!d || d.id !== e.pointerId || !cur) return;
    // every sample the browser collected since the last event, not just the latest one
    const native = e.nativeEvent;
    const samples = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    let next = cur;
    for (const s of samples.length ? samples : [native]) {
      const f = toGrid(s.clientX, s.clientY);
      if (f) next = advance(next, f);
    }
    pointer.current = toGrid(e.clientX, e.clientY);
    if (next !== cur) {
      liveRef.current = next;
      setLive(next);
    }
    scheduleLead();
  };

  const finish = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    let result = liveRef.current;
    if (result && e.type === "pointerup") {
      const f = toGrid(e.clientX, e.clientY);
      if (f) result = advance(result, f);
    }
    drag.current = null;
    liveRef.current = null;
    pointer.current = null;
    setLive(null);
    if (result && (result.length !== state.length || result.some((c, i) => c !== state[i]))) apply(result, { sound: "none" });
    else drawLead();
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
  const hx = (head % cols) + 0.5;
  const hy = Math.floor(head / cols) + 0.5;

  return (
    <div className={`tray z-tray ${dealing ? "deal" : ""} ${won ? "won" : ""}`} style={{ "--rows": rows, "--cols": cols } as CSSProperties}>
      <div
        ref={gridRef}
        className={`z-grid ${live ? "drawing" : ""}`}
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
          <line ref={leadRef} className="z-lead" x1={hx} y1={hy} x2={hx} y2={hy} />
          <circle ref={headRef} className="z-head" r={0.3} cx={hx} cy={hy} />
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
