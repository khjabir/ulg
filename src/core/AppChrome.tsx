"use client";

import { useEffect, useRef, useState } from "react";
import {
  APP_VERSION,
  BUILD_DATE,
  applyUpdate,
  checkForUpdates,
  hideSplash,
  promptInstall,
  startApp,
  useApp,
  type AppState,
} from "./app";
import { Dialog } from "./Dialog";
import { AddSquareIcon, CheckIcon, CloseIcon, InstallIcon, IosShareIcon, MenuIcon, RefreshIcon } from "./Icons";

const LOGO = `${process.env.NEXT_PUBLIC_RELATIVE_ASSETS === "1" ? "." : (process.env.NEXT_PUBLIC_BASE_PATH ?? "")}/logo.svg`;
const CARD_KEY = "ulg:v1:install-card";
const CARD_SNOOZE = 14 * 24 * 3600 * 1000;

/** Mounted once in the layout: starts install/update handling, lifts the splash, shows the update banner. */
export function AppRuntime() {
  useEffect(() => {
    startApp();
    hideSplash();
  }, []);
  return <UpdateBanner />;
}

/** "A new version is ready", on every screen, until the player updates or says later. */
function UpdateBanner() {
  const app = useApp();
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState(false);
  if (app.update !== "ready" || later) return null;
  return (
    <div className="update-banner" role="status">
      <span className="update-icon" aria-hidden>
        <RefreshIcon />
      </span>
      <span className="update-text">
        <b>A new version of Refill is ready</b>
        <span>Your game picks up right where you left it.</span>
      </span>
      <span className="update-actions">
        <button type="button" className="btn ghost small" onClick={() => setLater(true)}>
          Later
        </button>
        <button
          type="button"
          className="btn accent small"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            applyUpdate();
          }}
        >
          {busy ? "Updating…" : "Update"}
        </button>
      </span>
    </div>
  );
}

const canInstallHere = (app: AppState) => !app.standalone && (app.canPrompt || app.platform !== "desktop");

/** An indeterminate progress bar: the browser doesn't say how far along it is. */
const Busy = ({ label }: { label: string }) => <span className="busy-bar" role="progressbar" aria-label={label} />;

/**
 * The home screen's "Get the app" card. It shows the install button (or the steps),
 * then "Installing…" with a progress bar while the browser adds the app, then
 * "Installed" for a few seconds, and after that it's gone for good. "Not now" hides
 * it for two weeks.
 */
export function InstallCard({ onHowTo }: { onHowTo: () => void }) {
  const app = useApp();
  const [hidden, setHidden] = useState(true);
  const [justInstalled, setJustInstalled] = useState(false);
  const before = useRef<AppState["install"] | null>(null);
  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(CARD_KEY) ?? 0);
      setHidden(Date.now() - at < CARD_SNOOZE);
    } catch {
      setHidden(false);
    }
  }, []);
  // Celebrate only an install that happens now, not the state found on opening.
  useEffect(() => {
    if (!app.ready) return;
    const was = before.current;
    before.current = app.install;
    if (was === null || was === "installed" || app.install !== "installed") return;
    setJustInstalled(true);
    const t = window.setTimeout(() => setJustInstalled(false), 6000);
    return () => window.clearTimeout(t);
  }, [app.install, app.ready]);

  if (!app.ready || app.standalone) return null;
  if (app.install === "installing") {
    return (
      <section className="install-card busy" aria-live="polite" aria-label="Installing the app">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="" width={52} height={52} />
        <span className="install-text">
          <b>Installing Refill…</b>
          <span>Your browser is adding it to your home screen. This takes a few seconds.</span>
          <Busy label="Installing" />
        </span>
      </section>
    );
  }
  if (app.install === "installed") {
    if (!justInstalled) return null;
    return (
      <section className="install-card done" aria-live="polite" aria-label="App installed">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="" width={52} height={52} />
        <span className="install-text">
          <b>
            <CheckIcon /> Refill is installed
          </b>
          <span>Open it from your home screen to play full screen.</span>
        </span>
        <button type="button" className="install-close" aria-label="Close" onClick={() => setJustInstalled(false)}>
          <CloseIcon />
        </button>
      </section>
    );
  }
  if (hidden || !canInstallHere(app)) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(CARD_KEY, String(Date.now()));
    } catch {
      /* private mode: it just comes back next time */
    }
  };
  return (
    <section className="install-card" aria-label="Install the app">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO} alt="" width={52} height={52} />
      <span className="install-text">
        <b>Get the Refill app</b>
        <span>Full screen, works offline, one tap from your home screen.</span>
      </span>
      {app.canPrompt ? (
        <button type="button" className="btn accent small" onClick={() => void promptInstall()}>
          <InstallIcon /> Install
        </button>
      ) : (
        <button type="button" className="btn accent small" onClick={onHowTo}>
          <InstallIcon /> How?
        </button>
      )}
      <button type="button" className="install-close" aria-label="Not now" onClick={dismiss}>
        <CloseIcon />
      </button>
    </section>
  );
}

