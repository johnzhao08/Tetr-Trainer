import { paceDelta } from "./stats";

export type PacePoint = {
  /** Pieces locked so far. */
  piece: number;
  /** Drill time in seconds. */
  seconds: number;
  /** Pieces ahead (+) or behind (-) the target pace at that lock. */
  delta: number;
};

/** Pieces ahead or behind a steady pace at each lock, from lock times in ms. */
export function paceSeries(
  lockTimes: readonly number[],
  targetPps: number,
): PacePoint[] {
  return lockTimes.map((ms, i) => ({
    piece: i + 1,
    seconds: ms / 1000,
    delta: paceDelta(i + 1, ms, targetPps),
  }));
}

/** Largest absolute lead or lag, at least `floor`, so the zero line stays centred. */
export function paceExtent(points: readonly PacePoint[], floor = 1): number {
  return points.reduce((m, p) => Math.max(m, Math.abs(p.delta)), floor);
}

/** SVG polyline `points` for a width x height box; zero sits mid-height. */
export function pacePath(
  points: readonly PacePoint[],
  width: number,
  height: number,
): string {
  if (points.length === 0) return "";
  const extent = paceExtent(points);
  const last = points[points.length - 1].piece;
  return points
    .map((p) => {
      const x = last <= 1 ? 0 : ((p.piece - 1) / (last - 1)) * width;
      const y = height / 2 - (p.delta / extent) * (height / 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** One line for screen readers and the caption. */
export function paceSummary(points: readonly PacePoint[]): string {
  const end = points.at(-1);
  if (!end) return "No pieces placed.";
  const lead = Math.abs(end.delta).toFixed(1);
  return `Finished ${lead} pieces ${end.delta >= 0 ? "ahead of" : "behind"} the pace.`;
}
