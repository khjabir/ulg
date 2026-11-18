// Engine checks for every game. Run with: npm test
import { generators } from "../src/games/engines";
import * as S from "../src/games/sumbroke/engine";
import * as Q from "../src/games/kings/engine";
import * as T from "../src/games/tangle/engine";
import * as Z from "../src/games/zap/engine";
import * as D from "../src/games/sixdoku/engine";
import * as P from "../src/games/swatches/engine";
import type { GameId } from "../src/core/puzzle";

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

const games: GameId[] = ["sumbroke", "kings", "tangle", "zap", "sixdoku", "swatches"];
for (const game of games) {
  for (const level of ["easy", "medium", "hard"]) {
    const times: number[] = [];
    for (let i = 1; i <= COUNT[level]; i++) times.push(check(game, level, (i * 2654435761) >>> 0));
    times.sort((a, b) => a - b);
    console.log(
      `${game.padEnd(12)} ${level.padEnd(6)} n=${String(times.length).padStart(2)}  median ${times[Math.floor(times.length / 2)].toFixed(0).padStart(4)}ms  max ${times[times.length - 1].toFixed(0).padStart(5)}ms`,
    );
  }
}
if (failures) {
  console.error(`\n${failures} failures`);
  process.exit(1);
}
console.log("\nAll engine checks passed.");
