import { mulberry32, range, shuffle, type Rng } from "../../core/rng";
import type { BasePuzzle, HintResult, Problem } from "../../core/puzzle";

/**
 * Sixdoku (mini sudoku): 6×6, boxes of 2 rows × 3 columns, digits 1–6 once per row,
 * column and box. Every generated puzzle has exactly one solution.
 */

export const N = 6;
export const BOX_R = 2;
export const BOX_C = 3;

export interface SudokuPuzzle extends BasePuzzle {
  game: "sixdoku";
  givens: number[]; // 0 = open
  solution: number[];
}
export interface SudokuState {
  values: number[];
  notes: number[]; // bit d set = pencil mark for digit d
}

const TARGET_GIVENS: Record<string, number> = { easy: 16, medium: 12, hard: 0 };

export const boxOf = (i: number) => Math.floor(Math.floor(i / N) / BOX_R) * (N / BOX_C) + Math.floor((i % N) / BOX_C);

/** Every cell that shares a row, column or box with i. */
export const PEERS: number[][] = range(N * N).map((i) =>
  range(N * N).filter(
    (j) => j !== i && (Math.floor(j / N) === Math.floor(i / N) || j % N === i % N || boxOf(j) === boxOf(i)),
  ),
);

export function candidates(g: number[], i: number): number[] {
  const used = new Set(PEERS[i].map((j) => g[j]));
  return range(N)
    .map((d) => d + 1)
    .filter((d) => !used.has(d));
}

