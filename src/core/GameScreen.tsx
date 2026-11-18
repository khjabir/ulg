"use client";

import { GAMES_BY_ID } from "@/games/registry";
import type { GameId } from "./puzzle";
import { GameShell } from "./GameShell";

export function GameScreen({ id }: { id: GameId }) {
  return <GameShell def={GAMES_BY_ID[id]} />;
}
