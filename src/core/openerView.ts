import type { OpenerRun } from "./openerRun";
import { parseItem } from "./openerReview";
import type { OpenerItem } from "./openerReview";
import type { OpenerDef } from "./openers";
import { dueItems } from "./review";
import type { ReviewItem } from "./review";

// Pure pieces of the opener screen, kept here so they can be tested.

/** The most overdue due bag for this opener and side, or null. */
export function nextDueBag(
  reviews: ReviewItem[],
  now: number,
  opener: string,
  mirror: boolean,
  instant: boolean,
): OpenerItem | null {
  for (const r of dueItems({ items: reviews }, now)) {
    const item = parseItem(r.id, instant);
    if (item && item.opener === opener && item.mirror === mirror) return item;
  }
  return null;
}

/** How many bags the picker advertises: counts only for enumerated openers. */
export function bagSummary(def: OpenerDef, supported: number): string {
  return def.solve
    ? `${supported} supported first-bag orders build this opener with hold.`
    : `One canonical practice order: ${def.canonical[0]}.`;
}

/** The build result once known (spin landed or build failed), else null. */
export function buildOutcome(run: OpenerRun): boolean | null {
  return run.built ? true : run.stage === "failed" ? false : null;
}
