import { dueItems } from "../core/review";
import type { Training } from "../core/training";

// Read-only summary: later phases hook puzzle, vision and opener screens to it.
export function ReviewCard({
  training,
  now,
}: {
  training: Training;
  now: number;
}) {
  const due = dueItems({ items: training.review }, now).length;
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
