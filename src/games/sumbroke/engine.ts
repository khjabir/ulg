import { mulberry32 } from "../../core/rng";
import type { BasePuzzle, Problem } from "../../core/puzzle";

/**
 * Sumbroke engine: rules, puzzle generator and solver.
 *
 * Cell encoding (compact so states hash cheaply):
 *   0        empty
 *   n > 0    plain number n
 *   -w       "+w" wildcard          (1 <= w <= 99)
 *   -(100+w) "×w" wildcard
 */

export type Grid = number[];
export type Move = { from: number; to: number };
export type Difficulty = "easy" | "medium" | "hard";

export interface SumbrokePuzzle extends BasePuzzle {
  game: "sumbroke";
  rows: number;
  cols: number;
  grid: Grid;
  solution: Move[];
}
type Puzzle = SumbrokePuzzle;

export const DIFFICULTIES: Record<
  Difficulty,
  { label: string; rows: number; cols: number; wild: [number, number]; finals: number[] }
> = {
  easy: { label: "Easy", rows: 3, cols: 3, wild: [0, 1], finals: [64, 96, 128, 160, 192, 256] },
  medium: { label: "Medium", rows: 4, cols: 4, wild: [1, 2], finals: [128, 192, 256, 320, 384, 512] },
  hard: { label: "Hard", rows: 5, cols: 5, wild: [2, 3], finals: [256, 384, 512, 640, 768, 1024] },
};

/* ------------------------------------------------------------------ */
/* Cell helpers                                                        */
/* ------------------------------------------------------------------ */

export const isEmpty = (c: number) => c === 0;
export const isWild = (c: number) => c < 0;
export const isNum = (c: number) => c > 0;

export function wildOf(c: number): { op: "+" | "×"; value: number } {
  const x = -c;
  return x > 100 ? { op: "×", value: x - 100 } : { op: "+", value: x };
}

export const plusWild = (w: number) => -w;
export const timesWild = (w: number) => -(100 + w);

export function cellLabel(c: number): string {
  if (c === 0) return "";
  if (c > 0) return String(c);
  const { op, value } = wildOf(c);
  return `${op}${value}`;
}

/** Result of dragging `src` onto `dst`, or null when the merge is illegal. */
export function mergeResult(src: number, dst: number): number | null {
  if (src === 0 || dst === 0) return null;
  const sw = src < 0;
  const dw = dst < 0;
  if (!sw && !dw) return src === dst ? src + dst : null;
  if (sw && dw) return null; // two wildcards never merge
  const wild = wildOf(sw ? src : dst);
  const num = sw ? dst : src;
  return wild.op === "+" ? num + wild.value : num * wild.value;
}

export function neighbors(i: number, rows: number, cols: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  if (r > 0) out.push(i - cols);
  if (r < rows - 1) out.push(i + cols);
  if (c > 0) out.push(i - 1);
  if (c < cols - 1) out.push(i + 1);
  return out;
}

export function areAdjacent(a: number, b: number, cols: number): boolean {
  const ra = Math.floor(a / cols), ca = a % cols;
  const rb = Math.floor(b / cols), cb = b % cols;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

export function canMerge(grid: Grid, from: number, to: number, cols: number): boolean {
  return areAdjacent(from, to, cols) && mergeResult(grid[from], grid[to]) !== null;
}

export function applyMove(grid: Grid, m: Move): Grid {
  const r = mergeResult(grid[m.from], grid[m.to]);
  if (r === null) throw new Error("illegal move");
  const g = grid.slice();
  g[m.to] = r;
  g[m.from] = 0;
  return g;
}

export function legalMoves(grid: Grid, rows: number, cols: number): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) continue;
    for (const j of neighbors(i, rows, cols)) {
      if (mergeResult(grid[i], grid[j]) !== null) moves.push({ from: i, to: j });
    }
  }
  return moves;
}

export const pieceCount = (grid: Grid) => grid.reduce((n, c) => n + (c !== 0 ? 1 : 0), 0);
export const isSolved = (grid: Grid) => pieceCount(grid) === 1 && grid.some((c) => c > 0);

/* ------------------------------------------------------------------ */
/* Solver                                                              */
/* ------------------------------------------------------------------ */

function isPow2(n: number) {
  return n > 0 && (n & (n - 1)) === 0;
}

