"use client";

import type { BasePuzzle, GameId } from "./puzzle";

/**
 * Generation and heavy hints run in a Web Worker (public/puzzle-worker.js, built by
 * scripts/build-worker.mjs) so boards never freeze. Falls back to the main thread.
 */
let worker: Worker | null = null;
let broken = false;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

function getWorker(): Worker | null {
  if (broken || typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    const url =
      process.env.NEXT_PUBLIC_RELATIVE_ASSETS === "1"
        ? new URL("puzzle-worker.js", document.baseURI).href
        : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/puzzle-worker.js`;
    worker = new Worker(url);
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      broken = true;
      worker?.terminate();
      worker = null;
      for (const [, p] of pending) p.reject(new Error("worker failed"));
      pending.clear();
    };
    return worker;
  } catch {
    broken = true;
    return null;
  }
}

function call<T>(msg: Record<string, unknown>, fallback: () => Promise<T>): Promise<T> {
  const w = getWorker();
  if (!w) return fallback();
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ ...msg, id });
  }).catch(() => fallback());
}

const cache = new Map<string, Promise<BasePuzzle>>();

export function requestPuzzle<P extends BasePuzzle>(game: GameId, level: string, seed: number): Promise<P> {
  const key = `${game}:${level}:${seed}`;
  let p = cache.get(key);
  if (!p) {
    p = call({ type: "generate", game, level, seed }, async () => {
      const { generators } = await import("@/games/engines");
      return generators[game](level, seed);
    });
    cache.set(key, p);
    if (cache.size > 24) cache.delete(cache.keys().next().value as string);
  }
  return p as Promise<P>;
}

export function requestWorkerHint<T>(game: "sumbroke", puzzle: unknown, states: unknown[]): Promise<T> {
  return call({ type: "hint", game, puzzle, states }, async () => {
    const { workerHints } = await import("@/games/engines");
    return workerHints[game](puzzle as never, states as never) as T;
  });
}
