import type { DrillSession } from "../core/drillSession";
import { BAND_TEXT, flagText, paceText, remaining } from "../core/drillView";
import type { GameState } from "../core/game";
import { pendingLines } from "../core/incoming";
import { METRIC_INFO } from "../core/progress";
import { competitiveMetrics } from "../core/stats";

/** B2B at which the next attack gets the Surge bonus. */
export const SURGE_AT = 4;

// Rendered from the session on every refresh; `state` only triggers it.
export function DrillHud({
  session,
  state,
}: {
  session: DrillSession;
  state: GameState;
}) {
  const { def } = session;
  const elapsedMs = session.elapsedMs;
  const live = competitiveMetrics(state.stats, state.pieces, elapsedMs);
  const left = remaining(def, {
    pieces: state.pieces,
    lines: state.lines,
    garbageCleared: state.stats.garbageCleared,
    elapsedMs,
  });
  const pace = session.pace;
  const surge = state.b2b >= SURGE_AT;
  const stats: [string, string][] = [
    ["PPS", METRIC_INFO.pps.format(live.pps)],
    ["APP", METRIC_INFO.app.format(live.app)],
    ["Finesse", METRIC_INFO.finesse.format(live.finesse)],
    ["Combo", String(Math.max(0, state.combo))],
    ["B2B", String(Math.max(0, state.b2b))],
  ];
  return (
    <aside className="drill-hud" aria-label="Drill status">
      <div className="hud-objective">
        {left.map((item) => (
          <div key={item.label}>
            <span className="section-label">{item.label.toUpperCase()}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <dl className="hud-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={surge ? "surge charged" : "surge"} aria-live="polite">
        {surge ? "Surge charged" : `Surge at B2B ${SURGE_AT}`}
      </p>
      {pace !== null && (
        <p className={pace >= 0 ? "pace ahead" : "pace behind"}>
          Pace: {paceText(pace)}
        </p>
      )}
      {session.violations.length > 0 && (
        <p className="violations" role="status">
          Violations: {session.violations.length}
          {def.failOn?.violations !== undefined && ` / ${def.failOn.violations}`}
        </p>
      )}
      <CoachChip session={session} index={state.pieces - 1} />
    </aside>
  );
}

// Small non-blocking feedback for the latest placement.
function CoachChip({ session, index }: { session: DrillSession; index: number }) {
  const review = session.reviews[index];
  return (
    <div className="coach-slot" role="status" aria-live="polite">
      {review && (
        <span key={index} className={`coach-chip band-${review.band}`}>
          <strong>{BAND_TEXT[review.band]}</strong>
          {review.flags.length > 0 && (
            <span>{review.flags.map(flagText).join(", ")}</span>
          )}
        </span>
      )}
    </div>
  );
}

/** Vertical bar of garbage waiting to land, beside the board. */
export function IncomingMeter({ state }: { state: GameState }) {
  const lines = pendingLines(state.incoming);
  return (
    <div
      className="incoming-meter"
      role="meter"
      aria-label="Incoming garbage lines"
      aria-valuemin={0}
      aria-valuemax={20}
      aria-valuenow={Math.min(20, lines)}
      title={`${lines} garbage lines incoming`}
    >
      <span style={{ height: `${Math.min(20, lines) * 5}%` }} />
    </div>
  );
}
