import { emptyProgress, loadProgress, saveProgress } from "../core/progress";
import type { Progress } from "../core/progress";
import { reconcileHarvest } from "../core/harvest";
import type { PuzzleDef } from "../core/puzzle";

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
