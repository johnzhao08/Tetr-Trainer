import type { PlacementReview } from "../core/coach";
import type { DrillSession } from "../core/drillSession";
import { BAND_TEXT, flagText, paceText, remaining } from "../core/drillView";
import type { GameState } from "../core/game";
import { pendingLines } from "../core/incoming";
import { METRIC_INFO } from "../core/progress";
import { competitiveMetrics } from "../core/stats";
import { TOP_OUT_HEIGHT } from "../core/opponent";
import {
  B2B_WARNING_GAP,
  b2bGap,
  b2bWarning,
  spikeWindow,
} from "../core/versus";

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
      <VersusInfo state={state} />
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
      <CoachChip review={session.reviews[state.pieces - 1]} index={state.pieces - 1} />
    </aside>
  );
}

/** Opponent height, B2B gap and spike window; nothing without an opponent. */
export function VersusInfo({ state }: { state: GameState }) {
  const opp = state.opponent;
  if (!opp) return null;
  const gap = b2bGap(state.b2b, opp);
  const fill = Math.min(TOP_OUT_HEIGHT, opp.height);
  return (
    <div className="versus-info" aria-label="Opponent status">
      <div
        className="opp-height"
        role="meter"
        aria-label="Opponent height"
        aria-valuemin={0}
        aria-valuemax={TOP_OUT_HEIGHT}
        aria-valuenow={fill}
      >
        <span style={{ width: `${(fill / TOP_OUT_HEIGHT) * 100}%` }} />
      </div>
      <p className="versus-line">
        {opp.alive ? `Opponent height ${opp.height}` : "Opponent topped out"} ·
        B2B {Math.max(0, opp.b2b)} (gap {gap >= 0 ? "+" : ""}
        {gap})
      </p>
      <p className="versus-flags" role="status" aria-live="polite">
        {b2bWarning(state.b2b, opp) && (
          <span className="versus-warning">
            {B2B_WARNING_GAP}+ B2B behind: a Surge is coming
          </span>
        )}
        {spikeWindow(opp) && (
          <span className="versus-spike">Spike window: send now</span>
        )}
      </p>
    </div>
  );
}

// Small non-blocking feedback for the latest placement.
export function CoachChip({
  review,
  index,
}: {
  review: PlacementReview | undefined;
  index: number;
}) {
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
