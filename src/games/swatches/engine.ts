import { mulberry32, shuffle, range, type Rng } from "../../core/rng";
import type { BasePuzzle, HintResult, Problem } from "../../core/puzzle";

/**
 * Swatches: split the grid into rectangles. Each swatch holds exactly one clue.
 * Like LinkedIn's Patches, every clue has a shape badge (square, wide, tall, or any)
 * and may also give the swatch's size in cells; shape-only clues leave the size for
 * you to work out. Swatches are always at least 2 cells, and every generated puzzle
 * has exactly one solution.
 */

export type Shape = "square" | "wide" | "tall";
export interface Rect {
  r0: number;
  c0: number;
  r1: number; // inclusive
  c1: number; // inclusive
}
export interface SwatchClue {
  cell: number;
  size: number | null;
  shape: Shape | null;
  color: number;
}
export interface SwatchesPuzzle extends BasePuzzle {
  game: "swatches";
  rows: number;
  cols: number;
  clues: SwatchClue[];
  solution: Rect[]; // aligned with clues
}
export type SwatchesState = Rect[];

export const PALETTE_SIZE = 8;

/**
 * How much each level leaves out, modelled on LinkedIn's Patches boards (5×5 to
 * 10×10, a handful of clues, some patches of 10 cells or more). Every clue carries a
 * shape badge; some badges are the "any" cross, some clues have no number, and on
 * harder boards a few "mystery" clues have neither. Each puzzle draws its own mix
 * from these ranges, so no two feel the same. Removals that would make the answer
 * ambiguous are put back, so these are upper limits.
 */
type Range = readonly [number, number];
const LEVELS: Record<string, { size: number; maxArea: number; dropNumbers: Range; anyShapes: Range; bare: Range }> = {
  // every clue numbered; some badges are the "any" cross
  easy: { size: 5, maxArea: 8, dropNumbers: [0, 0], anyShapes: [0.2, 0.5], bare: [0, 0] },
  // some clues without numbers, crosses, and now and then a mystery clue
  medium: { size: 6, maxArea: 10, dropNumbers: [0.25, 0.6], anyShapes: [0.2, 0.45], bare: [0, 1] },
  // mostly shape-only, a few crosses, and up to three mystery clues
  hard: { size: 8, maxArea: 12, dropNumbers: [0.5, 1], anyShapes: [0.15, 0.4], bare: [1, 3] },
};

/** The smallest swatch: LinkedIn's Patches never has single-cell patches. */
export const MIN_AREA = 2;

export const area = (r: Rect) => (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1);
export const shapeOf = (r: Rect): Shape => {
  const h = r.r1 - r.r0 + 1;
  const w = r.c1 - r.c0 + 1;
  return h === w ? "square" : w > h ? "wide" : "tall";
};
export const sameRect = (a: Rect, b: Rect) => a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1;
export const inRect = (r: Rect, row: number, col: number) => row >= r.r0 && row <= r.r1 && col >= r.c0 && col <= r.c1;
export function rectCells(r: Rect, cols: number): number[] {
  const out: number[] = [];
  for (let row = r.r0; row <= r.r1; row++) for (let col = r.c0; col <= r.c1; col++) out.push(row * cols + col);
  return out;
}

/** Random partition: fill row-major, each new swatch anchored at the first open cell. */
function partition(rows: number, cols: number, maxArea: number, rng: Rng): Rect[] | null {
  const covered = new Uint8Array(rows * cols);
  const rects: Rect[] = [];
  for (let i = 0; i < rows * cols; i++) {
    if (covered[i]) continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    const options: { h: number; w: number; weight: number }[] = [];
    for (let h = 1; r + h <= rows; h++) {
      for (let w = 1; c + w <= cols && h * w <= maxArea; w++) {
        let free = true;
        for (let rr = r; rr < r + h && free; rr++) for (let cc = c; cc < c + w && free; cc++) if (covered[rr * cols + cc]) free = false;
        if (!free) break;
        const a = h * w;
        // Filling row by row favours tall pieces, so lean on wide and square ones a
        // little to get a LinkedIn-like mix (squares like 2×2 and 3×3 are common there).
        if (a >= MIN_AREA) options.push({ h, w, weight: (a === 2 ? 0.6 : 1) * (h === w ? 2.6 : w > h ? 1.5 : 1) });
      }
    }
    if (!options.length) return null; // boxed into a single cell: try another layout
    let x = rng() * options.reduce((s, o) => s + o.weight, 0);
    let o = options[0];
    for (const opt of options) {
      x -= opt.weight;
      if (x <= 0) {
        o = opt;
        break;
      }
    }
    const rect = { r0: r, c0: c, r1: r + o.h - 1, c1: c + o.w - 1 };
    for (const cell of rectCells(rect, cols)) covered[cell] = 1;
    rects.push(rect);
  }
  return rects;
}

