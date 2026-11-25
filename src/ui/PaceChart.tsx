import { pacePath, paceSeries, paceSummary } from "../core/paceChart";

const W = 320;
const H = 90;

/** Pieces ahead (up) or behind (down) the target pace over the run. */
export function PaceChart({
  lockTimes,
  targetPps,
}: {
  lockTimes: readonly number[];
  targetPps: number;
}) {
  const points = paceSeries(lockTimes, targetPps);
  if (points.length < 2) return null;
  const summary = paceSummary(points);
  return (
    <figure className="pace-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Pace against ${targetPps.toFixed(1)} PPS. ${summary}`}
        preserveAspectRatio="none"
      >
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="pace-zero" />
        <polyline points={pacePath(points, W, H)} className="pace-line" />
      </svg>
      <figcaption>
        Above the dashed line is ahead of {targetPps.toFixed(1)} PPS. {summary}
      </figcaption>
    </figure>
  );
}
