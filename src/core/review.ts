// Leitner-style spaced review. Pure: callers pass `now` (ms since epoch).
export type ReviewKind = "puzzle" | "vision" | "opener";
export const REVIEW_KINDS: readonly ReviewKind[] = ["puzzle", "vision", "opener"];
export type ReviewItem = {
  /** Puzzle id, vision question seed, or opener first-bag order. */
  id: string;
  kind: ReviewKind;
  /** 0 (just failed or new) to 5 (mastered). */
  box: number;
  dueAt: number;
  lastResult: "correct" | "fail" | null;
  lapses: number;
};
export type ReviewState = { items: ReviewItem[] };

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
export const MAX_BOX = 5;
/** Wait before the next review, indexed by the box the item lands in. */
export const BOX_INTERVALS_MS: readonly number[] = [
  10 * MIN,
  1 * DAY,
  3 * DAY,
  7 * DAY,
  16 * DAY,
  35 * DAY,
];

export function emptyReview(): ReviewState {
  return { items: [] };
}

/** Idempotent by id: an existing item is kept, so re-adding never resets it. */
export function addItem(
  state: ReviewState,
  id: string,
  kind: ReviewKind,
  now: number,
): ReviewState {
  if (state.items.some((i) => i.id === id)) return state;
  const item: ReviewItem = {
    id,
    kind,
    box: 0,
    dueAt: now,
    lastResult: null,
    lapses: 0,
  };
  return { items: [...state.items, item] };
}

export function scheduleResult(
  item: ReviewItem,
  correct: boolean,
  now: number,
): ReviewItem {
  const box = correct ? Math.min(MAX_BOX, item.box + 1) : 0;
  return {
    ...item,
    box,
    dueAt: now + BOX_INTERVALS_MS[box],
    lastResult: correct ? "correct" : "fail",
    lapses: item.lapses + (correct ? 0 : 1),
  };
}

/** Records a result for the item with this id; unknown ids are ignored. */
export function recordResult(
  state: ReviewState,
  id: string,
  correct: boolean,
  now: number,
): ReviewState {
  if (!state.items.some((i) => i.id === id)) return state;
  return {
    items: state.items.map((i) =>
      i.id === id ? scheduleResult(i, correct, now) : i,
    ),
  };
}

/** Items due at `now`, most overdue first (ties by id), at most `limit`. */
export function dueItems(
  state: ReviewState,
  now: number,
  limit = Infinity,
): ReviewItem[] {
  return state.items
    .filter((i) => i.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, Math.max(0, limit));
}