function InstallSteps({ app }: { app: AppState }) {
  if (app.standalone) {
    return (
      <p className="menu-line ok">
        <CheckIcon /> Installed. You&rsquo;re playing the app.
      </p>
    );
  }
  if (app.install === "installing") {
    return (
      <>
        <p className="menu-line">Installing Refill… your browser is adding it to your home screen.</p>
        <Busy label="Installing" />
      </>
    );
  }
  if (app.install === "installed") {
    return (
      <p className="menu-line ok">
        <CheckIcon /> Installed. Open Refill from your home screen to play full screen.
      </p>
    );
  }
  if (app.canPrompt) {
    return (
      <>
        <p className="menu-line">Play full screen from your home screen, even offline.</p>
        <button type="button" className="btn primary" onClick={() => void promptInstall()}>
          <InstallIcon /> Install Refill
        </button>
      </>
    );
  }
  if (app.platform === "ios") {
    return (
      <ol className="steps">
        <li>
          Tap <span className="key"><IosShareIcon /> Share</span> in the browser bar.
        </li>
        <li>
          Scroll down and tap <span className="key"><AddSquareIcon /> Add to Home Screen</span>.
        </li>
        <li>
          Tap <b>Add</b>. Refill now opens full screen from its own icon.
        </li>
      </ol>
    );
  }
  if (app.platform === "android") {
    return (
      <ol className="steps">
        <li>
          Open your browser&rsquo;s menu (<b>⋮</b>).
        </li>
        <li>
          Tap <b>Install app</b> or <b>Add to Home screen</b>.
        </li>
        <li>Refill now opens full screen from its own icon.</li>
      </ol>
    );
  }
  return (
    <p className="menu-line">
      In Chrome or Edge, click the install button at the right of the address bar. In Safari on a Mac, choose{" "}
      <b>File → Add to Dock</b>.
    </p>
  );
}

const UPDATE_LINE: Record<AppState["update"], string> = {
  idle: "",
  checking: "Checking for a new version…",
  downloading: "Downloading the new version…",
  ready: "A new version is ready.",
  latest: "You have the latest version.",
  offline: "You're offline. Refill checks again when you're back online.",
  unavailable: "Updates arrive by themselves in the installed app.",
};

function prettyDate(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The "⋯" button on the home screen and the sheet it opens. */
export function AppMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const app = useApp();
  const busy = app.update === "checking" || app.update === "downloading";
  return (
    <>
      <button type="button" className="icon-btn" aria-label="App menu" onClick={() => onOpenChange(true)}>
        <MenuIcon />
      </button>
      <Dialog open={open} onClose={() => onOpenChange(false)} title="Refill" label="App menu" className="app-menu">
        <section>
          <h3>{app.standalone || app.install === "installed" ? "App" : "Install the app"}</h3>
          <InstallSteps app={app} />
        </section>
        <section>
          <h3>Updates</h3>
          <p className="menu-line">
            Version {APP_VERSION}
            {BUILD_DATE && <span className="muted"> · built {prettyDate(BUILD_DATE)}</span>}
          </p>
          {UPDATE_LINE[app.update] && (
            <p className={`menu-line ${app.update === "latest" ? "ok" : ""}`} aria-live="polite">
              {app.update === "latest" && <CheckIcon />}
              {UPDATE_LINE[app.update]}
            </p>
          )}
          {app.update === "ready" ? (
            <button type="button" className="btn primary" onClick={applyUpdate}>
              <RefreshIcon /> Update now
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy} onClick={() => void checkForUpdates()}>
              <RefreshIcon /> {busy ? "Checking…" : "Check for updates"}
            </button>
          )}
        </section>
        <p className="fine">Puzzles are made on this device, and your progress stays here too.</p>
      </Dialog>
    </>
  );
}
