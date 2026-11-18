<!--
Thanks for helping! Please read CONTRIBUTING.md first. Keep pull requests small and
about one thing; a new game and a fix to another game are two pull requests.
-->

## What does this change?

<!-- One or two sentences. If it fixes an issue, say "Fixes #123". -->

## Type of change

- [ ] Bug fix
- [ ] New game
- [ ] Improvement to an existing game
- [ ] App shell, install/offline, docs or tooling

## How did you test it?

<!-- Which games and levels you played, and on which devices and browsers. -->

- [ ] Played it on a phone-sized screen with touch
- [ ] Played it with a mouse, and with the keyboard
- [ ] Checked light and dark mode

## Screenshots or a short recording

<!-- Required for anything players will see. Before and after is ideal. -->

## Checklist

- [ ] `npm test`, `npm run build` and `npm run typecheck` pass locally (CI runs the same)
- [ ] Puzzle generators still give every board exactly one solution, from its seed alone
- [ ] Problem checks (`check`) only report a broken rule or a true dead end, never a deduction
- [ ] Hints work, and solving the board with hints alone still works
- [ ] Saved games from the current version still load (or there's a migration)
- [ ] No new runtime dependencies, no network calls, no tracking
- [ ] README updated if players or contributors would notice the change

<!-- New game? Also tick these. -->

- [ ] Registered in `GameId` (`src/core/puzzle.ts`), `src/games/engines.ts`, `src/games/registry.ts` and `src/games/meta.ts`
- [ ] Has a page at `src/app/<id>/page.tsx` and its stylesheet is imported in `src/app/layout.tsx`
- [ ] Has a case in `scripts/test-engines.ts`
- [ ] Original name, rules text and artwork (no other company's names, logos or assets)
