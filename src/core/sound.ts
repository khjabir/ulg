"use client";

import { vibrationOn } from "./settings";

/**
 * Small synthesized sound kit (Web Audio, no audio files): wooden clacks for
 * placing pieces, marimba notes for merges and checkpoints, a soft bonk for
 * mistakes and a fanfare for wins. Light haptics on phones that support them.
 * Muting is remembered on this device.
 */

const KEY = "ulg:v1:sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    enabled = localStorage.getItem(KEY) !== "off";
  } catch {
    /* storage blocked: keep sound on */
  }
}

export function soundOn(): boolean {
  load();
  return enabled;
}

export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(on));
  if (on) sfx.select();
}

export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function audio(): AudioContext | null {
  if (!soundOn() || typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function buzz(pattern: number | number[]) {
  if (!vibrationOn()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

interface Tone {
  f: number;
  t?: number; // delay (s)
  d?: number; // length (s)
  type?: OscillatorType;
  g?: number; // peak gain
  to?: number; // glide to this frequency
}

function tone(c: AudioContext, { f, t = 0, d = 0.14, type = "sine", g = 0.18, to }: Tone) {
  const o = c.createOscillator();
  const v = c.createGain();
  const t0 = c.currentTime + t;
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
  v.gain.setValueAtTime(0.0001, t0);
  v.gain.exponentialRampToValueAtTime(g, t0 + 0.005);
  v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(v);
  v.connect(master!);
  o.start(t0);
  o.stop(t0 + d + 0.03);
}

/** A short filtered noise burst: the "clack" of a tile on a table. */
function clack(c: AudioContext, { t = 0, f = 2000, g = 0.25, d = 0.045 }: { t?: number; f?: number; g?: number; d?: number }) {
  if (!noise) return;
  const s = c.createBufferSource();
  s.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = f;
  bp.Q.value = 1.4;
  const v = c.createGain();
  const t0 = c.currentTime + t;
  v.gain.setValueAtTime(g, t0);
  v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(bp);
  bp.connect(v);
  v.connect(master!);
  s.start(t0);
  s.stop(t0 + d + 0.01);
}

const PENTA = [0, 2, 4, 7, 9];
/** Step along a major pentatonic scale from `base` Hz, so any sequence sounds pleasant. */
const note = (step: number, base = 392) => {
  const s = Math.max(-10, Math.min(24, Math.round(step)));
  const octave = Math.floor(s / 5);
  return base * Math.pow(2, (octave * 12 + PENTA[((s % 5) + 5) % 5]) / 12);
};

function marimba(c: AudioContext, f: number, t = 0, g = 0.2, d = 0.32) {
  tone(c, { f, t, d, g });
  tone(c, { f: f * 4, t, d: d * 0.25, g: g * 0.18 });
}

export const sfx = {
  /** Light tick: selecting, hovering a new cell while drawing. */
  tap() {
    const c = audio();
    if (c) clack(c, { f: 3000, g: 0.12, d: 0.025 });
  },
  select() {
    const c = audio();
    if (c) tone(c, { f: 1046, d: 0.05, g: 0.05 });
  },
  /** Placing a piece; `step` picks the pitch. */
  place(step = 0) {
    const c = audio();
    if (!c) return;
    clack(c, { f: 1700, g: 0.22, d: 0.04 });
    tone(c, { f: note(step, 330), d: 0.13, type: "triangle", g: 0.09 });
  },
  /** A soft mark (an X, a note). */
  mark() {
    const c = audio();
    if (c) clack(c, { f: 2600, g: 0.14, d: 0.03 });
  },
  /** Merging tiles: higher numbers ring higher. */
  pop(step = 0) {
    const c = audio();
    if (!c) return;
    clack(c, { f: 1500, g: 0.2, d: 0.04 });
    marimba(c, note(step, 262), 0.01, 0.2);
  },
  /** One step of a drawn path; `progress` 0..1 raises the pitch as the path grows. */
  step(progress = 0) {
    const c = audio();
    if (c) tone(c, { f: 260 + 560 * Math.min(1, Math.max(0, progress)), d: 0.06, type: "triangle", g: 0.06 });
  },
  checkpoint(step = 0) {
    const c = audio();
    if (!c) return;
    marimba(c, note(step + 5, 392), 0, 0.14, 0.28);
    marimba(c, note(step + 7, 392), 0.07, 0.11, 0.3);
  },
  erase() {
    const c = audio();
    if (c) tone(c, { f: 560, to: 240, d: 0.13, type: "triangle", g: 0.08 });
  },
  undo() {
    const c = audio();
    if (c) tone(c, { f: 480, to: 320, d: 0.1, type: "triangle", g: 0.07 });
  },
  error() {
    const c = audio();
    if (c) {
      tone(c, { f: 196, d: 0.11, type: "square", g: 0.035 });
      tone(c, { f: 147, t: 0.09, d: 0.16, type: "square", g: 0.035 });
    }
    buzz(35);
  },
  hint() {
    const c = audio();
    if (!c) return;
    tone(c, { f: note(9, 523), d: 0.35, g: 0.08 });
    tone(c, { f: note(12, 523), t: 0.1, d: 0.5, g: 0.07 });
  },
  /** A new board being dealt. */
  deal() {
    const c = audio();
    if (!c) return;
    for (let k = 0; k < 5; k++) clack(c, { t: k * 0.045, f: 1500 + k * 180, g: 0.1, d: 0.035 });
  },
  win() {
    const c = audio();
    if (c) {
      [0, 2, 4, 5, 7].forEach((s, k) => marimba(c, note(s, 392), k * 0.075, 0.16, 0.35));
      [7, 9, 11].forEach((s) => marimba(c, note(s, 392), 0.42, 0.09, 1.1));
      [0.55, 0.68, 0.8, 0.95].forEach((t, k) => tone(c, { f: note(14 + k, 523), t, d: 0.18, g: 0.03 }));
    }
    buzz([20, 50, 30]);
  },
};

export type SoundName = keyof typeof sfx;
