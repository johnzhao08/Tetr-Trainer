import { restoreBoth } from "../core/backup";
import { emptyProgress, loadProgress, saveProgress } from "../core/progress";
import type { Progress } from "../core/progress";
import { emptyTraining, loadTraining, saveTraining } from "../core/training";
import type { Training } from "../core/training";

/** Browser storage, or null when it is blocked. */
export function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function readProgress(): Progress {
  const s = storage();
  return s ? loadProgress(s) : emptyProgress();
}

/** True when the progress was written to browser storage. */
export function writeProgress(progress: Progress): boolean {
  const s = storage();
  return s ? saveProgress(s, progress) : false;
}

export function readTraining(): Training {
  const s = storage();
  return s ? loadTraining(s) : emptyTraining();
}

/** True when the training data was written to browser storage. */
export function writeTraining(training: Training): boolean {
  const s = storage();
  return s ? saveTraining(s, training) : false;
}

/** Writes both atomically; false (with storage rolled back) on any failure. */
export function writeBoth(progress: Progress, training: Training): boolean {
  const s = storage();
  return s ? restoreBoth(s, { progress, training }) : false;
}
