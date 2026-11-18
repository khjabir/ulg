import { mulberry32, range, shuffle, neighbours4, type Rng } from "../../core/rng";
import type { BasePuzzle, HintResult, Problem } from "../../core/puzzle";

/**
 * Kings: one king per row, column and coloured region; kings never touch,
 * not even diagonally. Every generated puzzle has exactly one solution.
 *
 * State: one entry per cell — 0 empty, 1 marked X, 2 king.
 */

export interface KingsPuzzle extends BasePuzzle {
  game: "kings";
  n: number;
  regions: number[];
  /** column of the king in each row */
  solution: number[];
}
export type KingsState = number[];
export const EMPTY = 0;
export const MARK = 1;
export const KING = 2;

export const KINGS_SIZES: Record<string, number> = { easy: 7, medium: 8, hard: 9 };

function randomPlacement(n: number, rng: Rng): number[] | null {
  const cols: number[] = new Array(n);
  const used = new Uint8Array(n);
  const rec = (r: number): boolean => {
    if (r === n) return true;
    for (const c of shuffle(rng, range(n))) {
      if (used[c] || (r > 0 && Math.abs(cols[r - 1] - c) < 2)) continue;
      used[c] = 1;
      cols[r] = c;
      if (rec(r + 1)) return true;
      used[c] = 0;
    }
    return false;
  };
  return rec(0) ? cols : null;
}

/** Grow one region from each king until the board is covered. Uneven weights give a mix of tiny and sprawling regions. */
function growRegions(n: number, cols: number[], rng: Rng): number[] {
  const region = new Array(n * n).fill(-1);
  const weight = cols.map(() => 0.3 + rng() * 1.7);
  cols.forEach((c, r) => (region[r * n + c] = r));
  let remaining = n * n - n;
  while (remaining > 0) {
    const frontier: number[][] = cols.map(() => []);
    for (let i = 0; i < n * n; i++) {
      if (region[i] !== -1) continue;
      for (const j of neighbours4(i, n, n)) {
        if (region[j] !== -1) frontier[region[j]].push(i);
      }
    }
    let total = 0;
    for (let k = 0; k < n; k++) if (frontier[k].length) total += weight[k];
    let x = rng() * total;
    let k = 0;
    for (; k < n; k++) {
      if (!frontier[k].length) continue;
      x -= weight[k];
      if (x <= 0) break;
    }
    if (k === n) k = frontier.findIndex((f) => f.length);
    const cell = frontier[k][Math.floor(rng() * frontier[k].length)];
    region[cell] = k;
    remaining--;
  }
  return region;
}

/** Find up to `limit` solutions. Row by row: column, region and touching checks. */
export function findSolutions(n: number, regions: number[], limit = 2): number[][] {
  const colUsed = new Uint8Array(n);
  const regUsed = new Uint8Array(n);
  const cols: number[] = new Array(n);
  const found: number[][] = [];
  const rec = (r: number, prev: number): boolean => {
    if (r === n) {
      found.push(cols.slice());
      return found.length >= limit;
    }
    for (let c = 0; c < n; c++) {
      if (colUsed[c] || Math.abs(prev - c) < 2) continue;
      const g = regions[r * n + c];
      if (regUsed[g]) continue;
      colUsed[c] = regUsed[g] = 1;
      cols[r] = c;
      if (rec(r + 1, c)) return true;
      colUsed[c] = regUsed[g] = 0;
    }
    return false;
  };
  rec(0, -10);
  return found;
}

export const countSolutions = (n: number, regions: number[], limit = 2) => findSolutions(n, regions, limit).length;

