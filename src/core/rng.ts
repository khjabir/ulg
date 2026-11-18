/** Seeded randomness shared by every puzzle generator (worker-safe: no DOM, no React). */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;

export const seedToCode = (seed: number) => (seed >>> 0).toString(36).toUpperCase().padStart(7, "0");

export const codeToSeed = (code: string): number | null => {
  if (!/^[0-9a-z]{1,7}$/i.test(code)) return null;
  const n = parseInt(code.toLowerCase(), 36);
  return Number.isFinite(n) && n > 0 && n <= 0xffffffff ? n >>> 0 : null;
};

export const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** 4-neighbours of cell i on a rows×cols grid. */
export function neighbours4(i: number, rows: number, cols: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  if (r > 0) out.push(i - cols);
  if (r < rows - 1) out.push(i + cols);
  if (c > 0) out.push(i - 1);
  if (c < cols - 1) out.push(i + 1);
  return out;
}
