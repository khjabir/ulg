"use client";

/**
 * The app around the games: installing to the home screen and picking up updates.
 *
 * Installing: Chrome, Edge and Samsung Internet fire `beforeinstallprompt`; an inline
 * script in the layout catches it before React loads (it can fire very early) and we
 * show our own Install button. iPhone and iPad have no prompt, so we explain Share →
 * Add to Home Screen instead.
 *
 * Updating: a new deploy ships a new sw.js. The browser installs it in the background
 * and it waits (see public/sw.js). We say "A new version is ready" and, when the
 * player taps Update, tell it to take over and reload. Their game in progress is
 * saved, so it picks up where it was. Checks run on open, when the app comes back to
 * the foreground, every 30 minutes, and from the menu.
 */

import { useSyncExternalStore } from "react";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __ulgInstall?: InstallPrompt | null;
  }
  interface Navigator {
    standalone?: boolean;
  }
}

export type Platform = "ios" | "android" | "desktop";
export type UpdateState = "idle" | "checking" | "downloading" | "ready" | "latest" | "offline" | "unavailable";

export interface AppState {
  ready: boolean;
  /** Running as an installed app (home screen / app window). */
  standalone: boolean;
  platform: Platform;
  /** The browser offered an install prompt we can show. */
  canPrompt: boolean;
  update: UpdateState;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";

const SERVER: AppState = { ready: false, standalone: false, platform: "desktop", canPrompt: false, update: "idle" };
let state: AppState = SERVER;
const listeners = new Set<() => void>();
const set = (patch: Partial<AppState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER,
  );
}

let registration: ServiceWorkerRegistration | null = null;
let updateRequested = false;
let started = false;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  navigator.standalone === true;

/** Watch one installing worker until it's ready to take over. */
function track(worker: ServiceWorker | null) {
  if (!worker) return;
  set({ update: "downloading" });
  worker.addEventListener("statechange", () => {
    if (worker.state === "installed") set({ update: navigator.serviceWorker.controller ? "ready" : "idle" });
    if (worker.state === "redundant" && state.update === "downloading") set({ update: "idle" });
  });
}

async function startUpdates() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_RELATIVE_ASSETS === "1") {
    set({ update: "unavailable" });
    return;
  }
  if (!("serviceWorker" in navigator)) {
    set({ update: "unavailable" });
    return;
  }
  // Reload once the new version has taken over, but only when the player asked for
  // it: the very first install also "takes over" and must not reload the page.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateRequested) return;
    updateRequested = false;
    window.location.reload();
  });
  try {
    registration = await navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/`, updateViaCache: "none" });
  } catch {
    set({ update: "unavailable" });
    return; // offline play is a bonus; the games work without it
  }
  const reg = registration;
  if (reg.waiting && navigator.serviceWorker.controller) set({ update: "ready" });
  else if (reg.installing) track(reg.installing);
  reg.addEventListener("updatefound", () => track(reg.installing));

  let last = Date.now();
  const quietCheck = () => {
    if (!navigator.onLine || Date.now() - last < 60_000) return;
    last = Date.now();
    reg.update().catch(() => undefined);
  };
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && quietCheck());
  window.setInterval(quietCheck, 30 * 60_000);
}

/** Start once, from the layout. Safe to call again. */
export function startApp() {
  if (started || typeof window === "undefined") return;
  started = true;
  set({ ready: true, standalone: isStandalone(), platform: detectPlatform(), canPrompt: !!window.__ulgInstall });
  window.addEventListener("ulg-installable", () => set({ canPrompt: !!window.__ulgInstall }));
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window.__ulgInstall = e as InstallPrompt;
    set({ canPrompt: true });
  });
  window.addEventListener("appinstalled", () => {
    window.__ulgInstall = null;
    set({ canPrompt: false });
  });
  window.matchMedia("(display-mode: standalone)").addEventListener("change", () => set({ standalone: isStandalone() }));
  void startUpdates();
}

/** Show the browser's install dialog. Resolves true when the player installs. */
export async function promptInstall(): Promise<boolean> {
  const p = window.__ulgInstall;
  if (!p) return false;
  window.__ulgInstall = null;
  set({ canPrompt: false });
  await p.prompt();
  const { outcome } = await p.userChoice;
  return outcome === "accepted";
}

/** Look for a new version now (the menu's "Check for updates"). */
export async function checkForUpdates() {
  const reg = registration;
  if (!reg) {
    set({ update: "unavailable" });
    return;
  }
  if (reg.waiting) {
    set({ update: "ready" });
    return;
  }
  if (!navigator.onLine) {
    set({ update: "offline" });
    return;
  }
  set({ update: "checking" });
  try {
    await reg.update();
  } catch {
    set({ update: "offline" });
    return;
  }
  if (reg.waiting) set({ update: "ready" });
  else if (reg.installing) track(reg.installing);
  else set({ update: "latest" });
}

/** Switch to the waiting version and reload. */
export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  updateRequested = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
}
