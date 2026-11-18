"use client";

import type { GameId } from "./puzzle";
import { LEGACY_IDS } from "@/games/meta";

const PREFIX = "ulg:v1:";

/** Carry saved games and stats over from the games' earlier ids (one time). */
function migrateLegacy() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i) ?? "");
    for (const key of keys) {
      if (!key.startsWith(PREFIX)) continue;
      const rest = key.slice(PREFIX.length);
      const old = Object.keys(LEGACY_IDS).find((id) => rest.startsWith(`${id}:`));
      if (!old) continue;
      const target = PREFIX + LEGACY_IDS[old] + rest.slice(old.length);
      let value = localStorage.getItem(key);
      if (value && rest.includes(":game:")) value = value.split(`"game":"${old}"`).join(`"game":"${LEGACY_IDS[old]}"`);
      if (value !== null && localStorage.getItem(target) === null) localStorage.setItem(target, value);
      localStorage.removeItem(key);
    }
  } catch {
    /* storage blocked */
  }
}
if (typeof window !== "undefined") migrateLegacy();

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the game still works, it just won't resume */
  }
}

export interface SavedGame<P = unknown, S = unknown> {
  puzzle: P;
  history: S[];
  elapsedMs: number;
  hintsUsed: number;
  status: "playing" | "won";
}

export interface LevelStats {
  solved: number;
  bestMs: number | null;
  totalMs: number;
  hintFree: number;
  streak: number; // consecutive solves without a hint
  bestStreak: number;
}
export type GameStats = Record<string, LevelStats>;

const emptyStats = (): LevelStats => ({ solved: 0, bestMs: null, totalMs: 0, hintFree: 0, streak: 0, bestStreak: 0 });

const MAX_HISTORY = 300;

export const loadGame = <P, S>(game: GameId, level: string) => read<SavedGame<P, S>>(`${game}:game:${level}`);
export function saveGame<P, S>(game: GameId, level: string, g: SavedGame<P, S>) {
  const h = g.history;
  const history = h.length > MAX_HISTORY ? [h[0], ...h.slice(h.length - MAX_HISTORY + 1)] : h;
  write(`${game}:game:${level}`, { ...g, history });
}

export const loadLevel = (game: GameId) => read<string>(`${game}:level`);
export const saveLevel = (game: GameId, level: string) => write(`${game}:level`, level);

export function loadStats(game: GameId, levels: string[]): GameStats {
  const s = read<GameStats>(`${game}:stats`) ?? {};
  return Object.fromEntries(levels.map((l) => [l, { ...emptyStats(), ...s[l] }]));
}

export function recordWin(game: GameId, levels: string[], level: string, ms: number, hints: number) {
  const stats = loadStats(game, levels);
  const s = stats[level] ?? emptyStats();
  const newBest = s.bestMs === null || ms < s.bestMs;
  s.solved += 1;
  s.totalMs += ms;
  if (newBest) s.bestMs = ms;
  if (hints === 0) {
    s.hintFree += 1;
    s.streak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else {
    s.streak = 0;
  }
  stats[level] = s;
  write(`${game}:stats`, stats);
  return { stats, newBest };
}

export const hasSeenHelp = (game: GameId) => read<boolean>(`${game}:seenHelp`) === true;
export const markHelpSeen = (game: GameId) => write(`${game}:seenHelp`, true);

/** Summary for the hub: total solves and whether a game is underway. */
export function summary(game: GameId, levels: string[]) {
  const stats = loadStats(game, levels);
  const solved = Object.values(stats).reduce((n, s) => n + s.solved, 0);
  const inProgress = levels.some((l) => {
    const g = loadGame(game, l);
    return !!g && g.status === "playing" && g.history.length > 1;
  });
  return { solved, inProgress };
}
