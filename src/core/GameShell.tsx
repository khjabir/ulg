"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GameDef, MoveFx } from "./types";
import type { BasePuzzle } from "./puzzle";
import { codeToSeed, randomSeed, seedToCode } from "./rng";
import { requestPuzzle } from "./workerClient";
import {
  hasSeenHelp,
  loadGame,
  loadLevel,
  loadStats,
  markHelpSeen,
  recordWin,
  saveGame,
  saveLevel,
  type GameStats,
} from "./storage";
import { formatTime } from "./format";
import { Dialog } from "./Dialog";
import { Confetti } from "./Confetti";
import { onSoundChange, setSoundOn, sfx, soundOn } from "./sound";
import { afterSplash } from "./app";
import {
  BackIcon,
  HelpIcon,
  HintIcon,
  ResetIcon,
  ShareIcon,
  ShuffleIcon,
  SoundOffIcon,
  SoundOnIcon,
  StatsIcon,
  UndoIcon,
} from "./Icons";

type Status = { text: string; alert?: boolean } | null;

/**
 * The hint meter: after a fresh board and after each hint, the next one takes 10 s
 * of play to charge, every time. Only game time counts, so a paused or hidden game
 * doesn't charge. A game can set its own wait with GameDef.hintWait.
 */
const HINT_WAIT_MS = 10_000;
const defaultHintWait = () => HINT_WAIT_MS;
type DialogKind = "help" | "stats" | "win" | null;

interface Play<P, S> {
  puzzle: P;
  history: S[];
  hintsUsed: number;
  status: "playing" | "won";
  hintAt: { from: number; ready: number };
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** A stopwatch that only advances while `running` is true. */
function useStopwatch(running: boolean) {
  const acc = useRef(0);
  const start = useRef<number | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    start.current = performance.now();
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => {
      window.clearInterval(id);
      if (start.current !== null) acc.current += performance.now() - start.current;
      start.current = null;
    };
  }, [running]);
  const get = useCallback(() => acc.current + (start.current !== null ? performance.now() - start.current : 0), []);
  const reset = useCallback((ms: number) => {
    acc.current = ms;
    if (start.current !== null) start.current = performance.now();
    setTick((t) => t + 1);
  }, []);
  return useMemo(() => ({ get, reset }), [get, reset]);
}

