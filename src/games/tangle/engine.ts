import { mulberry32, range, shuffle, type Rng } from "../../core/rng";
import type { BasePuzzle, HintResult } from "../../core/puzzle";

/**
 * Tangle: fill a 6×6 grid with suns (1) and moons (2).
 *  - never three of the same side by side in a row or column
 *  - each row and column holds three of each
 *  - "=" joins cells that match, "×" joins cells that differ
 * Every generated puzzle has exactly one solution.
 */

export const N = 6;
export const SUN = 1;
export const MOON = 2;

export interface Sign {
  a: number; // cell index
  b: number; // right or lower neighbour of a
  same: boolean; // "=" when true, "×" when false
}

export interface TanglePuzzle extends BasePuzzle {
  game: "tangle";
  givens: number[]; // 0 = open
  signs: Sign[];
  solution: number[];
}
export type TangleState = number[];

const LEVELS: Record<string, { signs: [number, number]; extraGivens: number }> = {
  easy: { signs: [5, 7], extraGivens: 5 },
  medium: { signs: [5, 8], extraGivens: 2 },
  hard: { signs: [4, 7], extraGivens: 0 },
};

/** Would value v at cell i break a rule, given the filled cells of g? */
function breaks(g: number[], i: number, v: number, signsAt?: Sign[][]): boolean {
  const r = Math.floor(i / N);
  const c = i % N;
  // three in a row / column, in any window that includes i
  const at = (rr: number, cc: number) => (rr === r && cc === c ? v : g[rr * N + cc]);
  for (let s = Math.max(0, c - 2); s <= Math.min(N - 3, c); s++) {
    if (at(r, s) === v && at(r, s + 1) === v && at(r, s + 2) === v) return true;
  }
  for (let s = Math.max(0, r - 2); s <= Math.min(N - 3, r); s++) {
    if (at(s, c) === v && at(s + 1, c) === v && at(s + 2, c) === v) return true;
  }
  // more than three of a kind in the row or column
  let rowCount = 0;
  let colCount = 0;
  for (let k = 0; k < N; k++) {
    if (at(r, k) === v) rowCount++;
    if (at(k, c) === v) colCount++;
  }
  if (rowCount > N / 2 || colCount > N / 2) return true;
  if (signsAt) {
    for (const sg of signsAt[i]) {
      const other = sg.a === i ? sg.b : sg.a;
      const o = g[other];
      if (o && (o === v) !== sg.same) return true;
    }
  }
  return false;
}

function signIndex(signs: Sign[]): Sign[][] {
  const at: Sign[][] = range(N * N).map(() => []);
  for (const s of signs) {
    at[s.a].push(s);
    at[s.b].push(s);
  }
  return at;
}

function randomSolution(rng: Rng): number[] {
  const g = new Array(N * N).fill(0);
  const rec = (i: number): boolean => {
    if (i === N * N) return true;
    for (const v of rng() < 0.5 ? [SUN, MOON] : [MOON, SUN]) {
      if (breaks(g, i, v)) continue;
      g[i] = v;
      if (rec(i + 1)) return true;
      g[i] = 0;
    }
    return false;
  };
  rec(0);
  return g;
}

/** Count completions of `givens` (stops at `limit`). */
export function countSolutions(givens: number[], signs: Sign[], limit = 2): number {
  const g = givens.slice();
  const at = signIndex(signs);
  // a given can itself break a rule
  for (let i = 0; i < N * N; i++) {
    if (!g[i]) continue;
    const v = g[i];
    g[i] = 0;
    const bad = breaks(g, i, v, at);
    g[i] = v;
    if (bad) return 0;
  }
  const open = range(N * N).filter((i) => !g[i]);
  let count = 0;
  const rec = (k: number): boolean => {
    if (k === open.length) return ++count >= limit;
    const i = open[k];
    for (const v of [SUN, MOON]) {
      if (breaks(g, i, v, at)) continue;
      g[i] = v;
      if (rec(k + 1)) return true;
      g[i] = 0;
    }
    return false;
  };
  rec(0);
  return count;
}

