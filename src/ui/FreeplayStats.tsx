import type { PlacementReview } from "../core/coach";
import type { GameState } from "../core/game";
import { METRIC_INFO } from "../core/progress";
import { termLabel } from "../core/glossary";
import type { GlossaryId } from "../core/glossary";
import { competitiveMetrics } from "../core/stats";
import { CoachChip, SURGE_AT } from "./DrillHud";
import { MetricGrid } from "./MetricGrid";
import type { MetricItem } from "./MetricGrid";

/** Opponent and gravity settings freeplay can run under. */
export type Pressure = "off" | "league" | "opponent" | "slow";

export const PRESSURE_LABELS: Record<Pressure, string> = {
  off: "Off",
  league: "League gravity",
  opponent: "Gravity + 30 APM opponent",
  slow: "Slow room 1.5 PPS",
};

// Live competitive numbers for the current freeplay game. Never saved.
export function FreeplayStats({
  state,
  elapsedMs,
  review,
  onToggle,
}: {
  state: GameState & { elapsedMs: number };
  elapsedMs: number;
  review: PlacementReview | undefined;
  /** Called after an explanation opens or closes. */
  onToggle?: () => void;
}) {
  const live = competitiveMetrics(state.stats, state.pieces, elapsedMs);
  const surge = state.b2b >= SURGE_AT;
  const row = (id: GlossaryId, value: string): MetricItem => ({
    id,
    label: termLabel(id),
    value,
  });
  const rows = [
    row("pps", METRIC_INFO.pps.format(live.pps)),
    row("app", METRIC_INFO.app.format(live.app)),
    row("apm", METRIC_INFO.apm.format(live.apm)),
    row("vs", live.vs.toFixed(1)),
    row("finesse", METRIC_INFO.finesse.format(live.finesse)),
    row("kpp", METRIC_INFO.kpp.format(live.kpp)),
    row("b2b", String(Math.max(0, state.b2b))),
    row("attack", String(state.stats.attack)),
  ];
  return (
    <section className="freeplay-stats" aria-label="Competitive stats">
      <MetricGrid items={rows} onToggle={onToggle} />
      <p className={surge ? "surge charged" : "surge"} aria-live="polite">
        {surge ? "Surge charged" : `Surge at B2B ${SURGE_AT}`}
      </p>
      <CoachChip review={review} index={state.pieces - 1} />
    </section>
  );
}
