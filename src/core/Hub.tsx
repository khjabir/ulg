"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { GAMES } from "@/games/registry";
import { summary } from "./storage";
import { onSoundChange, setSoundOn, soundOn } from "./sound";
import { SoundOffIcon, SoundOnIcon } from "./Icons";

type Summary = { solved: number; inProgress: boolean };

const LOGO = `${process.env.NEXT_PUBLIC_RELATIVE_ASSETS === "1" ? "." : (process.env.NEXT_PUBLIC_BASE_PATH ?? "")}/logo.svg`;

export function Hub() {
  const [sums, setSums] = useState<Record<string, Summary>>({});
  const [sound, setSound] = useState(true);

  useEffect(() => {
    setSums(Object.fromEntries(GAMES.map((g) => [g.id, summary(g.id, g.levels.map((l) => l.id))])));
    setSound(soundOn());
    return onSoundChange(setSound);
  }, []);

  const total = Object.values(sums).reduce((n, s) => n + s.solved, 0);

  return (
    <main className="hub">
      <header className="hub-head">
        <div className="hub-head-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hub-logo" src={LOGO} width={58} height={58} alt="" />
          <h1 className="hub-mark" aria-label="ulg">
            {["u", "l", "g"].map((ch, i) => (
              <span key={ch} className="hub-letter" style={{ "--i": i } as CSSProperties} aria-hidden>
                {ch}
              </span>
            ))}
          </h1>
          <button
            type="button"
            className="icon-btn hub-sound"
            aria-label={sound ? "Mute sounds" : "Turn sounds on"}
            aria-pressed={!sound}
            onClick={() => setSoundOn(!sound)}
          >
            {sound ? <SoundOnIcon /> : <SoundOffIcon />}
          </button>
        </div>
        <p className="hub-lede">Unlimited logic games: six puzzle types, a fresh board whenever you want one.</p>
      </header>

      <ul className="hub-list">
        {GAMES.map((g) => {
          const s = sums[g.id];
          const Icon = g.Icon;
          return (
            <li key={g.id}>
              <Link
                href={`/${g.id}/`}
                className="hub-card"
                style={{ "--felt": g.theme.felt, "--felt-deep": g.theme.feltDeep } as CSSProperties}
              >
                <span className="hub-icon">
                  <Icon />
                </span>
                <span className="hub-text">
                  <b>{g.name}</b>
                  <span>{g.blurb}</span>
                </span>
                <span className="hub-meta">{s?.inProgress ? "Continue" : s?.solved ? `${s.solved} solved` : "Play"}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <footer className="hub-foot">
        {total > 0 && (
          <p>
            {total} {total === 1 ? "puzzle" : "puzzles"} solved on this device.
          </p>
        )}
        <p>
          Works offline once it has loaded. Add it to your home screen to open it like an app.
        </p>
      </footer>
    </main>
  );
}
