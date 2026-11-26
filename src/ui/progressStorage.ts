import { restoreBoth } from "../core/backup";
import { emptyProgress, loadProgress, saveProgress } from "../core/progress";
import type { Progress } from "../core/progress";
import { loadPuzzleStore, reconcileHarvest } from "../core/harvest";
import type { PuzzleStore } from "../core/harvest";
import type { PuzzleDef } from "../core/puzzle";
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

/** Your puzzles, after harvesting any replayable sessions not yet processed. */
export function readPuzzles(progress: Progress): PuzzleDef[] {
  const s = storage();
  if (!s) return [];
  try {
    return reconcileHarvest(s, progress.sessions);
  } catch {
    return [];
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

/** The stored puzzles and processed session ids, for backups. */
export function readPuzzleStore(): PuzzleStore {
  const s = storage();
  return s ? loadPuzzleStore(s) : { puzzles: [], processed: [] };
}

/** Writes all three atomically; false (with storage rolled back) on any failure. */
export function writeAll(progress: Progress, training: Training, puzzles: PuzzleStore): boolean {
  const s = storage();
  return s ? restoreBoth(s, { progress, training, puzzles }) : false;
}