/** All rectangles a clue could take: contains it, no other clue, matches its size/shape. */
export function candidatesFor(p: { rows: number; cols: number; clues: SwatchClue[] }, k: number): Rect[] {
  const { rows, cols, clues } = p;
  const clue = clues[k];
  const cr = Math.floor(clue.cell / cols);
  const cc = clue.cell % cols;
  const others = clues.filter((_, j) => j !== k).map((o) => o.cell);
  const out: Rect[] = [];
  for (let r0 = 0; r0 <= cr; r0++)
    for (let r1 = cr; r1 < rows; r1++)
      for (let c0 = 0; c0 <= cc; c0++)
        for (let c1 = cc; c1 < cols; c1++) {
          const rect = { r0, c0, r1, c1 };
          if (clue.size !== null && area(rect) !== clue.size) continue;
          if (clue.shape !== null && shapeOf(rect) !== clue.shape) continue;
          if (others.some((o) => inRect(rect, Math.floor(o / cols), o % cols))) continue;
          out.push(rect);
        }
  return out;
}

/** Count tilings (stops at `limit`). The swatch covering the first open cell must start there. */
export function countTilings(p: { rows: number; cols: number; clues: SwatchClue[] }, limit = 2, fixed: Rect[] = []): number {
  const { rows, cols, clues } = p;
  const n = rows * cols;
  const byTopLeft: { k: number; rect: Rect; cells: number[] }[][] = range(n).map(() => []);
  clues.forEach((_, k) => {
    for (const rect of candidatesFor(p, k)) byTopLeft[rect.r0 * cols + rect.c0].push({ k, rect, cells: rectCells(rect, cols) });
  });
  const covered = new Uint8Array(n);
  const used = new Uint8Array(clues.length);
  for (const f of fixed) {
    const cells = rectCells(f, cols);
    for (const c of cells) {
      if (covered[c]) return 0;
      covered[c] = 1;
    }
    const k = clues.findIndex((cl) => inRect(f, Math.floor(cl.cell / cols), cl.cell % cols));
    if (k >= 0) used[k] = 1;
  }
  let count = 0;
  const rec = (from: number): boolean => {
    let u = from;
    while (u < n && covered[u]) u++;
    if (u === n) return ++count >= limit;
    for (const opt of byTopLeft[u]) {
      if (used[opt.k] || opt.cells.some((c) => covered[c])) continue;
      used[opt.k] = 1;
      for (const c of opt.cells) covered[c] = 1;
      if (rec(u + 1)) return true;
      for (const c of opt.cells) covered[c] = 0;
      used[opt.k] = 0;
    }
    return false;
  };
  rec(0);
  return count;
}

/** Neighbouring swatches get different colours (greedy colouring of the solution). */
function colourSwatches(rects: Rect[], rng: Rng): number[] {
  const touches = (a: Rect, b: Rect) =>
    !(a.r1 + 1 < b.r0 || b.r1 + 1 < a.r0 || a.c1 + 1 < b.c0 || b.c1 + 1 < a.c0) &&
    !((a.r1 + 1 === b.r0 || b.r1 + 1 === a.r0) && (a.c1 + 1 === b.c0 || b.c1 + 1 === a.c0)); // share an edge, not just a corner
  const colours: number[] = [];
  const used = new Array(PALETTE_SIZE).fill(0);
  rects.forEach((r, i) => {
    const taken = new Set<number>();
    rects.slice(0, i).forEach((o, j) => touches(o, r) && taken.add(colours[j]));
    const free = range(PALETTE_SIZE).filter((c) => !taken.has(c));
    const pool = free.length ? free : range(PALETTE_SIZE);
    const least = Math.min(...pool.map((c) => used[c]));
    const best = pool.filter((c) => used[c] === least);
    const c = best[Math.floor(rng() * best.length)];
    used[c]++;
    colours.push(c);
  });
  return colours;
}

