import type { Game } from "../core/game";
import { trackActivity } from "../core/trends";
import type { Activity } from "../core/trends";
import { loadProgress, recordSession, saveProgress } from "../core/progress";
import type { SessionRecord } from "../core/progress";
import { storage } from "./progressStorage";

const PREF_KEY = "tetr-trainer.freeplay-save.v1";

/** Whether the player opted in to saving freeplay games. Off by default. */
export function readSavePref(): boolean {
  try {
    return storage()?.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSavePref(on: boolean) {
  try {
    storage()?.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    /* The choice then lasts only for this visit. */
  }
}

/** Adds one freeplay record to saved progress; replaces the same game's earlier record. */
export function saveFreeplayRecord(record: SessionRecord | null): boolean {
  const s = storage();
  if (!s || !record) return false;
  return saveProgress(s, recordSession(loadProgress(s), record));
}

const activity = new WeakMap<Game, Activity>();

/** Time of the game's last lock or restart; unchanged while the game sits idle. */
export function lastActivityAt(game: Game, now = Date.now()): number {
  const next = trackActivity(
    activity.get(game),
    game.state.seed,
    game.state.pieces,
    now,
  );
  activity.set(game, next);
  return next.at;
}
