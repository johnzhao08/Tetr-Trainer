import { competitiveMetrics } from "../core/stats";
import type { SessionStats } from "../core/stats";

export function StatsPanel({
  stats,
  pieces,
  elapsedMs,
}: {
  stats: SessionStats;
  pieces: number;
  elapsedMs: number;
}) {
  const m = competitiveMetrics(stats, pieces, elapsedMs);
  const items: { label: string; value: string; title: string }[] = [
    {
      label: "APM",
      value: m.apm.toFixed(1),
      title: "Attack per minute: garbage lines your clears would send.",
    },
    {
      label: "PPS",
      value: m.pps.toFixed(2),
      title: "Pieces placed per second.",
    },
    {
      label: "VS",
      value: m.vs.toFixed(1),
      title:
        "VS score: attack per second × 100. Freeplay has no incoming garbage, so it tracks APM.",
    },
    {
      label: "APP",
      value: m.app.toFixed(2),
      title: "Attack per piece: how efficiently each piece turns into damage.",
    },
    {
      label: "KPP",
      value: m.kpp.toFixed(2),
      title: "Key presses per piece, including hard drop and hold.",
    },
    {
      label: "Attack",
      value: String(m.attack),
      title:
        "Total attack, using the TETR.IO multiplier table: B2B chaining, combo bonus and all clears.",
    },
    {
      label: "Finesse",
      value: `${m.finesse.toFixed(1)}%`,
      title: "Share of pieces placed with the fewest possible key presses.",
    },
    {
      label: "Faults",
      value: String(m.faults),
      title: "Extra key presses beyond the fewest needed, over all pieces.",
    },
  ];
  return (
    <section className="stats-card" aria-labelledby="stats-title">
      <div className="section-label" id="stats-title">
        STATS
      </div>
      <dl className="stats-grid">
        {items.map(({ label, value, title }) => (
          <div key={label} title={title}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