export function generate(level: string, seed: number): SwatchesPuzzle {
  const cfg = LEVELS[level] ?? LEVELS.easy;
  const rng = mulberry32(seed);
  const rows = cfg.size;
  const cols = cfg.size;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const rects = partition(rows, cols, cfg.maxArea, rng);
    if (!rects) continue;
    const colours = colourSwatches(rects, rng);
    const clues: SwatchClue[] = rects.map((r, k) => {
      const cells = rectCells(r, cols);
      return { cell: cells[Math.floor(rng() * cells.length)], size: area(r), shape: shapeOf(r), color: colours[k] };
    });
    const p = { rows, cols, clues };
    if (countTilings(p) !== 1) continue;

    // Leave information out while the answer stays unique: numbers first (keeping
    // the shape), then some shapes become "any", then (Hard) a few clues lose both.
    const keepUnique = (k: number, field: "size" | "shape") => {
      const before = clues[k][field];
      (clues[k] as unknown as Record<string, unknown>)[field] = null;
      if (countTilings(p) === 1) return true;
      (clues[k] as unknown as Record<string, unknown>)[field] = before;
      return false;
    };
    const pick = ([lo, hi]: Range) => lo + (hi - lo) * rng();
    const n = clues.length;
    // 1. Shape-only clues: the number goes, the badge stays.
    const wantDropped = Math.round(n * pick(cfg.dropNumbers));
    let dropped = 0;
    for (const k of shuffle(rng, range(n))) {
      if (dropped >= wantDropped) break;
      if (keepUnique(k, "size")) dropped++;
    }
    // 2. "Any" crosses on numbered clues: the size stays, the shape is yours.
    const wantAny = Math.round(n * pick(cfg.anyShapes));
    let anyShapes = 0;
    for (const k of shuffle(rng, range(n))) {
      if (anyShapes >= wantAny) break;
      if (clues[k].size !== null && keepUnique(k, "shape")) anyShapes++;
    }
    // 3. Mystery clues: an empty cross, neither size nor shape.
    const wantBare = Math.round(pick(cfg.bare));
    let bare = 0;
    for (const k of shuffle(rng, range(n))) {
      if (bare >= wantBare) break;
      if (clues[k].size === null && clues[k].shape !== null && keepUnique(k, "shape")) bare++;
    }
    return { game: "swatches", level, seed, rows, cols, clues, solution: rects };
  }
  throw new Error("could not generate swatches puzzle");
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export const initialState = (): SwatchesState => [];

/** Index of the single clue inside `rect`, -1 for none, -2 for several. */
export function clueIn(p: SwatchesPuzzle, rect: Rect): number {
  let found = -1;
  for (let k = 0; k < p.clues.length; k++) {
    const cell = p.clues[k].cell;
    if (inRect(rect, Math.floor(cell / p.cols), cell % p.cols)) {
      if (found >= 0) return -2;
      found = k;
    }
  }
  return found;
}

/** Does this swatch satisfy its clue's size and shape? */
export function swatchFits(p: SwatchesPuzzle, rect: Rect): boolean {
  const k = clueIn(p, rect);
  if (k < 0) return false;
  const clue = p.clues[k];
  return (clue.size === null || clue.size === area(rect)) && (clue.shape === null || clue.shape === shapeOf(rect));
}

export const overlapping = (a: Rect, b: Rect) => !(a.r1 < b.r0 || b.r1 < a.r0 || a.c1 < b.c0 || b.c1 < a.c0);
const overlaps = overlapping;

/** Add a swatch, replacing any it overlaps (the board never draws overlaps; hints may replace). */
export function addSwatch(s: SwatchesState, rect: Rect): SwatchesState {
  return s.filter((r) => !overlaps(r, rect)).concat([rect]);
}

export const SHAPE_WORD = { square: "a square", wide: "a wide (wider than tall)", tall: "a tall (taller than wide)" } as const;

