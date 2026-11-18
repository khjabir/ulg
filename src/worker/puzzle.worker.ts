/// <reference lib="webworker" />
import { generators, workerHints } from "../games/engines";
import type { GameId } from "../core/puzzle";

type Request =
  | { id: number; type: "generate"; game: GameId; level: string; seed: number }
  | { id: number; type: "hint"; game: "sumbroke"; puzzle: never; states: never };

self.onmessage = (e: MessageEvent<Request>) => {
  const msg = e.data;
  try {
    const result =
      msg.type === "generate"
        ? generators[msg.game](msg.level, msg.seed)
        : workerHints[msg.game](msg.puzzle, msg.states);
    self.postMessage({ id: msg.id, ok: true, result });
  } catch (err) {
    self.postMessage({ id: msg.id, ok: false, error: String(err) });
  }
};