/** Is region `g` still edge-connected if cell `without` leaves it? */
function connectedWithout(n: number, regions: number[], g: number, without: number): boolean {
  const cells = [];
  for (let i = 0; i < n * n; i++) if (regions[i] === g && i !== without) cells.push(i);
  if (cells.length === 0) return false;
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of neighbours4(i, n, n)) {
      if (j !== without && regions[j] === g && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === cells.length;
}

/**
 * Knock out rival solutions: move one of a rival's king cells into a neighbouring
 * region. The rival then has two kings in that region, while the intended
 * solution (which has no king on that cell) is untouched.
 */
function makeUnique(n: number, regions: number[], solution: number[], rng: Rng): boolean {
  const answer = new Set(solution.map((c, r) => r * n + c));
  for (let step = 0; step < 300; step++) {
    const sols = findSolutions(n, regions, 2);
    if (sols.length === 1) return true;
    const rival = sols.find((s) => s.some((c, r) => c !== solution[r]));
    if (!rival) return false;
    const options: { cell: number; to: number }[] = [];
    rival.forEach((c, r) => {
      const cell = r * n + c;
      if (answer.has(cell)) return;
      if (!connectedWithout(n, regions, regions[cell], cell)) return;
      for (const j of neighbours4(cell, n, n)) {
        if (regions[j] !== regions[cell]) options.push({ cell, to: regions[j] });
      }
    });
    if (!options.length) return false;
    const o = options[Math.floor(rng() * options.length)];
    regions[o.cell] = o.to;
  }
  return false;
}

export function generate(level: string, seed: number): KingsPuzzle {
  const n = KINGS_SIZES[level] ?? 7;
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const cols = randomPlacement(n, rng);
    if (!cols) continue;
    const regions = growRegions(n, cols, rng);
    if (makeUnique(n, regions, cols, rng)) {
      return { game: "kings", level, seed, n, regions, solution: cols };
    }
  }
  throw new Error("could not generate kings puzzle");
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

/** Cells whose king breaks a rule (shares a row, column or region, or touches another). */
export function conflicts(p: KingsPuzzle, s: KingsState): Set<number> {
  const { n, regions } = p;
  const kings: number[] = [];
  s.forEach((v, i) => v === KING && kings.push(i));
  const bad = new Set<number>();
  for (let a = 0; a < kings.length; a++) {
    for (let b = a + 1; b < kings.length; b++) {
      const i = kings[a];
      const j = kings[b];
      const ri = Math.floor(i / n), ci = i % n, rj = Math.floor(j / n), cj = j % n;
      if (ri === rj || ci === cj || regions[i] === regions[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  return bad;
}

/**
 * The first broken rule (two kings in one line or colour, or touching), else a row,
 * column or colour that still needs a king but has no cell left for one.
 */
export function check(p: KingsPuzzle, s: KingsState): Problem | null {
  const { n, regions } = p;
  const row = (i: number) => Math.floor(i / n);
  const col = (i: number) => i % n;
  const kings: number[] = [];
  s.forEach((v, i) => v === KING && kings.push(i));

  for (let a = 0; a < kings.length; a++) {
    for (let b = a + 1; b < kings.length; b++) {
      const i = kings[a];
      const j = kings[b];
      const cells = [i, j];
      if (row(i) === row(j)) return { kind: "rule", message: "Two kings share a row. Each row gets exactly one.", cells };
      if (col(i) === col(j)) return { kind: "rule", message: "Two kings share a column. Each column gets exactly one.", cells };
      if (regions[i] === regions[j]) return { kind: "rule", message: "Two kings share a colour. Each colour gets exactly one.", cells };
      if (Math.abs(row(i) - row(j)) <= 1 && Math.abs(col(i) - col(j)) <= 1)
        return { kind: "rule", message: "These kings touch. Kings can't sit next to each other, not even diagonally.", cells };
    }
  }

  const blocked = (i: number) =>
    s[i] === MARK ||
    kings.some(
      (k) =>
        row(k) === row(i) ||
        col(k) === col(i) ||
        regions[k] === regions[i] ||
        (Math.abs(row(k) - row(i)) <= 1 && Math.abs(col(k) - col(i)) <= 1),
    );
  const units: { name: string; cells: number[] }[] = [];
  for (let r = 0; r < n; r++) units.push({ name: "row", cells: range(n).map((c) => r * n + c) });
  for (let c = 0; c < n; c++) units.push({ name: "column", cells: range(n).map((r) => r * n + c) });
  const byRegion = new Map<number, number[]>();
  regions.forEach((g, i) => byRegion.set(g, [...(byRegion.get(g) ?? []), i]));
  for (const cells of byRegion.values()) units.push({ name: "colour", cells });

  for (const u of units) {
    if (u.cells.some((i) => s[i] === KING)) continue;
    if (!u.cells.every(blocked)) continue;
    const message = u.cells.every((i) => s[i] === MARK)
      ? `Every cell in this ${u.name} is crossed out, but it still needs a king. Clear an X.`
      : `There's no room left for a king in this ${u.name}. Move a king or clear an X.`;
    return { kind: "stuck", message, cells: u.cells };
  }
  return null;
}

export function isSolved(p: KingsPuzzle, s: KingsState): boolean {
  const count = s.reduce((k, v) => k + (v === KING ? 1 : 0), 0);
  return count === p.n && conflicts(p, s).size === 0;
}

export const initialState = (p: KingsPuzzle): KingsState => new Array(p.n * p.n).fill(EMPTY);

/** Cells an X can safely go on once a king sits at `i`. */
export function attackedBy(p: KingsPuzzle, i: number): number[] {
  const { n, regions } = p;
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  for (let j = 0; j < n * n; j++) {
    if (j === i) continue;
    const rj = Math.floor(j / n), cj = j % n;
    if (rj === r || cj === c || regions[j] === regions[i] || (Math.abs(rj - r) <= 1 && Math.abs(cj - c) <= 1)) out.push(j);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Hint                                                                */
/* ------------------------------------------------------------------ */

export function hint(p: KingsPuzzle, history: KingsState[]): HintResult<KingsState, number[]> {
  const s = history[history.length - 1];
  const { n } = p;
  const answer = new Set(p.solution.map((c, r) => r * n + c));
  const wrong: number[] = [];
  s.forEach((v, i) => {
    if ((v === KING && !answer.has(i)) || (v === MARK && answer.has(i))) wrong.push(i);
  });
  if (wrong.length) {
    const next = s.slice();
    for (const i of wrong) next[i] = EMPTY;
    const kings = wrong.filter((i) => s[i] === KING).length;
    const marks = wrong.length - kings;
    const parts = [
      kings ? `${kings} ${kings === 1 ? "king" : "kings"}` : "",
      marks ? `${marks} ${marks === 1 ? "X" : "X marks"}` : "",
    ].filter(Boolean);
    return {
      keep: history.length,
      state: next,
      mark: wrong,
      message: `Cleared ${parts.join(" and ")} that can't be part of the solution.`,
    };
  }
  // Place the king of the region with the fewest open cells.
  const openPerRegion = new Map<number, number>();
  s.forEach((v, i) => v === EMPTY && openPerRegion.set(p.regions[i], (openPerRegion.get(p.regions[i]) ?? 0) + 1));
  let best = -1;
  let bestOpen = Infinity;
  for (const i of answer) {
    if (s[i] === KING) continue;
    const open = openPerRegion.get(p.regions[i]) ?? 0;
    if (open < bestOpen) {
      bestOpen = open;
      best = i;
    }
  }
  if (best < 0) return { keep: history.length, message: "Every king is already placed." };
  const next = s.slice();
  next[best] = KING;
  return {
    keep: history.length,
    state: next,
    mark: [best],
    message: `Row ${Math.floor(best / n) + 1}, column ${(best % n) + 1} holds a king.`,
  };
}
