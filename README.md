# ulg: Unlimited Logic Games

Six logic puzzles with a fresh board whenever you want one. It's a Next.js 16 app that
installs on your phone like an app (a PWA) and works offline.

| Game | Rules in one line | Sizes |
| --- | --- | --- |
| **Sumbroke** | Drag equal neighbours together to merge them into their sum, until one number is left. Gold `+3` / `×2` wildcards merge with anything. | 3×3, 4×4, 5×5 |
| **Kings** | One king in each row, column and coloured region. Kings never touch, not even diagonally (like kings in chess). | 7×7, 8×8, 9×9 |
| **Tangle** | Fill with suns and moons: three of each per row and column, never three in a row. `=` cells match, `×` cells differ. | 6×6 |
| **Zap** | Draw one path from 1 through the numbers in order. It must fill every cell and never cross a wall. | 6×6, 7×7, 8×8 |
| **Sixdoku** | Fill in the digits 1–6 once per row, column and 2×3 box. | 6×6 |
| **Swatches** | Cut the grid into rectangles with exactly one clue in each. A clue can give the swatch's size and its shape (square, wide or tall). | 5×5, 6×6, 7×7 |

Each game has three levels, a timer, undo, reset, hints, per-level stats and a hint-free
streak. Your progress is saved on the device. "Challenge a friend" makes a link that
rebuilds the exact same board.

Sound effects are synthesized in the browser with Web Audio, so there are no audio files.
They include wooden clacks for placing pieces, marimba notes for merges and checkpoints,
a soft bonk for mistakes and a fanfare for wins. Phones that support it also vibrate
briefly. The speaker button on the hub or in any game mutes everything, and the setting is
remembered. A solved board sets off a wave across the cells, a glow, confetti and the
results card. Motion is reduced automatically when the device asks for reduced motion.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build (a static site in `out/`):

```bash
npm run build
npm start          # serves out/ locally
```

The service worker (offline mode) only registers in production builds. To try offline
play, use `npm run build && npm start`.

## Put it on your phone

Deploy `out/` to any static host:

- **Vercel:** import the repo. The default settings work.
- **Netlify or Cloudflare Pages:** set the build command to `npm run build` and the publish directory to `out`.
- **GitHub Pages (project site):** run `BASE_PATH=/your-repo npm run build`, then publish `out/`.

Open the deployed site on your phone. On Android (Chrome), choose "Install app". On
iPhone (Safari), tap Share, then "Add to Home Screen". After the first visit it plays
offline.

## How the puzzles are made

Generators are seeded, so every puzzle has a code (shown as "Puzzle ABC1234") and the
same code always rebuilds the same board. Each generator checks that its puzzle has
exactly one solution:

- **Sumbroke** starts from a single number and "un-merges" it until the board is full,
  which guarantees a solution. A solver then makes sure the opening contains real traps.
- **Kings** places kings that don't touch, grows a coloured region around each one,
  and repairs the regions until a solver finds only one answer.
- **Tangle** and **Sixdoku** fill a valid grid, then remove givens one at a time
  while the answer stays unique.
- **Zap** builds a random path through every cell. It then adds checkpoints and walls
  that knock out every rival path, and trims any checkpoint it doesn't need.
- **Swatches** splits the grid into random rectangles. Harder levels then strip clue
  information while the answer stays unique.

Generation runs in a Web Worker (`public/puzzle-worker.js`, built from
`src/worker/puzzle.worker.ts`), so the board never freezes.

Hints never leave you stuck. Sumbroke and Zap take you back to your last good position and
show the next step. The other games clear anything that doesn't fit, then place one
piece, preferring a cell the rules already force.

## Project layout

```
src/app/                 layout, hub page, one folder per game route, not-found page, manifest
src/core/                game shell (timer, undo, hints, stats, saves), hub, worker client,
                         sound.ts (sound kit), Confetti.tsx, geometry.ts (pointer → cell)
src/games/<game>/        engine.ts (generator, rules, hints), Board.tsx, index.tsx (rules text)
src/games/registry.ts    the list of games shown on the hub
src/styles/              shared styles plus one stylesheet per game
public/sw.js             offline service worker (precache list filled in at build)
scripts/                 worker bundling, service-worker precache, icons, engine tests
```

`npm test` generates puzzles for every game and level. It checks that each one is
deterministic, has a valid and unique solution, and can be solved using hints alone.

## Adding or renaming a game

Every game is a `GameDef`: rules, board component, generator and hint. Copy a game
folder, register it in `src/games/registry.ts`, `src/games/engines.ts` and
`src/games/meta.ts`, add its stylesheet to `src/app/layout.tsx`, and add a route folder
`src/app/<id>/page.tsx` (copy one of the existing four-line pages). Old addresses listed in
`LEGACY_IDS` in `meta.ts` forward to the new ones automatically. To rename a game,
change `name` in its `index.tsx` and in `meta.ts`. The URL slug is the game's `id`.

## Drawing on the board

Boards that you draw on (Zap, Swatches, and X-marking in Kings) work out the
cell under your finger from the grid's position, not from the element underneath it.
If a fast drag overshoots the edge of the board, it still lands on the edge row or
column. The release point also counts, so a quick flick doesn't stop one cell short.

---

Fan-made puzzles. Not affiliated with or endorsed by LinkedIn, whose daily games inspired
these mechanics.
