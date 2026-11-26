import { parseItem } from "../core/openerReview";
import { dueItems } from "../core/review";
import type { Training } from "../core/training";

// Summary of due items; due openers launch from here.
export function ReviewCard({
  training,
  now,
  instantSoftDrop,
  onReviewOpener,
}: {
  training: Training;
  now: number;
  instantSoftDrop: boolean;
  onReviewOpener?: (item: string) => void;
}) {
  const dueAll = dueItems({ items: training.review }, now);
  const due = dueAll.length;
  const dueOpeners = dueAll.filter((i) => i.kind === "opener" && parseItem(i.id, instantSoftDrop));
  const ratings = Object.entries(training.players).sort(
    (a, b) => b[1].rating - a[1].rating || (a[0] < b[0] ? -1 : 1),
  );
  const empty = training.review.length === 0 && ratings.length === 0;
  return (
    <section className="review-card" aria-labelledby="review-title">
      <div className="level-heading">
        <h2 id="review-title">Review queue</h2>
        <p>
          {empty
            ? "Nothing to review yet. Failed puzzles and drills will come back here on a schedule, and your rating per theme will show up as you practise."
            : `${due} ${due === 1 ? "item" : "items"} due for review.`}
        </p>
      </div>
      {dueOpeners.length > 0 && onReviewOpener && (
        <button className="button primary" onClick={() => onReviewOpener(dueOpeners[0].id)}>
          Review openers ({dueOpeners.length} due)
        </button>
      )}
      {ratings.length > 0 && (
        <ul className="rating-list" aria-label="Rating per theme">
          {ratings.map(([theme, g]) => (
            <li key={theme}>
              <span>{theme}</span>
              <strong>{Math.round(g.rating)}</strong>
              <span className="rating-rd">&plusmn; {Math.round(g.rd)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