function randomSolution(rng: Rng): number[] {
  const g = new Array(N * N).fill(0);
  const rec = (i: number): boolean => {
    if (i === N * N) return true;
    for (const d of shuffle(rng, candidates(g, i))) {
      g[i] = d;
      if (rec(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  rec(0);
  return g;
}

export function countSolutions(givens: number[], limit = 2): number {
  const g = givens.slice();
  let count = 0;
  const rec = (): boolean => {
    // most constrained open cell first
    let best = -1;
    let bestC: number[] = [];
    for (let i = 0; i < N * N; i++) {
      if (g[i]) continue;
      const c = candidates(g, i);
      if (c.length === 0) return false;
      if (best < 0 || c.length < bestC.length) {
        best = i;
        bestC = c;
      }
    }
    if (best < 0) return ++count >= limit;
    for (const d of bestC) {
      g[best] = d;
      if (rec()) return true;
    }
    g[best] = 0;
    return false;
  };
  rec();
  return count;
}

export function generate(level: string, seed: number): SudokuPuzzle {
  const rng = mulberry32(seed);
  const solution = randomSolution(rng);
  const target = TARGET_GIVENS[level] ?? 16;
  const givens = solution.slice();
  let count = N * N;
  for (const i of shuffle(rng, range(N * N))) {
    if (count <= target) break;
    const v = givens[i];
    givens[i] = 0;
    if (countSolutions(givens) === 1) count--;
    else givens[i] = v;
  }
  return { game: "sixdoku", level, seed, givens, solution };
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export const initialState = (p: SudokuPuzzle): SudokuState => ({
  values: p.givens.slice(),
  notes: new Array(N * N).fill(0),
});

/** Cells holding a digit that repeats in their row, column or box. */
export function conflicts(values: number[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < N * N; i++) {
    if (!values[i]) continue;
    for (const j of PEERS[i]) if (values[j] === values[i]) bad.add(i);
  }
  return bad;
}

/** Rows, columns and boxes, each a list of cells. */
const UNITS: { name: "row" | "column" | "box"; cells: number[] }[] = [
  ...range(N).map((r) => ({ name: "row" as const, cells: range(N).map((c) => r * N + c) })),
  ...range(N).map((c) => ({ name: "column" as const, cells: range(N).map((r) => r * N + c) })),
  ...range(N).map((b) => ({ name: "box" as const, cells: range(N * N).filter((i) => boxOf(i) === b) })),
];

/**
 * Digits that collide: the same digit twice in a row, column or box. Every clashing
 * cell is ringed and the message names the first clash. Nothing else: a digit that
 * is wrong but clashes with nothing yet is left alone, just like on paper. (The hint
 * is what compares with the answer.) A full board with no clashes is solved.
 */
export function check(_p: SudokuPuzzle, s: SudokuState): Problem | null {
  const g = s.values;
  const clashing = conflicts(g);
  if (!clashing.size) return null;
  for (const u of UNITS) {
    for (let d = 1; d <= N; d++) {
      const cells = u.cells.filter((i) => g[i] === d);
      if (cells.length > 1) {
        return {
          kind: "rule",
          message: `This ${u.name} has ${cells.length === 2 ? "two" : cells.length} ${d}s. Each digit goes in a ${u.name} only once.`,
          cells: [...clashing],
        };
      }
    }
  }
  return null;
}

export function isSolved(_p: SudokuPuzzle, s: SudokuState): boolean {
  return s.values.every(Boolean) && conflicts(s.values).size === 0;
}

/** Place a digit and clear that digit from the notes of its peers. */
/**
 * Put a digit in a cell (0 takes it out). As in LinkedIn's Mini Sudoku, the cell's
 * own notes are only hidden under the digit: take the digit out and they come back.
 * The digit is crossed off its row, column and box neighbours' notes.
 */
export function placeDigit(s: SudokuState, i: number, d: number): SudokuState {
  const values = s.values.slice();
  const notes = s.notes.slice();
  values[i] = d;
  if (d) for (const j of PEERS[i]) notes[j] &= ~(1 << d);
  return { values, notes };
}

/** Erase: clear a cell's digit and its notes for good. */
export function eraseCell(s: SudokuState, i: number): SudokuState {
  const values = s.values.slice();
  const notes = s.notes.slice();
  values[i] = 0;
  notes[i] = 0;
  return { values, notes };
}

export function hint(p: SudokuPuzzle, history: SudokuState[]): HintResult<SudokuState, number[]> {
  const s = history[history.length - 1];
  const wrong = range(N * N).filter((i) => s.values[i] && s.values[i] !== p.solution[i]);
  if (wrong.length) {
    const values = s.values.slice();
    wrong.forEach((i) => (values[i] = 0));
    return {
      keep: history.length,
      state: { values, notes: s.notes },
      mark: wrong,
      message: `Cleared ${wrong.length} ${wrong.length === 1 ? "digit that doesn't" : "digits that don't"} fit the solution.`,
    };
  }
  const open = range(N * N).filter((i) => !s.values[i]);
  if (!open.length) return { keep: history.length, message: "The grid is full." };

  // A naked single: only one digit fits this cell.
  const naked = open.find((i) => candidates(s.values, i).length === 1);
  if (naked !== undefined) {
    return {
      keep: history.length,
      state: placeDigit(s, naked, p.solution[naked]),
      mark: [naked],
      message: `Only ${p.solution[naked]} fits here: every other digit is already in its row, column or box.`,
    };
  }
  // A hidden single: the digit has only one home in a row, column or box.
  for (const i of open) {
    const d = p.solution[i];
    const groups = [
      range(N).map((c) => Math.floor(i / N) * N + c),
      range(N).map((r) => r * N + (i % N)),
      range(N * N).filter((j) => boxOf(j) === boxOf(i)),
    ];
    for (const [k, group] of groups.entries()) {
      const homes = group.filter((j) => !s.values[j] && candidates(s.values, j).includes(d));
      if (homes.length === 1 && homes[0] === i) {
        const where = ["row", "column", "box"][k];
        return {
          keep: history.length,
          state: placeDigit(s, i, d),
          mark: [i],
          message: `This is the only cell in its ${where} where ${d} can go.`,
        };
      }
    }
  }
  const i = open[0];
  return { keep: history.length, state: placeDigit(s, i, p.solution[i]), mark: [i], message: `This cell is ${p.solution[i]}.` };
}