/** All non-empty cells must stay in one edge-connected group: empty cells never refill. */
function connected(grid: Grid, rows: number, cols: number): boolean {
  let start = -1;
  let total = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== 0) {
      total++;
      if (start < 0) start = i;
    }
  }
  if (total <= 1) return true;
  const seen = new Uint8Array(grid.length);
  const stack = [start];
  seen[start] = 1;
  let count = 0;
  while (stack.length) {
    const i = stack.pop()!;
    count++;
    for (const j of neighbors(i, rows, cols)) {
      if (!seen[j] && grid[j] !== 0) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return count === total;
}

/**
 * The smallest numbers on the board can only ever change by merging with another
 * copy of themselves or with a wildcard (nothing else can shrink to their value).
 * So every min-cell needs its own partner: an adjacent min-cell or an adjacent,
 * not-yet-claimed wildcard. Grid graphs are bipartite, so by Mendelsohn–Dulmage it
 * is enough to saturate the min-cells of each checkerboard colour separately.
 */
function minCellsCoverable(grid: Grid, min: number, rows: number, cols: number): boolean {
  const isPartner = (j: number) => grid[j] === min || grid[j] < 0;
  for (const colour of [0, 1]) {
    const side: number[] = [];
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === min && (Math.floor(i / cols) + (i % cols)) % 2 === colour) side.push(i);
    }
    const matchOf = new Map<number, number>();
    const tryAugment = (a: number, seen: Set<number>): boolean => {
      for (const b of neighbors(a, rows, cols)) {
        if (!isPartner(b) || seen.has(b)) continue;
        seen.add(b);
        const cur = matchOf.get(b);
        if (cur === undefined || tryAugment(cur, seen)) {
          matchOf.set(b, a);
          return true;
        }
      }
      return false;
    };
    for (const a of side) if (!tryAugment(a, new Set())) return false;
  }
  return true;
}

/** Cheap impossibility checks. Values never shrink and empty cells never refill. */
function hopeless(grid: Grid, rows: number, cols: number): boolean {
  if (!connected(grid, rows, cols)) return true;
  let pieces = 0;
  let wilds = 0;
  let sum = 0;
  let min = Infinity;
  for (const c of grid) {
    if (c === 0) continue;
    pieces++;
    if (c < 0) wilds++;
    else {
      sum += c;
      if (c < min) min = c;
    }
  }
  if (pieces <= 1) return wilds > 0; // a lone wildcard is not a win
  if (wilds === pieces) return true;

  // A number whose neighbours are all bigger plain numbers is frozen forever:
  // neighbours only grow, and it can only grow by merging with one of them.
  // A wildcard surrounded only by wildcards is equally stuck.
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v === 0) continue;
    let ok = false;
    for (const j of neighbors(i, rows, cols)) {
      const u = grid[j];
      if (u === 0) continue;
      if (v < 0 ? u > 0 : u < 0 || u <= v) {
        ok = true;
        break;
      }
    }
    if (!ok) return true;
  }

  if (wilds === 0) {
    // Only equal merges remain: every value must be sum / 2^k.
    for (const c of grid) {
      if (c > 0 && (sum % c !== 0 || !isPow2(sum / c))) return true;
    }
  }
  if (min !== Infinity && !minCellsCoverable(grid, min, rows, cols)) return true;
  return false;
}

/**
 * Says so when no move is left (or only a lone wildcard remains). Never looks
 * ahead: a board that still has a legal merge is left alone, even if it can't be
 * won any more. The hint finds that out and takes you back.
 */
export function check(p: { rows: number; cols: number }, grid: Grid): Problem | null {
  const { rows, cols } = p;
  const tiles: number[] = [];
  grid.forEach((v, i) => v && tiles.push(i));
  const back = "Undo, or take a hint to go back.";
  if (tiles.length <= 1) {
    return tiles.length === 1 && grid[tiles[0]] < 0
      ? { kind: "stuck", message: `Only a wildcard is left, and it needs a number to work on. ${back}`, cells: tiles }
      : null;
  }
  if (legalMoves(grid, rows, cols).length === 0) {
    return { kind: "stuck", message: `No moves left: no two neighbouring tiles can merge. ${back}`, cells: tiles };
  }
  return null;
}

/** Compact state key: one UTF-16 char per cell. */
export function keyOf(g: Grid): string {
  let s = "";
  for (let i = 0; i < g.length; i++) s += String.fromCharCode(g[i] + 256);
  return s;
}

export type SolveResult = { status: "solved"; moves: Move[] } | { status: "unsolvable" } | { status: "timeout" };

/**
 * Depth-first search with a memo of dead states. Moves from cells with fewer
 * live neighbours ("edges first") are tried first, which finds solutions fast.
 */
