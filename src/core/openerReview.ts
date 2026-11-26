import { DEFAULT_VOL, newGlicko, PUZZLE_RD_CAP, updateBoth } from "./glicko";
import { openerById, openerFor, supportedSet } from "./openers";
import { addItem, recordResult } from "./review";
import type { ReviewItem } from "./review";
import { MAX_REVIEW, normalizeTraining } from "./training";
import type { Training } from "./training";

// Review scheduling for opener first bags.

export type OpenerItem = { opener: string; bag: string; mirror: boolean };

export const itemId = (i: OpenerItem) =>
  `opener:${i.opener}:${i.bag}:${i.mirror ? "m" : "n"}`;

/** Null unless the id names a real opener, a supported bag, and a verified mirror. */
export function parseItem(id: string, instant: boolean): OpenerItem | null {
  const m = /^opener:([a-z-]+):([IJLOSTZ]{7}):([mn])$/.exec(id);
  const def = m && openerById(m[1]);
  if (!m || !def) return null;
  const mirror = m[3] === "m";
  if (mirror && !def.mirror) return null;
  if (!supportedSet(openerFor(def, mirror), instant).has(m[2])) return null;
  return { opener: def.id, bag: m[2], mirror };
}

/**
 * At capacity, drops the item that is due furthest away (then the highest box,
 * then the oldest) so the new item is never the one that is truncated.
 */
function withRoom(items: ReviewItem[], id: string): ReviewItem[] {
  if (items.length < MAX_REVIEW || items.some((i) => i.id === id)) return items;
  let out = 0;
  items.forEach((it, n) => {
    const w = items[out];
    if (it.dueAt > w.dueAt || (it.dueAt === w.dueAt && it.box > w.box)) out = n;
  });
  return items.filter((_, n) => n !== out);
}

/** Adds the item if new, schedules the result, and rates the player's theme. */
export function recordOpener(
  t: Training,
  item: OpenerItem,
  success: boolean,
  now: number,
): Training {
  const def = openerById(item.opener);
  if (!def) return t;
  const id = itemId(item);
  const review = recordResult(
    addItem({ items: withRoom(t.review, id) }, id, "opener", now),
    id,
    success,
    now,
  );
  const player = updateBoth(
    t.players[def.theme] ?? newGlicko(),
    { rating: def.difficulty, rd: PUZZLE_RD_CAP, vol: DEFAULT_VOL },
    success ? 1 : 0,
  ).player;
  return normalizeTraining({
    ...t,
    review: review.items,
    players: { ...t.players, [def.theme]: player },
  });
}
