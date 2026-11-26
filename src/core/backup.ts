import {
  PUZZLES_KEY,
  parsePuzzleStore,
  serializePuzzleStore,
  emptyPuzzleStore,
  writeStored,
} from "./harvest";
import type { PuzzleStore } from "./harvest";
import {
  PROGRESS_KEY,
  exportProgress,
  importProgressCounted,
  saveProgress,
} from "./progress";
import type { ImportResult, Progress } from "./progress";
import {
  TRAINING_KEY,
  exportTraining,
  importTraining,
  saveTraining,
} from "./training";
import type { Training } from "./training";

// One backup file for everything saved in the browser. Format 3 wraps the
// progress, training and harvested-puzzle blobs. Format 2 (no puzzles) and old
// progress-only files (version 1, with a `sessions` array) are still accepted;
// neither carries puzzles, so those imports start the puzzle store empty and it
// is harvested again from the imported sessions' replays.
export function exportBackup(
  progress: Progress,
  training: Training,
  puzzles: PuzzleStore,
): string {
  return JSON.stringify(
    {
      version: 3,
      progress: JSON.parse(exportProgress(progress)),
      training: JSON.parse(exportTraining(training)),
      puzzles: serializePuzzleStore(puzzles),
    },
    null,
    2,
  );
}

export type BackupResult = {
  progress: ImportResult;
  /** Null for an old progress-only file: keep the current training. */
  training: Training | null;
  /** The puzzle store to write: empty for formats that carry none. */
  puzzles: PuzzleStore;
};

/** Null when nothing usable was found; a bad file never replaces data. */
export function importBackup(text: string): BackupResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 2 && obj.version !== 3) {
    const progress = importProgressCounted(text);
    return progress ? { progress, training: null, puzzles: emptyPuzzleStore() } : null;
  }
  const puzzles = obj.version === 3 ? parsePuzzleStore(obj.puzzles) : emptyPuzzleStore();
  if (!puzzles) return null;
  // A v2 backup must carry every training container; a bare {version:1}
  // would otherwise import as empty training and erase existing data.
  const t = obj.training as Record<string, unknown> | null | undefined;
  const isObject = (v: unknown) =>
    !!v && typeof v === "object" && !Array.isArray(v);
  if (
    !isObject(t) ||
    !isObject(t!.players) ||
    !isObject(t!.puzzles) ||
    !Array.isArray(t!.review)
  )
    return null;
  const progress = importProgressCounted(JSON.stringify(obj.progress));
  const training = importTraining(JSON.stringify(obj.training));
  return progress && training ? { progress, training, puzzles } : null;
}

type RestoreStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Writes progress, training and the puzzle store together. If any write fails, all keys go
 * back to what they held before, so storage is never half-restored.
 */
export function restoreBoth(
  storage: RestoreStorage,
  data: { progress: Progress; training: Training; puzzles: PuzzleStore },
): boolean {
  let before: [string | null, string | null, string | null];
  try {
    before = [
      storage.getItem(PROGRESS_KEY),
      storage.getItem(TRAINING_KEY),
      storage.getItem(PUZZLES_KEY),
    ];
  } catch {
    return false;
  }
  if (
    saveProgress(storage, data.progress) &&
    saveTraining(storage, data.training) &&
    writeStored(storage, data.puzzles)
  )
    return true;
  const undo = (key: string, value: string | null) => {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch {
      // Nothing more can be done; the caller reports the failure.
    }
  };
  undo(PROGRESS_KEY, before[0]);
  undo(TRAINING_KEY, before[1]);
  undo(PUZZLES_KEY, before[2]);
  return false;
}