export function solve(grid: Grid, rows: number, cols: number, maxNodes = 400_000, dead?: Set<string>): SolveResult {
  const failed = dead ?? new Set<string>();
  let nodes = 0;
  const path: Move[] = [];

  const liveNeighbours = (g: Grid, i: number) => {
    let n = 0;
    for (const j of neighbors(i, rows, cols)) if (g[j] !== 0) n++;
    return n;
  };

  const dfs = (g: Grid): boolean | "timeout" => {
    if (isSolved(g)) return true;
    if (++nodes > maxNodes) return "timeout";
    const key = keyOf(g);
    if (failed.has(key)) return false;
    if (hopeless(g, rows, cols)) {
      failed.add(key);
      return false;
    }
    const moves = legalMoves(g, rows, cols);
    // Small numbers first (they are the most constrained), then cells on the edge of the group.
    const rank = (m: Move) => {
      const a = g[m.from] > 0 ? g[m.from] : g[m.to];
      return a * 8 + liveNeighbours(g, m.from);
    };
    moves.sort((a, b) => rank(a) - rank(b));
    for (const m of moves) {
      const next = applyMove(g, m);
      path.push(m);
      const r = dfs(next);
      if (r === true) return true;
      path.pop();
      if (r === "timeout") return "timeout";
    }
    failed.add(key);
    return false;
  };

  const r = dfs(grid);
  if (r === true) return { status: "solved", moves: path.slice() };
  if (r === "timeout") return { status: "timeout" };
  return { status: "unsolvable" };
}

/* ------------------------------------------------------------------ */
/* Generator: start from one number and "un-merge" it until the grid   */
/* is full. Reversing the splits gives a guaranteed solution.          */
/* ------------------------------------------------------------------ */

