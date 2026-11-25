import type { PlacementReview } from "../core/coach";
import type { GameState } from "../core/game";
import { METRIC_INFO } from "../core/progress";
import { competitiveMetrics } from "../core/stats";
import { CoachChip, SURGE_AT } from "./DrillHud";

/** Opponent and gravity settings freeplay can run under. */
export type Pressure = "off" | "league" | "opponent";

export const PRESSURE_LABELS: Record<Pressure, string> = {
  off: "Off",
  league: "League gravity",
  opponent: "Gravity + 30 APM opponent",
};

// Live competitive numbers for the current freeplay game. Never saved.
export function FreeplayStats({
  state,
  elapsedMs,
  review,
}: {
  state: GameState & { elapsedMs: number };
  elapsedMs: number;
  review: PlacementReview | undefined;
}) {
  const live = competitiveMetrics(state.stats, state.pieces, elapsedMs);
  const surge = state.b2b >= SURGE_AT;
  const rows: [string, string][] = [
    ["PPS", METRIC_INFO.pps.format(live.pps)],
    ["APP", METRIC_INFO.app.format(live.app)],
    ["APM", METRIC_INFO.apm.format(live.apm)],
    ["VS", live.vs.toFixed(1)],
    ["Finesse", METRIC_INFO.finesse.format(live.finesse)],
    ["KPP", METRIC_INFO.kpp.format(live.kpp)],
    ["B2B", String(Math.max(0, state.b2b))],
    ["Attack", String(state.stats.attack)],
  ];
  return (
    <section className="freeplay-stats" aria-label="Competitive stats">
      <dl className="hud-stats">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={surge ? "surge charged" : "surge"} aria-live="polite">
        {surge ? "Surge charged" : `Surge at B2B ${SURGE_AT}`}
      </p>
      <CoachChip review={review} index={state.pieces - 1} />
    </section>
  );
}
