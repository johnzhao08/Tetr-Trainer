import { MAX_RATING, MAX_VOL, MIN_RATING, DEFAULT_RD } from "./glicko";
import type { Glicko } from "./glicko";
import { MAX_BOX, REVIEW_KINDS } from "./review";
import type { ReviewItem } from "./review";

// Rating and spaced-review state, stored apart from drill progress.
export type Training = {
  version: 1;
  /** Player rating per theme. */
  players: Record<string, Glicko>;
  /** Puzzle ratings by puzzle id. */
  puzzles: Record<string, Glicko>;
  review: ReviewItem[];
};

export const TRAINING_KEY = "tetr-trainer.training.v1";
export const MAX_THEMES = 64;
export const MAX_PUZZLES = 2000;
export const MAX_REVIEW = 1000;
export const MAX_ID_LENGTH = 120;

export function emptyTraining(): Training {
  return { version: 1, players: {}, puzzles: {}, review: [] };
}

export function isTrainingEmpty(t: Training): boolean {
  return (
    t.review.length === 0 &&
    Object.keys(t.players).length === 0 &&
    Object.keys(t.puzzles).length === 0
  );
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const goodKey = (k: string) =>
  k !== "" && k !== "__proto__" && k.length <= MAX_ID_LENGTH;

function parseGlicko(value: unknown): Glicko | null {
  if (!isRecord(value)) return null;
  const { rating, rd, vol } = value;
  if (!isNum(rating) || rating < MIN_RATING || rating > MAX_RATING) return null;
  if (!isNum(rd) || rd <= 0 || rd > DEFAULT_RD) return null;
  if (!isNum(vol) || vol <= 0 || vol > MAX_VOL) return null;
  return { rating, rd, vol };
}

// Keeps the first `cap` valid entries in stored order.
function parseRatings(value: unknown, cap: number): Record<string, Glicko> {
  const out: Record<string, Glicko> = {};
  if (!isRecord(value)) return out;
  let count = 0;
  for (const [key, raw] of Object.entries(value)) {
    if (count >= cap) break;
    const rating = goodKey(key) ? parseGlicko(raw) : null;
    if (!rating) continue;
    out[key] = rating;
    count++;
  }
  return out;
}

function parseReviewItem(value: unknown): ReviewItem | null {
  if (!isRecord(value)) return null;
  const { id, kind, box, dueAt, lastResult, lapses } = value;
  if (typeof id !== "string" || !goodKey(id)) return null;
  if (!REVIEW_KINDS.includes(kind as ReviewItem["kind"])) return null;
  if (!Number.isInteger(box) || (box as number) < 0 || (box as number) > MAX_BOX)
    return null;
  if (!isNum(dueAt) || dueAt < 0) return null;
  if (lastResult !== null && lastResult !== "correct" && lastResult !== "fail")
    return null;
  if (!Number.isInteger(lapses) || (lapses as number) < 0) return null;
  return {
    id,
    kind: kind as ReviewItem["kind"],
    box: box as number,
    dueAt,
    lastResult,
    lapses: lapses as number,
  };
}

function parseTraining(value: unknown): Training | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const ids = new Set<string>();
  const review: ReviewItem[] = [];
  if (Array.isArray(value.review)) {
    for (const raw of value.review) {
      const item = parseReviewItem(raw);
      if (!item || ids.has(item.id)) continue;
      ids.add(item.id);
      review.push(item);
      if (review.length >= MAX_REVIEW) break;
    }
  }
  return {
    version: 1,
    players: parseRatings(value.players, MAX_THEMES),
    puzzles: parseRatings(value.puzzles, MAX_PUZZLES),
    review,
  };
}

/** Re-validates and caps, so callers can hand in any in-memory training. */
export function normalizeTraining(t: Training): Training {
  return parseTraining(t) ?? emptyTraining();
}

export function loadTraining(storage: Pick<Storage, "getItem">): Training {
  try {
    const raw = storage.getItem(TRAINING_KEY);
    if (raw === null) return emptyTraining();
    return parseTraining(JSON.parse(raw)) ?? emptyTraining();
  } catch {
    return emptyTraining();
  }
}

export function saveTraining(
  storage: Pick<Storage, "setItem">,
  t: Training,
): boolean {
  try {
    storage.setItem(TRAINING_KEY, JSON.stringify(normalizeTraining(t)));
    return true;
  } catch {
    return false;
  }
}

export function exportTraining(t: Training): string {
  return JSON.stringify(t, null, 2);
}

/** Null when the text is not training data. */
export function importTraining(text: string): Training | null {
  try {
    return parseTraining(JSON.parse(text));
  } catch {
    return null;
  }
}
