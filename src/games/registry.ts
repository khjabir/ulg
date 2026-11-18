import type { GameDef } from "@/core/types";
import type { GameId } from "@/core/puzzle";
import { sumbroke } from "./sumbroke";
import { kings } from "./kings";
import { tangle } from "./tangle";
import { zap } from "./zap";
import { sixdoku } from "./sixdoku";
import { swatches } from "./swatches";

/** Order shown on the hub. Rename a game by changing its `name` in its index.tsx (and in meta.ts). */
export const GAMES: GameDef[] = [sumbroke, kings, tangle, zap, sixdoku, swatches];

export const GAMES_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameDef>;
