import { mulberry32, neighbours4, type Rng } from "../../core/rng";
import type { BasePuzzle, HintResult, Problem } from "../../core/puzzle";

/**
 * Zap: draw one path that starts on 1, passes the numbers in order, ends on the
 * last number and fills every cell exactly once. Walls block moves.
 * Every generated puzzle has exactly one solution.
 */

export interface ZapPuzzle extends BasePuzzle {
  game: "zap";
  rows: number;
  cols: number;
  numbers: number[]; // per cell: 0 or 1..K
  walls: [number, number][]; // neighbouring cells with a wall between them (a < b)
  solution: number[];
}
export type ZapState = number[]; // cells of the drawn path, starting on 1

const LEVELS: Record<string, { size: number; waypoints: number; walls: number; wallBias: number }> = {
  easy: { size: 6, waypoints: 8, walls: 0, wallBias: 0 },
  medium: { size: 7, waypoints: 7, walls: 6, wallBias: 0.6 },
  hard: { size: 8, waypoints: 6, walls: 12, wallBias: 0.85 },
};

export const wallKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Random Hamiltonian path by "backbite" moves, starting from a snake. */
function randomHamiltonianPath(rows: number, cols: number, rng: Rng): number[] {
  const n = rows * cols;
  const path: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) path.push(r * cols + (r % 2 ? cols - 1 - k : k));
  }
  const pos = new Int32Array(n);
  const reindex = (from: number) => {
    for (let i = from; i < n; i++) pos[path[i]] = i;
  };
  reindex(0);
  const steps = n * n * 2;
  for (let s = 0; s < steps; s++) {
    if (rng() < 0.5) {
      path.reverse();
      reindex(0);
    }
    const end = path[n - 1];
    const prev = path[n - 2];
    const options = neighbours4(end, rows, cols).filter((q) => q !== prev);
    const q = options[Math.floor(rng() * options.length)];
    const i = pos[q];
    // path[0..i] + reverse(path[i+1..end])
    let a = i + 1;
    let b = n - 1;
    while (a < b) {
      [path[a], path[b]] = [path[b], path[a]];
      a++;
      b--;
    }
    reindex(i + 1);
  }
  return path;
}

interface SolveOut {
  paths: number[][];
  timeout: boolean;
}

/** Enumerate solutions up to `limit`, with dead-end and connectivity pruning. */
export function solvePaths(
  rows: number,
  cols: number,
  numbers: number[],
  walls: Set<string>,
  limit = 2,
  maxNodes = 250_000,
): SolveOut {
  const n = rows * cols;
  const K = Math.max(...numbers);
  const start = numbers.indexOf(1);
  const end = numbers.indexOf(K);
  const adj: number[][] = [];
  for (let i = 0; i < n; i++) adj.push(neighbours4(i, rows, cols).filter((j) => !walls.has(wallKey(i, j))));
  const visited = new Uint8Array(n);
  const path: number[] = [start];
  visited[start] = 1;
  const found: number[][] = [];
  let nodes = 0;
  let timeout = false;
  const stack = new Int32Array(n);
  const seen = new Uint8Array(n);

  const hopeless = (head: number, len: number): boolean => {
    // dead ends: an open cell with one way in must be the end
    let deadEnds = 0;
    for (let u = 0; u < n; u++) {
      if (visited[u]) continue;
      let free = 0;
      for (const v of adj[u]) if (!visited[v] || v === head) free++;
      if (free === 0) return true;
      if (free === 1) {
        if (u !== end) return true;
        deadEnds++;
      }
    }
    if (deadEnds > 1) return true;
    // all open cells reachable from the head
    seen.fill(0);
    let sp = 0;
    let count = 0;
    stack[sp++] = head;
    seen[head] = 1;
    while (sp) {
      const u = stack[--sp];
      for (const v of adj[u]) {
        if (!visited[v] && !seen[v]) {
          seen[v] = 1;
          count++;
          stack[sp++] = v;
        }
      }
    }
    return count !== n - len;
  };

  const dfs = (head: number, len: number, next: number): boolean => {
    if (len === n) {
      if (head === end) found.push(path.slice());
      return found.length >= limit;
    }
    if (++nodes > maxNodes) {
      timeout = true;
      return true;
    }
    for (const v of adj[head]) {
      if (visited[v]) continue;
      const k = numbers[v];
      if (k && k !== next) continue;
      if (v === end && len + 1 !== n) continue;
      visited[v] = 1;
      path.push(v);
      if (!hopeless(v, len + 1) && dfs(v, len + 1, k ? next + 1 : next)) return true;
      path.pop();
      visited[v] = 0;
    }
    return false;
  };

  if (!hopeless(start, 1)) dfs(start, 1, 2);
  return { paths: found, timeout };
}

