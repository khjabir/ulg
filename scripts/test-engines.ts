// Engine checks for every game. Run with: npm test
import { generators } from "../src/games/engines";
import * as S from "../src/games/sumbroke/engine";
import * as Q from "../src/games/kings/engine";
import * as T from "../src/games/tangle/engine";
import * as Z from "../src/games/zap/engine";
import * as D from "../src/games/sixdoku/engine";
import * as P from "../src/games/swatches/engine";
import type { GameId, Problem } from "../src/core/puzzle";
import { mulberry32 } from "../src/core/rng";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error("  FAIL", msg);
};

const COUNT: Record<string, number> = { easy: 30, medium: 30, hard: 12 };

function check(game: GameId, level: string, seed: number) {
  const t0 = performance.now();
  const p = generators[game](level, seed);
  const ms = performance.now() - t0;
  const again = generators[game](level, seed);
  if (JSON.stringify(p) !== JSON.stringify(again)) fail(`${game} ${level} ${seed}: not deterministic`);

  switch (game) {
    case "sumbroke": {
      const sp = p as S.SumbrokePuzzle;
      let g = sp.grid;
      for (const m of sp.solution) g = S.applyMove(g, m);
      if (!S.isSolved(g)) fail(`sumbroke ${seed}: solution invalid`);
      const h = S.findHintStates(sp, [sp.grid]);
      if (!S.canMerge(sp.grid, h.move.from, h.move.to, sp.cols)) fail(`sumbroke ${seed}: hint not legal`);
      break;
    }
    case "kings": {
      const qp = p as Q.KingsPuzzle;
      const sol = Q.initialState(qp);
      qp.solution.forEach((c, r) => (sol[r * qp.n + c] = Q.KING));
      if (!Q.isSolved(qp, sol)) fail(`kings ${seed}: solution invalid`);
      if (Q.countSolutions(qp.n, qp.regions) !== 1) fail(`kings ${seed}: not unique`);
      // hints alone solve it
      const hist = [Q.initialState(qp)];
      for (let k = 0; k < qp.n; k++) hist.push(Q.hint(qp, hist).state!);
      if (!Q.isSolved(qp, hist[hist.length - 1])) fail(`kings ${seed}: hints don't solve`);
      break;
    }
    case "tangle": {
      const tp = p as T.TanglePuzzle;
      if (!T.isSolved(tp, tp.solution)) fail(`tangle ${seed}: solution invalid`);
      if (T.countSolutions(tp.givens, tp.signs) !== 1) fail(`tangle ${seed}: not unique`);
      const wrong = T.initialState(tp);
      const open = wrong.findIndex((v) => !v);
      wrong[open] = tp.solution[open] === T.SUN ? T.MOON : T.SUN;
      const h = T.hint(tp, [wrong]);
      if (h.state![open] !== 0) fail(`tangle ${seed}: hint didn't clear a wrong cell`);
      break;
    }
    case "zap": {
      const zp = p as Z.ZapPuzzle;
      if (!Z.isSolved(zp, zp.solution)) fail(`zap ${seed}: solution invalid`);
      const walls = new Set(zp.walls.map(([a, b]) => Z.wallKey(a, b)));
      const r = Z.solvePaths(zp.rows, zp.cols, zp.numbers, walls, 2, 3_000_000);
      if (r.timeout || r.paths.length !== 1) fail(`zap ${seed}: not unique (${r.paths.length}, timeout ${r.timeout})`);
      // the shipped solution only ever takes legal steps
      let path = Z.initialState(zp);
      for (const c of zp.solution.slice(1)) {
        if (!Z.canStep(zp, path, c, walls)) {
          fail(`zap ${seed}: solution step refused`);
          break;
        }
        path = path.concat([c]);
      }
      let hist = [Z.initialState(zp)];
      for (let k = 0; k < zp.rows * zp.cols && !Z.isSolved(zp, hist[hist.length - 1]); k++) hist = hist.concat([Z.hint(zp, hist).state!]);
      if (!Z.isSolved(zp, hist[hist.length - 1])) fail(`zap ${seed}: hints don't solve`);
      break;
    }
    case "sixdoku": {
      const dp = p as D.SudokuPuzzle;
      if (!D.isSolved(dp, { values: dp.solution, notes: [] })) fail(`sixdoku ${seed}: solution invalid`);
      if (D.countSolutions(dp.givens) !== 1) fail(`sixdoku ${seed}: not unique`);
      let hist = [D.initialState(dp)];
      for (let k = 0; k < 36 && !D.isSolved(dp, hist[hist.length - 1]); k++) hist = hist.concat([D.hint(dp, hist).state!]);
      if (!D.isSolved(dp, hist[hist.length - 1])) fail(`sixdoku ${seed}: hints don't solve`);
      break;
    }
    case "swatches": {
      const pp = p as P.SwatchesPuzzle;
      if (!P.isSolved(pp, pp.solution)) fail(`swatches ${seed}: solution invalid`);
      if (P.countTilings(pp) !== 1) fail(`swatches ${seed}: not unique`);
      let hist: P.SwatchesState[] = [P.initialState()];
      for (let k = 0; k < pp.clues.length; k++) hist = hist.concat([P.hint(pp, hist).state!]);
      if (!P.isSolved(pp, hist[hist.length - 1])) fail(`swatches ${seed}: hints don't solve`);
      break;
    }
  }
  return ms;
}

