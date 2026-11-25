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

// One backup file for everything saved in the browser. Format 2 wraps the
// progress and training blobs; old progress-only files (version 1, with a
// `sessions` array) are still accepted and leave training untouched.
export function exportBackup(progress: Progress, training: Training): string {
  return JSON.stringify(
    {
      version: 2,
      progress: JSON.parse(exportProgress(progress)),
      training: JSON.parse(exportTraining(training)),
    },
    null,
    2,
  );
}

export type BackupResult = {
  progress: ImportResult;
  /** Null for an old progress-only file: keep the current training. */
  training: Training | null;
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
  if (obj.version !== 2) {
    const progress = importProgressCounted(text);
    return progress ? { progress, training: null } : null;
  }
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
  return progress && training ? { progress, training } : null;
}

type RestoreStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Writes progress and training together. If either write fails, both keys go
 * back to what they held before, so storage is never half-restored.
 */
export function restoreBoth(
  storage: RestoreStorage,
  data: { progress: Progress; training: Training },
): boolean {
  let before: [string | null, string | null];
  try {
    before = [storage.getItem(PROGRESS_KEY), storage.getItem(TRAINING_KEY)];
  } catch {
    return false;
  }
  if (
    saveProgress(storage, data.progress) &&
    saveTraining(storage, data.training)
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
  return false;
}
