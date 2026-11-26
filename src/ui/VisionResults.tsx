import { useEffect, useRef } from "react";
import { METRIC_INFO } from "../core/progress";
import type { SessionRecord } from "../core/progress";

export function VisionResults({
  title,
  record,
  priorBest,
  saved,
  exhausted = false,
  onAgain,
  onMenu,
}: {
  title: string;
  record: SessionRecord;
  priorBest: number | null;
  saved: boolean;
  /** The run ran out of fresh questions and ended early. */
  exhausted?: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const m = record.metrics;
  const score = m.score ?? 0;
  return (
    <main className="drill-results">
      <p className="eyebrow">{title}</p>
      <h2 ref={heading} tabIndex={-1}>
        {exhausted ? "Ended early" : "Run complete"}
      </h2>
      {exhausted && (
        <p className="step-note">
          No new questions were left, so this set stopped early and is not
          counted toward gates.
        </p>
      )}
      <div className="headline">
        <span className="section-label">SCORE</span>
        <strong>{score}</strong>
        {record.completed && (priorBest === null || score > priorBest) && score > 0 && (
          <span className="new-best">New best</span>
        )}
        <span className="step-note">
          Best before: {priorBest === null ? "none" : priorBest}
        </span>
      </div>
      <dl className="drill-stats">
        {(["accuracy", "recognitionMs", "timeMs"] as const).map((id) => (
          <div key={id}>
            <dt>{METRIC_INFO[id].label}</dt>
            <dd>{m[id] === undefined ? "–" : METRIC_INFO[id].format(m[id])}</dd>
          </div>
        ))}
      </dl>
      {!saved && (
        <p className="step-note">Browser storage is unavailable; not saved.</p>
      )}
      <div className="board-actions">
        <button className="button primary" onClick={onAgain}>Play again</button>
        <button className="button" onClick={onMenu}>Modes</button>
      </div>
    </main>
  );
}