type Split = { t: number; s: number; tVal: number; sVal: number };

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function weightedPick<T>(rng: () => number, items: T[], weight: (x: T) => number): T {
  let total = 0;
  const ws = items.map((x) => {
    const w = Math.max(0, weight(x));
    total += w;
    return w;
  });
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function tryGenerate(
  rows: number,
  cols: number,
  rng: () => number,
  finalValue: number,
  wildBudget: number,
  chainBias: number,
): { grid: Grid; solution: Move[] } | null {
  const n = rows * cols;
  const grid: Grid = new Array(n).fill(0);
  const start = Math.floor(rng() * n);
  grid[start] = finalValue;
  const reverseMoves: Move[] = [];
  let wilds = wildBudget;
  let last = start;
  let filled = 1;
  // Spread the wildcards over the build so they don't all cluster at the start.
  const wildEvery = wildBudget > 0 ? Math.max(1, Math.floor((n - 1) / (wildBudget + 1))) : Infinity;

  while (filled < n) {
    const options: Split[] = [];
    const wildOptions: Split[] = [];
    for (let t = 0; t < n; t++) {
      const v = grid[t];
      if (v <= 0) continue;
      for (const s of neighbors(t, rows, cols)) {
        if (grid[s] !== 0) continue;
        if (v % 2 === 0) options.push({ t, s, tVal: v / 2, sVal: v / 2 });
        if (wilds > 0 && v >= 4 && v <= 48) {
          for (let w = 1; w <= 4; w++) {
            const num = v - w;
            if (num < 2) continue;
            // wildcard can sit on either side of the merge
            wildOptions.push({ t, s, tVal: num, sVal: plusWild(w) });
            wildOptions.push({ t, s, tVal: plusWild(w), sVal: num });
          }
          for (const w of [2, 3]) {
            if (v % w !== 0 || v / w < 2) continue;
            const num = v / w;
            wildOptions.push({ t, s, tVal: num, sVal: timesWild(w) });
            wildOptions.push({ t, s, tVal: timesWild(w), sVal: num });
          }
        }
      }
    }

    const wantWild = wildOptions.length > 0 && (filled % wildEvery === 0 || options.length === 0 || rng() < 0.08);
    const pool = wantWild ? wildOptions : options;
    if (pool.length === 0) return null;

    const lastNeighbours = new Set(neighbors(last, rows, cols));
    const counts = new Map<number, number>();
    for (const c of grid) if (c > 0) counts.set(c, (counts.get(c) ?? 0) + 1);
    const split = weightedPick(rng, pool, (o) => {
      const v = grid[o.t];
      let w = Math.pow(v, 0.8);
      if (o.t === last || lastNeighbours.has(o.t)) w *= 1 + chainBias * 6;
      // prefer splits that keep values integer-friendly (more future options)
      if (o.tVal > 0 && o.tVal % 2 === 1 && o.tVal > 1) w *= 0.6;
      // keep the board varied: discourage piling up many copies of one number
      const half = o.tVal > 0 ? o.tVal : o.sVal;
      w /= 1 + 0.6 * (counts.get(half) ?? 0) ** 2;
      return w;
    });

    grid[split.t] = split.tVal;
    grid[split.s] = split.sVal;
    if (split.sVal < 0 || split.tVal < 0) wilds--;
    reverseMoves.push({ from: split.s, to: split.t });
    last = rng() < 0.5 ? split.t : split.s;
    filled++;
  }

  // Reject boards with the reserved budget unused on larger sizes (keeps wildcards in play)
  if (wildBudget > 0 && wilds === wildBudget) return null;

  return { grid, solution: reverseMoves.reverse() };
}

/** How many traps: share of opening moves that already make the puzzle unsolvable. */
export function trapRatio(grid: Grid, rows: number, cols: number, maxNodes = 4_000, sample = 12): number {
  let moves = legalMoves(grid, rows, cols);
  if (!moves.length) return 0;
  if (moves.length > sample) {
    const step = moves.length / sample;
    moves = Array.from({ length: sample }, (_, k) => moves[Math.floor(k * step)]);
  }
  let dead = 0;
  const memo = new Set<string>();
  for (const m of moves) {
    const r = solve(applyMove(grid, m), rows, cols, maxNodes, memo);
    if (r.status === "unsolvable") dead++;
  }
  return dead / moves.length;
}

const MIN_DISTINCT: Record<Difficulty, number> = { easy: 4, medium: 6, hard: 7 };
const MIN_TRAPS: Record<Difficulty, number> = { easy: 0.15, medium: 0.25, hard: 0.2 };

export function generate(level: string, seed: number): Puzzle {
  const difficulty: Difficulty = level === "medium" || level === "hard" ? level : "easy";
  const cfg = DIFFICULTIES[difficulty];
  const rng = mulberry32(seed);
  let fallback: { grid: Grid; solution: Move[] } | null = null;

  for (let attempt = 0; attempt < 300; attempt++) {
    const finalValue = pick(rng, cfg.finals);
    const wildBudget = cfg.wild[0] + Math.floor(rng() * (cfg.wild[1] - cfg.wild[0] + 1));
    const chainBias = 0.2 + rng() * 0.7;
    const res = tryGenerate(cfg.rows, cfg.cols, rng, finalValue, wildBudget, chainBias);
    if (!res) continue;
    // Keep numbers readable and the board varied
    if (Math.max(...res.grid) > 512) continue;
    const distinct = new Set(res.grid.filter((c) => c > 0)).size;
    if (distinct < MIN_DISTINCT[difficulty]) continue;
    // Hints rely on the solver, so it must crack the opening quickly
    if (solve(res.grid, cfg.rows, cfg.cols, 20_000).status !== "solved") continue;
    fallback ??= res;
    // Make sure there are real decisions to get wrong
    if (trapRatio(res.grid, cfg.rows, cfg.cols) < MIN_TRAPS[difficulty]) continue;
    return { game: "sumbroke", level: difficulty, seed, rows: cfg.rows, cols: cfg.cols, grid: res.grid, solution: res.solution };
  }

  if (!fallback) throw new Error("could not generate puzzle");
  return { game: "sumbroke", level: difficulty, seed, rows: cfg.rows, cols: cfg.cols, grid: fallback.grid, solution: fallback.solution };
}

/* ------------------------------------------------------------------ */
/* Hints                                                               */
/* ------------------------------------------------------------------ */

export type Hint = { rewindTo: number; move: Move };

/**
 * Find the latest position in the player's history that can still be solved, and
 * the next merge from there. `rewindTo` is the index of that position in `states`.
 */
export function findHintStates(puzzle: Puzzle, states: Grid[]): Hint {
  const { rows, cols } = puzzle;

  // Positions on the shipped solution path are known to be good.
  const known = new Map<string, number>();
  let g = puzzle.grid;
  puzzle.solution.forEach((m, k) => {
    known.set(keyOf(g), k);
    g = applyMove(g, m);
  });

  const dead = new Set<string>();
  for (let k = states.length - 1; k >= 0; k--) {
    if (isSolved(states[k])) continue;
    const idx = known.get(keyOf(states[k]));
    if (idx !== undefined) return { rewindTo: k, move: puzzle.solution[idx] };
    const budget = k === states.length - 1 ? 150_000 : 40_000;
    const r = solve(states[k], rows, cols, budget, dead);
    if (r.status === "solved" && r.moves.length) return { rewindTo: k, move: r.moves[0] };
  }
  return { rewindTo: 0, move: puzzle.solution[0] };
}
