import { useEffect, useRef } from "react";
import type { Stage } from "../core/curriculum";
import type { Board } from "../core/board";
import type { Outcome } from "../core/drillRun";
import type { DrillSession } from "../core/drillSession";
import {
  BAND_TEXT,
  BANDS,
  bandCounts,
  boardRows,
  END_TEXT,
  flagText,
} from "../core/drillView";
import { METRIC_INFO } from "../core/progress";
import { GateBars } from "./GateBars";
import { MetricGrid } from "./MetricGrid";
import { MiniBoard } from "./MiniBoard";

export function DrillResults({
  session,
  stage,
  outcome,
  before,
  onRetry,
  onRetryFrom,
  onHome,
}: {
  session: DrillSession;
  stage: Stage;
  outcome: Outcome;
  /** Board before each placement, by placement index. */
  before: readonly Board[];
  onRetry: () => void;
  onRetryFrom: (index: number) => void;
  onHome: () => void;
}) {
  const { def } = session;
  const heading = useRef<HTMLHeadingElement>(null);
  // Move focus off the unmounted board so keyboard users land on the result.
  useEffect(() => heading.current?.focus(), []);
  const metrics = session.metrics();
  const primary = METRIC_INFO[def.primary];
  const value = metrics[def.primary];
  const done = session.status === "complete";
  const counts = bandCounts(session.reviews);
  const moments = session.keyMoments(5);
  return (
    <main className="drill-results">
      <section className="results-head" aria-labelledby="results-title">
        <p className="eyebrow">{def.title}</p>
        <h2 id="results-title" ref={heading} tabIndex={-1}>{done ? "Drill complete" : "Drill failed"}</h2>
        <p>{session.endReason ? END_TEXT[session.endReason] : ""}</p>
        <div className="headline">
          <span className="section-label">{primary.label.toUpperCase()}</span>
          <strong>{value === undefined ? "–" : primary.format(value)}</strong>
          {outcome.newBest && <span className="new-best">New best</span>}
          <span className="step-note">
            Best before:{" "}
            {outcome.priorBest === null ? "none" : primary.format(outcome.priorBest)}
          </span>
        </div>
        {outcome.assisted && (
          <p className="step-note" role="note">
            You used undo or retry from here, so this run is not counted toward gates.
          </p>
        )}
        {!outcome.saved && (
          <p className="step-note" role="note">
            Browser storage is unavailable, so progress was not saved.
          </p>
        )}
        <div className="board-actions results-actions">
          <button className="button primary" onClick={onRetry}>
            Retry drill
          </button>
          <button className="button" onClick={onHome}>
            Home
          </button>
        </div>
      </section>
      <section aria-labelledby="metrics-title">
        <h3 id="metrics-title">Metrics</h3>
        <MetricGrid
          className="metric-grid"
          items={def.metrics.map((id) => ({
            id,
            label: METRIC_INFO[id].label,
            value:
              metrics[id] === undefined ? "–" : METRIC_INFO[id].format(metrics[id]),
          }))}
        />
        <h3>Placement quality</h3>
        <ul className="band-list" aria-label="Placement quality">
          {BANDS.map((band) => (
            <li key={band} className={`band-${band}`}>
              <strong>{counts[band]}</strong> {BAND_TEXT[band]}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="gates-result-title">
        <h3 id="gates-result-title">Gates for {stage.title}</h3>
        <GateBars stage={stage} progress={outcome.progress} />
      </section>
      <section className="key-moments" aria-labelledby="moments-title">
        <h3 id="moments-title">Key moments</h3>
        {moments.length === 0 && <p>No placements worth flagging. Clean run.</p>}
        <ul>
          {moments.map((m) => {
            const board = before[m.index];
            return (
              <li key={m.index} className="moment">
                {board && (
                  <MiniBoard
                    rows={boardRows(board, session.game.log[m.index]?.landing)}
                    label={`Board before piece ${m.index + 1}`}
                  />
                )}
                <div>
                  <span className={`coach-chip band-${m.band}`}>
                    <strong>{BAND_TEXT[m.band]}</strong>
                    <span>Piece {m.index + 1}</span>
                  </span>
                  <p>
                    {m.label ||
                      m.flags.map(flagText).join(", ") ||
                      "Placement could be better."}
                  </p>
                  <button className="button" onClick={() => onRetryFrom(m.index)}>
                    Retry from here
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
