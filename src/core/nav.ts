"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/*
 * App-style navigation, like a native game app rather than a website.
 *
 * - Two levels: Home, and one game on top of it. Opening a game from Home adds one
 *   step; leaving it (the ‹ button, "Play another game", or the phone's Back)
 *   always goes back to Home. Games never pile up, so Back from Home leaves the app.
 * - A game opened straight from a shared link or an app shortcut gets Home slipped
 *   in underneath, so Back still goes Home first.
 * - Where the browser doesn't close dialogs on Back by itself, an open dialog holds
 *   one step of its own, so Back closes the dialog before it leaves the screen.
 * - Screens slide like an app: a game comes in from the right; going back slides it
 *   away and Home comes back from the left.
 */

export type Screen = "home" | "game";
type Router = ReturnType<typeof useRouter>;
type Dir = "forward" | "back";

let router: Router | null = null;
/** The screen on display, and the address of Home as seen from it. */
let current: Screen | null = null;
let homePath: string | null = null;
let firstScreen = true;
/** A slide in progress, waiting for its new screen to mount. */
let waiting: { screen: Screen; done: () => void } | null = null;
/** Dialogs holding a history step (only where Back doesn't close dialogs natively). */
const overlays: { close: () => void }[] = [];
let ignorePops = 0;
let fallback: ReturnType<typeof setTimeout> | undefined;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
// Chrome on Android closes an open dialog on Back by itself (CloseWatcher).
const nativeDialogBack = () => typeof window !== "undefined" && "CloseWatcher" in window;

type StartViewTransition = (cb: () => Promise<void>) => { finished: Promise<void> };

/** Run `go`, animating the screen change when the browser can. */
function slide(dir: Dir, screen: Screen, go: () => void) {
  const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
  if (!start || reducedMotion() || waiting) {
    go();
    return;
  }
  const root = document.documentElement;
  root.dataset.nav = dir;
  const t = start.call(document, () => {
    return new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        if (waiting?.done === finish) waiting = null;
        resolve();
      };
      // Never hold the screen frozen for long, whatever happens.
      const timer = setTimeout(finish, 1000);
      waiting = { screen, done: finish };
      go();
    });
  });
  t.finished.finally(() => {
    if (root.dataset.nav === dir) delete root.dataset.nav;
  });
}

/** Open a game from Home. */
export function openGame(href: string) {
  if (!router) return;
  const r = router;
  slide("forward", "game", () => r.push(href));
}

/** Leave a game for Home by stepping back, so games never stack up. */
export function goHome() {
  if (!router) return;
  const r = router;
  // Any dialogs holding a step are left behind with the screen.
  const steps = overlays.length + 1;
  overlays.length = 0;
  slide("back", "home", () => {
    window.history.go(-steps);
    // If there was nothing to step back to, go Home directly.
    clearTimeout(fallback);
    fallback = setTimeout(() => {
      if (current === "game") r.replace("/");
    }, 600);
  });
}

/**
 * A dialog opened: where Back wouldn't close it natively, give it a history step so
 * Back closes it. Returns the function to call when it closes some other way.
 */
export function holdBack(close: () => void): () => void {
  if (nativeDialogBack()) return () => {};
  const entry = { close };
  overlays.push(entry);
  window.history.pushState({ refillDialog: true }, "");
  return () => {
    const i = overlays.indexOf(entry);
    if (i < 0) return; // Back already closed it, or the screen is going away
    overlays.splice(i, 1);
    ignorePops++;
    window.history.back();
  };
}

/** Slip Home in under a game that was opened directly, so Back goes Home first. */
function seedHome() {
  const navEntry = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  // A reload or a return to this page: the steps below are already ours.
  if (navEntry && navEntry.type !== "navigate") return;
  if (!homePath) return;
  const here = window.location.href;
  const state: unknown = window.history.state;
  // The unpatched methods: the router must not see this as a navigation. Home's step
  // carries no router state, and is turned into a real visit when Back lands on it.
  History.prototype.replaceState.call(window.history, null, "", homePath);
  History.prototype.pushState.call(window.history, state, "", here);
}

/**
 * Called by each screen. Returns true when the screen arrived by a slide, so it can
 * skip its own entrance animation.
 */
export function useScreen(screen: Screen): boolean {
  const [slid] = useState(() => waiting?.screen === screen);
  useEffect(() => {
    const first = firstScreen;
    firstScreen = false;
    current = screen;
    if (screen === "game") {
      homePath = window.location.pathname.replace(/[^/]+\/?$/, "");
      if (first) seedHome();
    }
    clearTimeout(fallback);
    if (waiting?.screen === screen) waiting.done();
    return () => {
      if (current === screen) current = null;
    };
  }, [screen]);
  return slid;
}

/** Mounted once, in the layout: hands Back over to the app. */
export function useAppNavigation() {
  const r = useRouter();
  useEffect(() => {
    router = r;
    // Capture phase, so this runs before the router's own Back handling.
    const onPop = (e: PopStateEvent) => {
      if (ignorePops > 0) {
        // A dialog closed itself and gave back its step.
        ignorePops--;
        e.stopImmediatePropagation();
        return;
      }
      if (overlays.length) {
        // Back with a dialog open: close the dialog, stay on the screen.
        e.stopImmediatePropagation();
        overlays.pop()!.close();
        return;
      }
      if (current === "game" && window.location.pathname === homePath) {
        // Back from a game: slide Home in, as a fresh visit so a slipped-in Home works too.
        e.stopImmediatePropagation();
        clearTimeout(fallback);
        // A swipe-back gesture already animated the change: don't slide a second time.
        const animated = (e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition === true;
        if (waiting || animated) r.replace("/");
        else slide("back", "home", () => r.replace("/"));
      }
    };
    window.addEventListener("popstate", onPop, true);
    return () => {
      window.removeEventListener("popstate", onPop, true);
      if (router === r) router = null;
    };
  }, [r]);
}