/** Why a drawn swatch breaks the rules, or null when it fits its clue. */
export function mismatch(p: SwatchesPuzzle, rect: Rect): string | null {
  const k = clueIn(p, rect);
  if (k === -1) return "This swatch has no clue in it. Every swatch needs exactly one.";
  if (k === -2) return "This swatch holds more than one clue. Every swatch needs exactly one.";
  const clue = p.clues[k];
  const n = area(rect);
  if (clue.size !== null && clue.size !== n) return `This clue needs ${clue.size} cells, and the swatch has ${n}. Drag its edge to resize it.`;
  if (clue.shape !== null && clue.shape !== shapeOf(rect)) return `This clue needs ${SHAPE_WORD[clue.shape]} swatch. Drag its edge to reshape it.`;
  return null;
}

/**
 * A swatch that breaks its own clue (wrong size or shape), else the end of the road:
 * every clue has a swatch but cells are still empty, or no clue left can fit
 * anywhere. Never looks ahead: a swatch that fits its clue is never flagged just
 * because it will crowd another one later.
 */
export function check(p: SwatchesPuzzle, s: SwatchesState): Problem | null {
  const { rows, cols, clues } = p;
  for (const r of s) {
    const why = mismatch(p, r);
    if (why) return { kind: "rule", message: why, cells: rectCells(r, cols) };
  }
  const covered = new Uint8Array(rows * cols);
  for (const r of s) for (const c of rectCells(r, cols)) covered[c] = 1;
  const empty: number[] = [];
  for (let i = 0; i < rows * cols; i++) if (!covered[i]) empty.push(i);
  if (!empty.length) return null;
  const waiting = clues.map((_, k) => k).filter((k) => !covered[clues[k].cell]);
  if (!waiting.length) {
    const one = empty.length === 1;
    return {
      kind: "stuck",
      message: `Every clue has a swatch, but ${one ? "1 cell is" : `${empty.length} cells are`} still empty. Resize a swatch to cover ${one ? "it" : "them"}.`,
      cells: empty,
    };
  }
  const fits = (k: number) => candidatesFor(p, k).some((r) => rectCells(r, cols).every((c) => !covered[c]));
  if (!waiting.some(fits)) {
    return {
      kind: "stuck",
      message:
        waiting.length === 1
          ? "There's no room left for the last clue's swatch. Move or resize a swatch to make space."
          : "None of the clues left has room for its swatch. Move or resize a swatch to make space.",
      cells: waiting.map((k) => clues[k].cell),
    };
  }
  return null;
}

export function isSolved(p: SwatchesPuzzle, s: SwatchesState): boolean {
  if (s.length !== p.clues.length) return false;
  const covered = new Uint8Array(p.rows * p.cols);
  for (const r of s) {
    if (!swatchFits(p, r)) return false;
    for (const c of rectCells(r, p.cols)) {
      if (covered[c]) return false;
      covered[c] = 1;
    }
  }
  return covered.every(Boolean);
}

export function hint(p: SwatchesPuzzle, history: SwatchesState[]): HintResult<SwatchesState, number[]> {
  const s = history[history.length - 1];
  const wrong = s.filter((r) => !p.solution.some((sol) => sameRect(sol, r)));
  if (wrong.length) {
    return {
      keep: history.length,
      state: s.filter((r) => !wrong.includes(r)),
      mark: wrong.flatMap((r) => rectCells(r, p.cols)),
      message: `Removed ${wrong.length} ${wrong.length === 1 ? "swatch that doesn't" : "swatches that don't"} fit the solution.`,
    };
  }
  // Add the missing swatch whose clue has the fewest places left to go.
  let best = -1;
  let fewest = Infinity;
  p.solution.forEach((sol, k) => {
    if (s.some((r) => sameRect(r, sol))) return;
    const open = candidatesFor(p, k).filter((r) => !s.some((o) => overlaps(o, r))).length;
    if (open < fewest) {
      fewest = open;
      best = k;
    }
  });
  if (best < 0) return { keep: history.length, message: "Every swatch is already placed." };
  const rect = p.solution[best];
  return {
    keep: history.length,
    state: addSwatch(s, rect),
    mark: rectCells(rect, p.cols),
    message: `Placed the swatch for this clue: it has ${fewest === 1 ? "only one place it can go" : "the fewest options left"}.`,
  };
}
