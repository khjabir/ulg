# Contributing to Refill

Thanks for wanting to help. Bug fixes, polish, new games and better docs are all
welcome.

## Getting set up

You need Node.js 22 or newer (`.nvmrc` has the version CI uses).

```bash
npm ci
npm run dev        # http://localhost:3000
```

Offline play, installing and the update prompt only work in a production build:
`npm run build && npm start`.

## Before you open a pull request

Run what CI runs. A pull request can only be merged when all of it passes:

```bash
npm test           # puzzle engines: unique solutions, hints, problem checks
npm run build      # the static site in out/
npm run typecheck
```

Then fill in the pull request template: what changed, how you tested it, and
screenshots for anything players will see.

## What makes a good change

- **One thing per pull request.** A new game and a fix to another game are two
  pull requests.
- **Every board has exactly one solution**, built from its seed alone, so a shared
  puzzle code always rebuilds the same board.
- **Warnings never give the game away.** A game's `check` reports a piece that
  breaks its own rule, or a true dead end where no move is left. Nothing that
  takes a deduction to see; that's what the hint is for.
- **Touch, mouse and keyboard all work**, on a small phone and a big screen, in
  light and dark mode, with reduced motion respected.
- **No backend, no new tracking, no new runtime dependencies.** Everything runs on
  the player's device and works offline. (The only analytics are Vercel's page-view
  counts, in builds made on Vercel.)
- **Original work.** Use your own names, rules text and artwork, not another
  company's.

## Adding a game

See [Add your own game](README.md#add-your-own-game). In short: an engine with a
seeded generator, rules, a hint and a check, a board component, a `GameDef`, a page,
and a case in `scripts/test-engines.ts`. The shell handles levels, the timer,
undo, hints, saving, stats, sounds, confetti and the home screen for you.

## Releasing

Maintainers bump `version` in `package.json` with each release. The app menu shows
it, and installed copies offer the update the next time they check.