/*
 * Problem checks must never cry wolf: every board on the way to the solution passes
 * silently, and any board a check complains about really can't be finished.
 * Random play also proves the obvious dead ends get caught.
 */
const flagStats: Record<string, { flagged: number; boards: number }> = {};
function tally(game: string, pr: Problem | null) {
  const t = (flagStats[game] ??= { flagged: 0, boards: 0 });
  t.boards++;
  if (pr) t.flagged++;
}
function sample<T>(rng: () => number, xs: T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

function checkProblems(game: GameId, p: unknown, seed: number) {
  const rng = mulberry32(seed ^ 0x5eed);
  const quiet = (pr: Problem | null, what: string) => {
    if (pr) fail(`${game} ${seed}: false alarm on ${what}: "${pr.message}"`);
  };
  switch (game) {
    case "sumbroke": {
      const sp = p as S.SumbrokePuzzle;
      let g = sp.grid;
      quiet(S.check(sp, g), "the start");
      for (const m of sp.solution) {
        g = S.applyMove(g, m);
        quiet(S.check(sp, g), "a solution step");
      }
      for (let run = 0; run < 6; run++) {
        g = sp.grid;
        for (;;) {
          const pr = S.check(sp, g);
          tally(game, pr);
          if (pr) {
            if (S.solve(g, sp.rows, sp.cols).status === "solved") fail(`sumbroke ${seed}: "${pr.message}" but it can be solved`);
            break;
          }
          const moves = S.legalMoves(g, sp.rows, sp.cols);
          if (!moves.length) {
            if (!S.isSolved(g)) fail(`sumbroke ${seed}: no moves left and nothing said`);
            break;
          }
          g = S.applyMove(g, sample(rng, moves));
        }
      }
      break;
    }
    case "kings": {
      const qp = p as Q.KingsPuzzle;
      const answer = new Set(qp.solution.map((c, r) => r * qp.n + c));
      for (let run = 0; run < 12; run++) {
        const good = Q.initialState(qp);
        const bad = Q.initialState(qp);
        for (let i = 0; i < good.length; i++) {
          const x = rng();
          if (answer.has(i)) good[i] = x < 0.4 ? Q.KING : Q.EMPTY;
          else good[i] = x < 0.5 ? Q.MARK : Q.EMPTY;
          bad[i] = x < 0.08 ? Q.KING : x < 0.55 ? Q.MARK : Q.EMPTY;
        }
        quiet(Q.check(qp, good), "a board that agrees with the solution");
        const pr = Q.check(qp, bad);
        tally(game, pr);
        const fine = bad.every((v, i) => (v === Q.KING ? answer.has(i) : v === Q.MARK ? !answer.has(i) : true));
        if (pr && fine) fail(`kings ${seed}: "${pr.message}" on a board that can be finished`);
      }
      break;
    }
    case "tangle": {
      const tp = p as T.TanglePuzzle;
      for (let run = 0; run < 12; run++) {
        const good = tp.givens.slice();
        const bad = tp.givens.slice();
        for (let i = 0; i < good.length; i++) {
          if (good[i]) continue;
          if (rng() < 0.6) good[i] = tp.solution[i];
          if (rng() < 0.6) bad[i] = rng() < 0.5 ? T.SUN : T.MOON;
        }
        quiet(T.check(tp, good), "a board that agrees with the solution");
        const pr = T.check(tp, bad);
        tally(game, pr);
        if (pr && bad.every((v, i) => !v || v === tp.solution[i])) fail(`tangle ${seed}: "${pr.message}" on a board that can be finished`);
      }
      break;
    }
    case "zap": {
      const zp = p as Z.ZapPuzzle;
      const walls = new Set(zp.walls.map(([a, b]) => Z.wallKey(a, b)));
      for (let k = 1; k <= zp.solution.length; k++) quiet(Z.check(zp, zp.solution.slice(0, k)), `solution step ${k}`);
      const isPrefix = (path: number[]) => path.every((c, i) => zp.solution[i] === c);
      for (let run = 0; run < 8; run++) {
        let path = Z.initialState(zp);
        for (;;) {
          const pr = Z.check(zp, path);
          tally(game, pr);
          if (pr) {
            if (isPrefix(path)) fail(`zap ${seed}: "${pr.message}" on the way to the solution`);
            break;
          }
          const head = path[path.length - 1];
          const steps = [head - zp.cols, head + zp.cols, head - 1, head + 1].filter(
            (q) => q >= 0 && q < zp.rows * zp.cols && Z.canStep(zp, path, q, walls),
          );
          if (!steps.length) {
            if (!Z.isSolved(zp, path)) fail(`zap ${seed}: stuck at a dead end and nothing said`);
            break;
          }
          path = path.concat([sample(rng, steps)]);
        }
      }
      break;
    }
    case "sixdoku": {
      const dp = p as D.SudokuPuzzle;
      for (let run = 0; run < 12; run++) {
        const good = dp.givens.slice();
        const bad = dp.givens.slice();
        for (let i = 0; i < good.length; i++) {
          if (good[i]) continue;
          if (rng() < 0.6) good[i] = dp.solution[i];
          if (rng() < 0.45) bad[i] = 1 + Math.floor(rng() * 6);
        }
        quiet(D.check(dp, { values: good, notes: [] }), "a board that agrees with the solution");
        const pr = D.check(dp, { values: bad, notes: [] });
        tally(game, pr);
        if (pr && bad.every((v, i) => !v || v === dp.solution[i])) fail(`sixdoku ${seed}: "${pr.message}" on a board that can be finished`);
      }
      break;
    }
    case "swatches": {
      const pp = p as P.SwatchesPuzzle;
      const inSolution = (r: P.Rect) => pp.solution.some((x) => P.sameRect(x, r));
      for (let run = 0; run < 12; run++) {
        quiet(P.check(pp, pp.solution.filter(() => rng() < 0.5)), "a board that agrees with the solution");
        let s: P.SwatchesState = [];
        for (let k = 0; k < pp.clues.length; k++) {
          const options = P.candidatesFor(pp, Math.floor(rng() * pp.clues.length));
          if (options.length) s = P.addSwatch(s, sample(rng, options));
          const pr = P.check(pp, s);
          tally(game, pr);
          if (pr) {
            if (s.every(inSolution)) fail(`swatches ${seed}: "${pr.message}" on a board that can be finished`);
            break;
          }
        }
      }
      break;
    }
  }
}

const games: GameId[] = ["sumbroke", "kings", "tangle", "zap", "sixdoku", "swatches"];
for (const game of games) {
  for (const level of ["easy", "medium", "hard"]) {
    const times: number[] = [];
    for (let i = 1; i <= COUNT[level]; i++) {
      const seed = (i * 2654435761) >>> 0;
      times.push(check(game, level, seed));
      checkProblems(game, generators[game](level, seed), seed);
    }
    times.sort((a, b) => a - b);
    console.log(
      `${game.padEnd(12)} ${level.padEnd(6)} n=${String(times.length).padStart(2)}  median ${times[Math.floor(times.length / 2)].toFixed(0).padStart(4)}ms  max ${times[times.length - 1].toFixed(0).padStart(5)}ms`,
    );
  }
}
console.log("\nProblem checks (random play):");
for (const [game, t] of Object.entries(flagStats)) {
  console.log(`${game.padEnd(12)} flagged ${String(t.flagged).padStart(4)} of ${String(t.boards).padStart(5)} boards, no false alarms`);
}
if (failures) {
  console.error(`\n${failures} failures`);
  process.exit(1);
}
console.log("\nAll engine checks passed.");