export function generate(level: string, seed: number): TanglePuzzle {
  const cfg = LEVELS[level] ?? LEVELS.easy;
  const rng = mulberry32(seed);
  const solution = randomSolution(rng);

  // Pick sign positions among all neighbouring pairs.
  const pairs: [number, number][] = [];
  for (let i = 0; i < N * N; i++) {
    if (i % N < N - 1) pairs.push([i, i + 1]);
    if (i + N < N * N) pairs.push([i, i + N]);
  }
  shuffle(rng, pairs);
  const k = cfg.signs[0] + Math.floor(rng() * (cfg.signs[1] - cfg.signs[0] + 1));
  const used = new Set<number>();
  const signs: Sign[] = [];
  for (const [a, b] of pairs) {
    if (signs.length >= k) break;
    // spread them out: no cell carries two signs
    if (used.has(a) || used.has(b)) continue;
    used.add(a);
    used.add(b);
    signs.push({ a, b, same: solution[a] === solution[b] });
  }

  // Strip givens one at a time while the answer stays unique.
  const givens = solution.slice();
  const removed: number[] = [];
  for (const i of shuffle(rng, range(N * N))) {
    const v = givens[i];
    givens[i] = 0;
    if (countSolutions(givens, signs) === 1) removed.push(i);
    else givens[i] = v;
  }
  // Easier levels hand back a few of the stripped givens.
  for (const i of removed.slice(0, cfg.extraGivens)) givens[i] = solution[i];

  return { game: "tangle", level, seed, givens, signs, solution };
}

/* ------------------------------------------------------------------ */
/* Rules and checking                                                  */
/* ------------------------------------------------------------------ */

export const initialState = (p: TanglePuzzle): TangleState => p.givens.slice();

export interface TangleErrors {
  cells: Set<number>;
  signs: Set<number>; // index into puzzle.signs
}

/** Visible rule breaks in the current grid. */
export function errors(p: TanglePuzzle, s: TangleState): TangleErrors {
  const cells = new Set<number>();
  const signs = new Set<number>();
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const v = s[i];
      if (!v) continue;
      if (c <= N - 3 && s[i + 1] === v && s[i + 2] === v) [i, i + 1, i + 2].forEach((x) => cells.add(x));
      if (r <= N - 3 && s[i + N] === v && s[i + 2 * N] === v) [i, i + N, i + 2 * N].forEach((x) => cells.add(x));
    }
  }
  for (let k = 0; k < N; k++) {
    for (const v of [SUN, MOON]) {
      const row = range(N).map((c) => k * N + c).filter((i) => s[i] === v);
      if (row.length > N / 2) row.forEach((i) => cells.add(i));
      const col = range(N).map((r) => r * N + k).filter((i) => s[i] === v);
      if (col.length > N / 2) col.forEach((i) => cells.add(i));
    }
  }
  p.signs.forEach((sg, k) => {
    if (s[sg.a] && s[sg.b] && (s[sg.a] === s[sg.b]) !== sg.same) signs.add(k);
  });
  return { cells, signs };
}

export function isSolved(p: TanglePuzzle, s: TangleState): boolean {
  if (s.some((v) => !v)) return false;
  const e = errors(p, s);
  return e.cells.size === 0 && e.signs.size === 0;
}

export function hint(p: TanglePuzzle, history: TangleState[]): HintResult<TangleState, number[]> {
  const s = history[history.length - 1];
  const wrong = range(N * N).filter((i) => s[i] && s[i] !== p.solution[i]);
  if (wrong.length) {
    const next = s.slice();
    wrong.forEach((i) => (next[i] = 0));
    return {
      keep: history.length,
      state: next,
      mark: wrong,
      message: `Cleared ${wrong.length} ${wrong.length === 1 ? "cell that doesn't" : "cells that don't"} fit the solution.`,
    };
  }
  // Prefer a cell that the rules already force: the other symbol would break something.
  const at = signIndex(p.signs);
  const open = range(N * N).filter((i) => !s[i]);
  if (!open.length) return { keep: history.length, message: "The grid is full." };
  const forced = open.find((i) => breaks(s, i, p.solution[i] === SUN ? MOON : SUN, at));
  const i = forced ?? open[0];
  const next = s.slice();
  next[i] = p.solution[i];
  const name = p.solution[i] === SUN ? "sun" : "moon";
  return {
    keep: history.length,
    state: next,
    mark: [i],
    message:
      forced !== undefined
        ? `This cell must be a ${name}: the other symbol would break a rule.`
        : `This cell is a ${name}.`,
  };
}