export function GameShell<P extends BasePuzzle, S, M>({ def }: { def: GameDef<P, S, M> }) {
  const levelIds = useMemo(() => def.levels.map((l) => l.id), [def]);
  const hintWait = useCallback((used: number) => def.hintWait?.(used) ?? defaultHintWait(), [def]);
  const [level, setLevel] = useState(def.levels[0].id);
  const [play, setPlay] = useState<Play<P, S> | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>(null);
  const [mark, setMark] = useState<M | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [win, setWin] = useState<{ ms: number; hints: number; newBest: boolean; best: number | null } | null>(null);
  const [visible, setVisible] = useState(true);
  const [sound, setSound] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const [burst, setBurst] = useState(0);
  const [shake, setShake] = useState(false);

  const token = useRef(0);
  const nextSeeds = useRef<Record<string, number>>({});
  const recorded = useRef<string | null>(null);
  const playRef = useRef(play);
  playRef.current = play;
  // Problem announcements: only after the player's own move, once per new problem.
  const movedRef = useRef<{ sound: string; state: S } | null>(null);
  const lastProblem = useRef("");

  const running = !!play && play.status === "playing" && !loading && dialog === null && visible;
  const stopwatch = useStopwatch(running);
  const state = play ? play.history[play.history.length - 1] : null;

  /* ---------------- loading ---------------- */

  const prefetch = useCallback(
    (lv: string) => {
      const seed = nextSeeds.current[lv] ?? randomSeed();
      nextSeeds.current[lv] = seed;
      void requestPuzzle(def.id, lv, seed);
    },
    [def.id],
  );

  const begin = useCallback(
    (p: Play<P, S>, elapsedMs: number) => {
      setPlay(p);
      stopwatch.reset(elapsedMs);
      setMark(null);
      setStatus(null);
      setWin(null);
      setCelebrate(false);
      setLoading(false);
      recorded.current = p.status === "won" ? `${p.puzzle.level}:${p.puzzle.seed}` : null;
      setDealing(true);
      sfx.deal();
      window.setTimeout(() => setDealing(false), 900);
      prefetch(p.puzzle.level);
    },
    [prefetch, stopwatch],
  );

  const startPuzzle = useCallback(
    (lv: string, seed: number) => {
      const t = ++token.current;
      setLoading(true);
      setMark(null);
      setStatus(null);
      if (nextSeeds.current[lv] === seed) delete nextSeeds.current[lv];
      requestPuzzle<P>(def.id, lv, seed)
        .then((puzzle) => {
          if (t !== token.current) return;
          begin({ puzzle, history: [def.initialState(puzzle)], hintsUsed: 0, status: "playing", hintAt: { from: 0, ready: hintWait(0) } }, 0);
        })
        .catch(() => {
          if (t !== token.current) return;
          setLoading(false);
          setStatus({ text: "Couldn't build a puzzle. Tap New puzzle to try again.", alert: true });
        });
    },
    [begin, def, hintWait],
  );

  const newPuzzle = useCallback((lv: string) => startPuzzle(lv, nextSeeds.current[lv] ?? randomSeed()), [startPuzzle]);

  const resumeOrNew = useCallback(
    (lv: string) => {
      const saved = loadGame<P, S>(def.id, lv);
      if (saved && saved.status === "playing" && saved.puzzle?.level === lv && saved.history?.length) {
        token.current++;
        const hintAt = saved.hintAt ?? { from: 0, ready: hintWait(saved.hintsUsed) };
        begin({ puzzle: saved.puzzle, history: saved.history, hintsUsed: saved.hintsUsed, status: "playing", hintAt }, saved.elapsedMs);
        return;
      }
      newPuzzle(lv);
    },
    [begin, def.id, newPuzzle, hintWait],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pl = params.get("l");
    const seed = codeToSeed(params.get("p") ?? "");
    if (pl && levelIds.includes(pl) && seed) {
      setLevel(pl);
      saveLevel(def.id, pl);
      startPuzzle(pl, seed);
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      const saved = loadLevel(def.id);
      const lv = saved && levelIds.includes(saved) ? saved : levelIds[0];
      setLevel(lv);
      resumeOrNew(lv);
    }
    setStats(loadStats(def.id, levelIds));
    setSound(soundOn());
    const offSound = onSoundChange(setSound);
    // First visit: show the rules, once the splash screen has gone.
    let alive = true;
    if (!hasSeenHelp(def.id)) {
      void afterSplash().then(() => {
        if (!alive) return;
        setDialog("help");
        markHelpSeen(def.id);
      });
    }
    return () => {
      alive = false;
      offSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- persistence ---------------- */

  const persist = useCallback(
    (p: Play<P, S> | null) => {
      if (!p) return;
      saveGame(def.id, p.puzzle.level, {
        puzzle: p.puzzle,
        history: p.history,
        hintsUsed: p.hintsUsed,
        status: p.status,
        hintAt: p.hintAt,
        elapsedMs: stopwatch.get(),
      });
    },
    [def.id, stopwatch],
  );

  useEffect(() => persist(play), [play, persist]);

  useEffect(() => {
    const onVis = () => {
      setVisible(document.visibilityState === "visible");
      if (document.visibilityState === "hidden") persist(playRef.current);
    };
    const onHide = () => persist(playRef.current);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    const id = window.setInterval(() => persist(playRef.current), 5000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.clearInterval(id);
    };
  }, [persist]);

  /* ---------------- winning ---------------- */

  useEffect(() => {
    if (!play || play.status !== "won") return;
    const key = `${play.puzzle.level}:${play.puzzle.seed}`;
    if (recorded.current === key) return;
    recorded.current = key;
    const ms = stopwatch.get();
    const { stats: s, newBest } = recordWin(def.id, levelIds, play.puzzle.level, ms, play.hintsUsed);
    setStats(s);
    setWin({ ms, hints: play.hintsUsed, newBest, best: s[play.puzzle.level].bestMs });
    // the celebration: board wave + confetti + fanfare, then the results
    setCelebrate(true);
    setBurst((b) => b + 1);
    const t1 = window.setTimeout(() => sfx.win(), 120);
    const t2 = window.setTimeout(() => setDialog("win"), 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [play, stopwatch, def.id, levelIds]);

  /* ---------------- actions ---------------- */

  const apply = useCallback(
    (next: S, fx?: MoveFx) => {
      const name = fx?.sound ?? "place";
      if (name !== "none") (sfx[name] as (n?: number) => void)(fx?.step);
      movedRef.current = { sound: name, state: next };
      setPlay((p) => {
        if (!p || p.status !== "playing") return p;
        return { ...p, history: [...p.history, next], status: def.isSolved(p.puzzle, next) ? "won" : "playing" };
      });
      setMark(null);
      setStatus(null);
    },
    [def],
  );

  const undo = () => {
    sfx.undo();
    setPlay((p) => (p && p.status === "playing" && p.history.length > 1 ? { ...p, history: p.history.slice(0, -1) } : p));
    setMark(null);
    setStatus(null);
  };

  const reset = () => {
    sfx.erase();
    setPlay((p) => (p && p.status === "playing" ? { ...p, history: [...p.history, def.initialState(p.puzzle)] } : p));
    setMark(null);
    setStatus(null);
  };

  const askHint = async () => {
    const p = playRef.current;
    if (!p || p.status !== "playing" || hintBusy) return;
    const left = p.hintAt.ready - stopwatch.get();
    if (left > 0) {
      sfx.tap();
      const s = Math.ceil(left / 1000);
      setStatus({ text: `The next hint is ready in ${s} ${s === 1 ? "second" : "seconds"}. Have another look first.` });
      return;
    }
    setHintBusy(true);
    setStatus({ text: "Looking for the next step…" });
    try {
      const h = await def.hint(p.puzzle, p.history);
      if (playRef.current?.puzzle !== p.puzzle) return;
      setPlay((cur) => {
        if (!cur || cur.puzzle !== p.puzzle) return cur;
        let history = p.history.slice(0, Math.max(1, h.keep));
        if (h.state !== undefined) history = [...history, h.state];
        const last = history[history.length - 1];
        const now = stopwatch.get();
        return {
          ...cur,
          history,
          hintsUsed: cur.hintsUsed + 1,
          hintAt: { from: now, ready: now + hintWait(cur.hintsUsed + 1) },
          status: def.isSolved(cur.puzzle, last) ? "won" : "playing",
        };
      });
      setMark(h.mark ?? null);
      setStatus({ text: h.message });
      sfx.hint();
    } catch {
      setStatus({ text: "Couldn't find a hint. Try undoing a move.", alert: true });
    } finally {
      setHintBusy(false);
    }
  };

  const changeLevel = (lv: string) => {
    if (lv === level && play) return;
    persist(play);
    setLevel(lv);
    saveLevel(def.id, lv);
    setDialog(null);
    resumeOrNew(lv);
  };

  const share = async () => {
    if (!play) return;
    const url = `${window.location.origin}${BASE}/${def.id}/?l=${play.puzzle.level}&p=${seedToCode(play.puzzle.seed)}`;
    const text =
      play.status === "won" && win
        ? `I solved this ${def.name} puzzle in ${formatTime(win.ms)}. Can you beat it?`
        : `Try this ${def.name} puzzle.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: def.name, text, url });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setStatus({ text: "Link copied. Send it to a friend to play the same board." });
    } catch {
      setStatus({ text: url });
    }
  };

  const shakeBoard = useCallback(() => {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
    window.setTimeout(() => setShake(false), 420);
  }, []);

  const say = useCallback(
    (text: string, alert?: boolean) => {
      setStatus({ text, alert });
      if (alert) {
        sfx.error();
        shakeBoard();
      }
    },
    [shakeBoard],
  );

  /* ---------------- render ---------------- */

  const won = play?.status === "won";
  const progress = play && state !== null ? def.progress(play.puzzle, state) : { done: 0, total: 1 };
  const atStart = !play || play.history.length <= 1;

  // Broken rules and dead ends, as the game sees them after every move.
  const puzzle = play?.puzzle ?? null;
  const problem = useMemo(
    () => (puzzle && state !== null && !won && !loading && def.check ? def.check(puzzle, state) : null),
    [def, puzzle, state, won, loading],
  );
  const flagged = useMemo(() => new Set(problem?.cells ?? []), [problem]);

  // Announce a problem once, right after the move that caused it: a buzz (unless the
  // move already sounded wrong), plus a shake when the board can't be finished.
  useEffect(() => {
    const key = problem ? `${problem.kind}|${problem.message}|${problem.cells.join(",")}` : "";
    const before = lastProblem.current;
    lastProblem.current = key;
    const moved = movedRef.current;
    movedRef.current = null;
    if (!problem || !moved || moved.state !== state || key === before) return;
    const t = window.setTimeout(() => {
      if (moved.sound !== "error") sfx.error();
      if (problem.kind === "stuck") shakeBoard();
    }, 240);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem, shakeBoard]);

  // The hint meter fills with game time; the button glows once when it's ready.
  const clock = stopwatch.get();
  const hintAt = play?.hintAt;
  const charge = hintAt && hintAt.ready > hintAt.from ? Math.min(1, Math.max(0, (clock - hintAt.from) / (hintAt.ready - hintAt.from))) : 1;
  const charging = !!play && !won && charge < 1;
  const hintSecs = hintAt ? Math.max(0, Math.ceil((hintAt.ready - clock) / 1000)) : 0;
  const wasCharging = useRef(false);
  const [hintFresh, setHintFresh] = useState(false);
  useEffect(() => {
    const was = wasCharging.current;
    wasCharging.current = charging;
    if (!was || charging) return;
    setHintFresh(true);
    const t = window.setTimeout(() => setHintFresh(false), 900);
    return () => window.clearTimeout(t);
  }, [charging]);

  // Without a check (or when it finds nothing), a full but unsolved board still gets a word.
  const fullButWrong = !problem && !!play && !won && !loading && progress.done >= progress.total;
  const shown: Status =
    status ??
    (problem
      ? { text: problem.message, alert: true }
      : fullButWrong
        ? { text: "The board is full, but something's off. Undo a few moves, or take a hint.", alert: true }
        : null);
  const levelInfo = def.levels.find((l) => l.id === level) ?? def.levels[0];
  const Board = def.Board;
  const HowTo = def.HowTo;
  const WinBadge = def.WinBadge;
  const Icon = def.Icon;

  return (
    <main
      className={`app game-${def.id}`}
      style={{ "--felt": def.theme.felt, "--felt-deep": def.theme.feltDeep } as CSSProperties}
    >
      <header className="top">
        <Link href="/" className="back-link" aria-label="All games">
          <BackIcon />
        </Link>
        <h1 className="game-title">{def.name}</h1>
        <div className="top-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label={sound ? "Mute sounds" : "Turn sounds on"}
            aria-pressed={!sound}
            onClick={() => setSoundOn(!sound)}
          >
            {sound ? <SoundOnIcon /> : <SoundOffIcon />}
          </button>
          <button type="button" className="icon-btn" aria-label="How to play" onClick={() => setDialog("help")}>
            <HelpIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Statistics"
            onClick={() => {
              setStats(loadStats(def.id, levelIds));
              setDialog("stats");
            }}
          >
            <StatsIcon />
          </button>
        </div>
      </header>

      <div className="diff" role="radiogroup" aria-label="Difficulty">
        {def.levels.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={l.id === level} onClick={() => changeLevel(l.id)}>
            {l.label}
            <small>{l.detail}</small>
          </button>
        ))}
      </div>

      <div className="meta">
        <span className="timer" role="timer" aria-label="Time">
          {formatTime(stopwatch.get())}
        </span>
        <span className="code">{play ? `Puzzle ${seedToCode(play.puzzle.seed)}` : "Shuffling…"}</span>
      </div>

      <div className={`board-wrap ${celebrate ? "celebrate" : ""} ${shake ? "shake" : ""}`}>
        {loading || !play || state === null ? (
          <div className="tray loading" aria-busy>
            <span>Building a {levelInfo.label.toLowerCase()} puzzle…</span>
          </div>
        ) : (
          <Board
            key={`${play.puzzle.level}:${play.puzzle.seed}`}
            puzzle={play.puzzle}
            state={state}
            apply={apply}
            interactive={!won && !hintBusy}
            won={won}
            mark={mark}
            dealing={dealing}
            say={say}
            flagged={flagged}
          />
        )}
      </div>

      {def.pips && progress.total <= 30 ? (
        <div className="pips" aria-label={`${progress.done} of ${progress.total} done`} role="img">
          {Array.from({ length: progress.total }, (_, k) => (
            <span key={k} className={`pip ${k < progress.done ? "done" : ""}`} />
          ))}
        </div>
      ) : (
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-label="Progress"
        >
          <span style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} />
        </div>
      )}

      <p className={`status ${shown?.alert ? "alert" : ""}`} aria-live="polite">
        {shown && (
          <span key={shown.text} className="status-text">
            {shown.text}
          </span>
        )}
      </p>

      <div className="controls">
        <button type="button" className="btn" onClick={undo} disabled={!play || won || atStart}>
          <UndoIcon /> Undo
        </button>
        <button
          type="button"
          className={`btn hint-btn ${charging ? "charging" : ""} ${hintFresh ? "fresh" : ""}`}
          onClick={askHint}
          disabled={!play || won || hintBusy || loading}
          aria-disabled={charging || undefined}
          aria-label={charging ? `Hint, ready in ${hintSecs} seconds` : "Hint"}
          title={charging ? `Ready in ${hintSecs}s` : undefined}
          style={{ "--charge": charge } as CSSProperties}
        >
          <span className="hint-meter" aria-hidden />
          <HintIcon /> Hint
        </button>
        <button type="button" className="btn" onClick={reset} disabled={!play || won || atStart}>
          <ResetIcon /> Reset
        </button>
      </div>

      <button type="button" className="btn primary" onClick={() => newPuzzle(level)} disabled={loading}>
        <ShuffleIcon /> New puzzle
      </button>

      <Confetti
        burst={burst}
        from=".board-wrap"
        colors={[def.theme.felt, "#f4c542", "#ff8a4c", "#8fe0c2", "#f28b82", "#a993e6", "#fff8e8"]}
      />

      <Dialog open={dialog === "help"} onClose={() => setDialog(null)} title={`How to play ${def.name}`} label="How to play">
        <HowTo />
        <button type="button" className="btn primary" data-autofocus onClick={() => setDialog(null)}>
          Play
        </button>
      </Dialog>

      <Dialog open={dialog === "stats"} onClose={() => setDialog(null)} title={`${def.name} stats`} label="Statistics">
        {stats && (
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">Solved</th>
                <th scope="col">Best</th>
                <th scope="col">Average</th>
                <th scope="col">Hint-free streak</th>
              </tr>
            </thead>
            <tbody>
              {def.levels.map((l) => {
                const s = stats[l.id];
                return (
                  <tr key={l.id}>
                    <th scope="row">{l.label}</th>
                    <td>{s.solved}</td>
                    <td>{s.bestMs === null ? "–" : formatTime(s.bestMs)}</td>
                    <td>{s.solved ? formatTime(s.totalMs / s.solved) : "–"}</td>
                    <td>
                      {s.streak}
                      {s.bestStreak > s.streak ? ` (best ${s.bestStreak})` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="fine">Stats are kept on this device only.</p>
      </Dialog>

      <Dialog open={dialog === "win"} onClose={() => setDialog(null)} label="Puzzle solved" className="win">
        {win && play && state !== null && (
          <>
            <div className="win-badge">
              {WinBadge ? (
                <WinBadge puzzle={play.puzzle} state={state} />
              ) : (
                <span className="win-icon">
                  <Icon />
                </span>
              )}
            </div>
            <h2>Solved</h2>
            {win.newBest && <span className="badge">New best time for {levelInfo.label}</span>}
            <div className="win-stats">
              <div>
                <b>{formatTime(win.ms)}</b>
                <span>Time</span>
              </div>
              <div>
                <b>{win.best === null ? "–" : formatTime(win.best)}</b>
                <span>Best</span>
              </div>
              <div>
                <b>{win.hints}</b>
                <span>{win.hints === 1 ? "Hint" : "Hints"}</span>
              </div>
            </div>
            <div className="win-actions">
              <button
                type="button"
                className="btn primary"
                data-autofocus
                onClick={() => {
                  setDialog(null);
                  newPuzzle(level);
                }}
              >
                <ShuffleIcon /> Next puzzle
              </button>
              <button type="button" className="btn" onClick={share}>
                <ShareIcon /> Challenge a friend
              </button>
              <Link href="/" className="btn ghost">
                Play another game
              </Link>
            </div>
          </>
        )}
      </Dialog>
    </main>
  );
}
