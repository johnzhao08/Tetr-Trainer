import type { Board } from "./board";
import { drillController } from "./controller";
import type { Controller } from "./controller";
import type { DrillDef } from "./drill";
import { drillBest } from "./drillLookup";
import { DrillSession } from "./drillSession";
import { addPuzzles, harvestRecord } from "./harvest";
import {
  emptyProgress,
  loadProgress,
  betterOf,
  recordSession,
  saveProgress,
} from "./progress";
import type { Progress } from "./progress";
import type { Settings } from "./settings";

export type Outcome = {
  /** Saved progress including this run. */
  progress: Progress;
  priorBest: number | null;
  newBest: boolean;
  /** Undo or retry-from-here was used, so the run does not count. */
  assisted: boolean;
  saved: boolean;
};

/** A drill session plus what the screen needs around it. */
export type DrillRun = {
  session: DrillSession;
  controller: Controller;
  /** Board before each placement, by index, for key-moment previews. */
  before: Board[];
  /** True once undo or retry-from-here rewound the run. */
  assisted: boolean;
  retryFrom(index: number): void;
};

export function createRun(
  def: DrillDef,
  seed: number,
  settings: Settings,
): DrillRun {
  const session = new DrillSession(def, seed, settings);
  const run: DrillRun = {
    session,
    before: [],
    assisted: false,
    controller: drillController(session, {
      onRewind: () => {
        run.assisted = true;
      },
      onRestart: () => {
        run.before.length = 0;
        run.assisted = false;
      },
    }),
    retryFrom(index) {
      if (index < 0 || index >= session.game.state.pieces) return;
      session.retryFrom(index);
      // A paused game would otherwise stay paused after the rewind.
      session.game.resume();
      run.assisted = true;
    },
  };
  // DrillSession already owns onLock for grading; chain after it.
  const grade = session.game.onLock;
  session.game.onLock = (info) => {
    run.before[info.placement.index] = info.before;
    grade?.(info);
  };
  return run;
}

/**
 * Saves a finished run. A run that used undo or retry-from-here is saved with
 * completed: false: it is kept in history but never counts toward gates or
 * bests, because it replayed positions with hindsight.
 */
export function finishRun(
  storage: (Pick<Storage, "getItem" | "setItem">) | null,
  run: DrillRun,
  id: string,
  now: number,
): Outcome {
  const { session } = run;
  const loaded = storage ? loadProgress(storage) : emptyProgress();
  // Without this id, so saving twice (strict mode) compares the same prior.
  // Only the comparison uses it; the write goes on top of `loaded` so a
  // retry keeps its place and an invalid record cannot erase a valid one.
  const base: Progress = {
    version: 1,
    sessions: loaded.sessions.filter((s) => s.id !== id),
  };
  const key = session.def.primary;
  const priorBest = drillBest(base, session.def);
  const record = session.record(id, now);
  if (run.assisted) record.completed = false;
  const value = record.metrics[key];
  const higher = betterOf(key, session.def.better) === "higher";
  const newBest =
    record.completed &&
    value !== undefined &&
    (priorBest === null || (higher ? value > priorBest : value < priorBest));
  const progress = recordSession(loaded, record);
  const saved = storage ? saveProgress(storage, progress) : false;
  // Mistakes from this run become puzzles; never let that break saving.
  if (storage && saved)
    try {
      addPuzzles(storage, harvestRecord(record));
    } catch {
      // Puzzles are a bonus.
    }
  return { progress, priorBest, newBest, assisted: run.assisted, saved };
}
