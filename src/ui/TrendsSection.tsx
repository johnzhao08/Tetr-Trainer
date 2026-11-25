import { METRIC_INFO } from "../core/progress";
import type { Progress } from "../core/progress";
import { trendSeries, weekPositions } from "../core/trends";
import type { WeekPoint } from "../core/trends";

const W = 280;
const H = 90;
const PAD = 8;

// Inline SVG line chart. The data is repeated as text in the table beneath.
function LineChart({
  points,
  pick,
  label,
  format,
}: {
  points: readonly WeekPoint[];
  pick: (p: WeekPoint) => number;
  label: string;
  format: (n: number) => string;
}) {
  const values = points.map(pick);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const xs = weekPositions(points, W, PAD);
  const x = (i: number) => xs[i];
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - 2 * PAD);
  const first = points[0];
  const last = points[points.length - 1];
  const summary =
    points.length === 1
      ? `${label}: ${format(values[0])} in week ${first.week}.`
      : `${label} by week, ${first.week} to ${last.week}: from ${format(values[0])} to ${format(values[values.length - 1])}, low ${format(lo)}, high ${format(hi)}.`;
  return (
    <figure className="trend-chart">
      <figcaption>
        {label} <span>{format(values[values.length - 1])} latest</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
        />
        {values.map((v, i) => (
          <circle key={points[i].week} cx={x(i)} cy={y(v)} r="3" fill="var(--accent)" />
        ))}
      </svg>
    </figure>
  );
}

function Trend({ title, points }: { title: string; points: readonly WeekPoint[] }) {
  return (
    <div className="trend-group">
      <h3>{title}</h3>
      {points.length === 0 ? (
        <p className="level-detail">No data yet.</p>
      ) : (
        <>
          <div className="trend-charts">
            <LineChart points={points} pick={(p) => p.app} label="APP" format={METRIC_INFO.app.format} />
            <LineChart points={points} pick={(p) => p.pps} label="PPS" format={METRIC_INFO.pps.format} />
          </div>
          <details className="trend-table">
            <summary>Weekly numbers</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">Week</th>
                  <th scope="col">Games</th>
                  <th scope="col">APP</th>
                  <th scope="col">PPS</th>
                  <th scope="col">Est. rank</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.week}>
                    <th scope="row">{p.week}</th>
                    <td>{p.count}</td>
                    <td>{METRIC_INFO.app.format(p.app)}</td>
                    <td>{METRIC_INFO.pps.format(p.pps)}</td>
                    <td>{p.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}

export function TrendsSection({ progress }: { progress: Progress }) {
  const { freeplay, drills } = trendSeries(progress);
  return (
    <section className="level-section" aria-labelledby="trends-title">
      <div className="level-heading">
        <h2 id="trends-title">Your trends</h2>
        <p>
          Weekly averages. Check whether improving a drill moves your freeplay
          APP and PPS. Turn on saving in freeplay to fill the first chart.
        </p>
      </div>
      <div className="trend-grid">
        <Trend title="Freeplay" points={freeplay} />
        <Trend title="Drills" points={drills} />
      </div>
    </section>
  );
}
