import { RANK_BENCHMARKS, estimateRank, recommendedStage } from "../core/curriculum";
import { firstUnpassedDrill, recentSkill } from "../core/level";
import { METRIC_INFO } from "../core/progress";
import type { Progress } from "../core/progress";

export function LevelCard({
  progress,
  onDrill,
}: {
  progress: Progress;
  onDrill: (id: string) => void;
}) {
  const skill = recentSkill(progress);
  const rank = skill ? estimateRank(skill) : null;
  const stage = recommendedStage(progress);
  const next = firstUnpassedDrill(progress, stage);
  const target = rank ? RANK_BENCHMARKS.find((b) => b.rank === rank) : null;
  return (
    <section className="level-card" aria-labelledby="level-title">
      <h2 id="level-title">Your level</h2>
      <div className="level-grid">
        <div>
          <p className="eyebrow">Estimated rank</p>
          {skill && rank ? (
            <>
              <p className="level-rank">{rank}</p>
              <p className="level-detail">
                {METRIC_INFO.pps.format(skill.pps)} PPS and{" "}
                {METRIC_INFO.app.format(skill.app)} APP over your last{" "}
                {skill.runs} {skill.runs === 1 ? "run" : "runs"}
                {target && ` (rank ${rank} averages ${target.pps} PPS, ${target.app} APP)`}.
              </p>
            </>
          ) : (
            <p className="level-detail">Play a few drills to get an estimate.</p>
          )}
        </div>
        <div>
          <p className="eyebrow">Recommended next</p>
          <p className="level-stage">
            {stage.title} <span className="step-note">{stage.rankBand}</span>
          </p>
          <p className="level-detail">{stage.focus}</p>
          <button className="button primary" onClick={() => onDrill(next.id)}>
            Continue: {next.title}
          </button>
        </div>
      </div>
      <p className="level-detail dials">
        Two dials move you up: efficiency (APP) matters most below the median
        rank, and speed (PPS) matters most from SS upward.
      </p>
      <details className="metric-help">
        <summary>What do PPS and APP mean?</summary>
        <p>
          <strong>PPS.</strong> {METRIC_INFO.pps.explain}
        </p>
        <p>
          <strong>APP.</strong> {METRIC_INFO.app.explain}
        </p>
      </details>
    </section>
  );
}
