import { exportProgress, importProgressCounted } from "./progress";
import type { ImportResult, Progress } from "./progress";
import { exportTraining, importTraining } from "./training";
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
  const progress = importProgressCounted(JSON.stringify(obj.progress));
  const training = importTraining(JSON.stringify(obj.training));
  return progress && training ? { progress, training } : null;
}
