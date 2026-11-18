/**
 * Player settings, like the gear menu in LinkedIn's games. A few are shared by every
 * game (timer, vibration; sound lives in sound.ts); each game can add its own
 * switches (GameDef.settings), such as Auto-check. Everything is kept on the device.
 */

export interface GameSetting {
  id: string;
  label: string;
  /** One line under the label, saying what changes. */
  help: string;
  default: boolean;
}

export type SettingValues = Readonly<Record<string, boolean>>;

/** Settings every game has. Sound is listed separately (it has its own store). */
export const SHARED_SETTINGS: GameSetting[] = [
  { id: "showTimer", label: "Show timer", help: "Hide the clock if it rushes you. Your times are still saved.", default: true },
  { id: "vibration", label: "Vibration", help: "A light buzz on phones for wins and dead ends.", default: true },
];

/** The usual Auto-check switch, for games that mark broken rules. */
export const AUTO_CHECK: GameSetting = {
  id: "autoCheck",
  label: "Auto-check",
  help: "Mark broken rules in red as you play. A dead end is always pointed out.",
  default: true,
};

const SHARED_KEY = "ulg:v1:settings";
const gameKey = (game: string) => `ulg:v1:${game}:settings`;

function read(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function write(key: string, values: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    /* private mode: settings last for this visit */
  }
}

export const defaultsFor = (defs: GameSetting[]): Record<string, boolean> =>
  Object.fromEntries([...SHARED_SETTINGS, ...defs].map((d) => [d.id, d.default]));

/** Shared and game settings together, with defaults for anything not set yet. */
export function loadSettings(game: string, defs: GameSetting[]): Record<string, boolean> {
  return { ...defaultsFor(defs), ...read(SHARED_KEY), ...read(gameKey(game)) };
}

export function saveSetting(game: string, id: string, value: boolean) {
  const shared = SHARED_SETTINGS.some((d) => d.id === id);
  const key = shared ? SHARED_KEY : gameKey(game);
  write(key, { ...read(key), [id]: value });
  if (id === "vibration") vibrationCache = value;
}

let vibrationCache: boolean | null = null;

/** Read by the sound module before every buzz. */
export function vibrationOn(): boolean {
  if (vibrationCache === null) vibrationCache = read(SHARED_KEY).vibration !== false;
  return vibrationCache;
}