export function generate(level: string, seed: number): ZapPuzzle {
  const cfg = LEVELS[level] ?? LEVELS.easy;
  const rng = mulberry32(seed);
  const rows = cfg.size;
  const cols = cfg.size;
  const n = rows * cols;

  for (let attempt = 0; attempt < 20; attempt++) {
    const path = randomHamiltonianPath(rows, cols, rng);
    const pos = new Int32Array(n);
    path.forEach((c, i) => (pos[c] = i));

    // Checkpoints spread along the path (by path index).
    const way = new Set<number>([0, n - 1]);
    const gaps = cfg.waypoints - 1;
    for (let g = 1; g < gaps; g++) {
      const centre = Math.round((g * (n - 1)) / gaps);
      const jitter = Math.round((rng() - 0.5) * ((n - 1) / gaps) * 0.6);
      way.add(Math.min(n - 2, Math.max(1, centre + jitter)));
    }
    const walls: [number, number][] = [];
    const wallSet = new Set<string>();

    for (let step = 0; step < 120; step++) {
      const order = [...way].sort((a, b) => a - b);
      const numbers = new Array(n).fill(0);
      order.forEach((idx, k) => (numbers[path[idx]] = k + 1));
      const res = solvePaths(rows, cols, numbers, wallSet);
      if (!res.timeout && res.paths.length === 1) {
        // Trim checkpoints the walls and the rest already make redundant.
        for (const idx of order.slice(1, -1)) {
          way.delete(idx);
          const o = [...way].sort((a, b) => a - b);
          const nums = new Array(n).fill(0);
          o.forEach((ix, k) => (nums[path[ix]] = k + 1));
          const r = solvePaths(rows, cols, nums, wallSet, 2, 60_000);
          if (r.timeout || r.paths.length !== 1) way.add(idx);
        }
        const final = [...way].sort((a, b) => a - b);
        const nums = new Array(n).fill(0);
        final.forEach((ix, k) => (nums[path[ix]] = k + 1));
        return { game: "zap", level, seed, rows, cols, numbers: nums, walls, solution: path };
      }
      if (res.timeout || !res.paths.length) {
        // Too open to prove: add a checkpoint in the middle of the longest stretch.
        let bestGap = 0;
        let at = -1;
        for (let k = 1; k < order.length; k++) {
          if (order[k] - order[k - 1] > bestGap) {
            bestGap = order[k] - order[k - 1];
            at = Math.floor((order[k] + order[k - 1]) / 2);
          }
        }
        if (at <= 0 || way.has(at)) break;
        way.add(at);
        continue;
      }
      const rival = res.paths.find((p) => p.some((c, i) => c !== path[i]))!;
      // Option 1: a wall on a step the rival takes but the answer doesn't.
      if (walls.length < cfg.walls && rng() < cfg.wallBias) {
        const steps: [number, number][] = [];
        for (let i = 0; i + 1 < rival.length; i++) {
          const a = rival[i];
          const b = rival[i + 1];
          if (Math.abs(pos[a] - pos[b]) !== 1) steps.push([Math.min(a, b), Math.max(a, b)]);
        }
        if (steps.length) {
          const w = steps[Math.floor(rng() * steps.length)];
          walls.push(w);
          wallSet.add(wallKey(w[0], w[1]));
          continue;
        }
      }
      // Option 2: checkpoints that the rival visits in the wrong order.
      const d = rival.findIndex((c, i) => c !== path[i]);
      way.add(d);
      way.add(pos[rival[d]]);
    }
  }
  throw new Error("could not generate zap puzzle");
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export const initialState = (p: ZapPuzzle): ZapState => [p.numbers.indexOf(1)];

export const lastNumber = (p: ZapPuzzle) => Math.max(...p.numbers);

/** Next checkpoint the path must reach, given the path so far. */
export function nextNumber(p: ZapPuzzle, path: ZapState): number {
  let next = 1;
  for (const c of path) if (p.numbers[c] === next) next++;
  return next;
}

/** Can the path step from its head onto `cell`? */
export function canStep(p: ZapPuzzle, path: ZapState, cell: number, walls: Set<string>): boolean {
  const head = path[path.length - 1];
  const hr = Math.floor(head / p.cols), hc = head % p.cols;
  const r = Math.floor(cell / p.cols), c = cell % p.cols;
  if (Math.abs(hr - r) + Math.abs(hc - c) !== 1) return false;
  if (walls.has(wallKey(head, cell))) return false;
  if (path.includes(cell)) return false;
  const K = lastNumber(p);
  if (p.numbers[head] === K && nextNumber(p, path) > K) return false; // finished on the last number
  const k = p.numbers[cell];
  if (k && k !== nextNumber(p, path)) return false;
  return true;
}

export function isSolved(p: ZapPuzzle, path: ZapState): boolean {
  const n = p.rows * p.cols;
  if (path.length !== n || new Set(path).size !== n) return false;
  const walls = new Set(p.walls.map(([a, b]) => wallKey(a, b)));
  let next = 1;
  for (let i = 0; i < n; i++) {
    const c = path[i];
    if (i > 0) {
      const a = path[i - 1];
      const d = Math.abs(Math.floor(a / p.cols) - Math.floor(c / p.cols)) + Math.abs((a % p.cols) - (c % p.cols));
      if (d !== 1 || walls.has(wallKey(a, c))) return false;
    }
    if (p.numbers[c]) {
      if (p.numbers[c] !== next) return false;
      next++;
    }
  }
  return p.numbers[path[n - 1]] === lastNumber(p);
}

/**
 * Dead ends, in the order a player would want to hear about them. Everything here is
 * provable from the board alone: the path is finished too early, can't move, has cut
 * cells off, can't reach the next number, or has left a cell with only one way in.
 */
export function check(p: ZapPuzzle, path: ZapState): Problem | null {
  const { rows, cols } = p;
  const n = rows * cols;
  if (path.length >= n) return null;
  const K = lastNumber(p);
  const head = path[path.length - 1];
  const walls = new Set(p.walls.map(([a, b]) => wallKey(a, b)));
  const on = new Uint8Array(n);
  for (const c of path) on[c] = 1;
  const free: number[] = [];
  for (let i = 0; i < n; i++) if (!on[i]) free.push(i);
  const left = free.length;
  const cellsWord = (k: number) => (k === 1 ? "1 cell is" : `${k} cells are`);
  const links = (i: number) => neighbours4(i, rows, cols).filter((q) => !walls.has(wallKey(i, q)));
  const next = nextNumber(p, path);

  if (p.numbers[head] === K && next > K) {
    return {
      kind: "stuck",
      message: `The path ends on ${K}, but ${cellsWord(left)} still empty. Back up and take a longer way round.`,
      cells: free,
    };
  }

  if (!links(head).some((q) => canStep(p, path, q, walls))) {
    return {
      kind: "stuck",
      message: "Dead end: the path can't go anywhere from here. Drag back along it, or undo.",
      cells: [head],
    };
  }

  // Free cells the path can still reach. The last number ends the path, so nothing
  // beyond it counts as reachable.
  const seen = new Uint8Array(n);
  const stack = [head];
  seen[head] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    if (c !== head && p.numbers[c] === K) continue;
    for (const q of links(c)) {
      if (!seen[q] && !on[q]) {
        seen[q] = 1;
        stack.push(q);
      }
    }
  }
  const cutOff = free.filter((c) => !seen[c]);
  if (cutOff.length) {
    return {
      kind: "stuck",
      message: `${cutOff.length === 1 ? "This cell is" : "These cells are"} cut off, so the path can't fill ${cutOff.length === 1 ? "it" : "them"}. Back up and leave a way through.`,
      cells: cutOff,
    };
  }

  // The next number must be reachable without crossing a later one.
  const target = p.numbers.indexOf(next);
  if (target >= 0 && !on[target]) {
    const seen2 = new Uint8Array(n);
    const todo = [head];
    seen2[head] = 1;
    while (todo.length) {
      const c = todo.pop()!;
      for (const q of links(c)) {
        if (seen2[q] || on[q] || (p.numbers[q] && q !== target)) continue;
        seen2[q] = 1;
        todo.push(q);
      }
    }
    if (!seen2[target]) {
      return {
        kind: "stuck",
        message: `The path can't reach ${next} now without crossing a later number. Back up and go another way.`,
        cells: [target],
      };
    }
  }

  // Every empty cell except the last number needs a way in and a way out.
  const end = p.numbers.indexOf(K);
  const pinched = free.filter((c) => c !== end && links(c).filter((q) => !on[q] || q === head).length < 2);
  if (pinched.length) {
    return {
      kind: "stuck",
      message: `The path could get into ${pinched.length === 1 ? "this cell" : "these cells"} but never out again. Back up and pass through ${pinched.length === 1 ? "it" : "them"}.`,
      cells: pinched,
    };
  }
  return null;
}

export function hint(p: ZapPuzzle, history: ZapState[]): HintResult<ZapState, number[]> {
  const path = history[history.length - 1];
  let k = 0;
  while (k < path.length && path[k] === p.solution[k]) k++;
  const kept = path.slice(0, Math.max(1, k));
  const add: number[] = [];
  for (let i = kept.length; i < p.solution.length && add.length < 4; i++) {
    add.push(p.solution[i]);
    if (p.numbers[p.solution[i]]) break;
  }
  const rewound = path.length - kept.length;
  return {
    keep: history.length,
    state: kept.concat(add),
    mark: add,
    message:
      rewound > 0
        ? `Took the path back to your last correct cell, then added the next ${add.length === 1 ? "step" : "steps"}.`
        : `Added the next ${add.length === 1 ? "step" : `${add.length} steps`} of the path.`,
  };
}
