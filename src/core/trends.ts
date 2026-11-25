import { estimateRank } from "./curriculum";
import type { Rank } from "./curriculum";
import { competitiveMetrics } from "./stats";
import type { SessionStats } from "./stats";
import { FREEPLAY_ID } from "./progress";
import type { Progress, SessionRecord } from "./progress";

export { FREEPLAY_ID };
/** Freeplay games shorter than this are never saved. */
export const MIN_FREEPLAY_PIECES = 40;

const DAY = 86_400_000;

export type WeekPoint = {
  /** ISO week label such as 2026-W48. */
  week: string;
  /** Start of the ISO week (Monday 00:00 UTC) in ms. */
  start: number;
  pps: number;
  app: number;
  /** Sessions averaged. */
  count: number;
  rank: Rank;
};

/** ISO 8601 week (UTC) containing `ms`. */
export function isoWeek(ms: number): { week: string; start: number } {
  const d = new Date(ms);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const start = day - ((d.getUTCDay() + 6) % 7) * DAY;
  const thursday = start + 3 * DAY;
  const year = new Date(thursday).getUTCFullYear();
  const number = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY / 7) + 1;
  return { week: `${year}-W${String(number).padStart(2, "0")}`, start };
}

/** Weekly mean PPS and APP of the sessions that recorded both, oldest week first. */
export function weeklyTrend(sessions: readonly SessionRecord[]): WeekPoint[] {
  const weeks = new Map<string, { start: number; pps: number[]; app: number[] }>();
  for (const s of sessions) {
    const { pps, app } = s.metrics;
    if (pps === undefined || app === undefined || !(pps > 0)) continue;
    const { week, start } = isoWeek(s.endedAt);
    const entry = weeks.get(week) ?? { start, pps: [], app: [] };
    entry.pps.push(pps);
    entry.app.push(app);
    weeks.set(week, entry);
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return [...weeks]
    .map(([week, e]) => ({
      week,
      start: e.start,
      pps: mean(e.pps),
      app: mean(e.app),
      count: e.pps.length,
      rank: estimateRank({ pps: mean(e.pps), app: mean(e.app) }),
    }))
    .sort((a, b) => a.start - b.start);
}

/** Weekly trends for saved freeplay games and for every drill together. */
export function trendSeries(progress: Progress): {
  freeplay: WeekPoint[];
  drills: WeekPoint[];
} {
  const isFree = (s: SessionRecord) => s.drillId === FREEPLAY_ID;
  return {
    freeplay: weeklyTrend(progress.sessions.filter(isFree)),
    drills: weeklyTrend(progress.sessions.filter((s) => !isFree(s))),
  };
}

/** A freeplay game as a saved session, or null under MIN_FREEPLAY_PIECES. */
export function freeplayRecord(
  game: { seed: number; stats: SessionStats; pieces: number; elapsedMs: number },
  endedAt: number,
): SessionRecord | null {
  if (game.pieces < MIN_FREEPLAY_PIECES || !(game.elapsedMs > 0)) return null;
  const c = competitiveMetrics(game.stats, game.pieces, game.elapsedMs);
  return {
    // One id per game, so saving again later replaces the earlier record.
    id: `freeplay-${game.seed}`,
    drillId: FREEPLAY_ID,
    endedAt,
    durationMs: Math.round(game.elapsedMs),
    completed: true,
    metrics: {
      pps: c.pps,
      app: c.app,
      apm: c.apm,
      finesse: c.finesse,
      pieces: game.pieces,
      timeMs: Math.round(game.elapsedMs),
    },
  };
}

/** When a game last changed: its seed, piece count and the time of that change. */
export type Activity = { seed: number; pieces: number; at: number };

/**
 * The game's last gameplay activity. It moves to `now` only when the seed or
 * piece count differs from `prev`, so reopening an unchanged game keeps its
 * time (and its ISO week) instead of jumping to the reopen time.
 */
export function trackActivity(
  prev: Activity | undefined,
  seed: number,
  pieces: number,
  now: number,
): Activity {
  return prev && prev.seed === seed && prev.pieces === pieces
    ? prev
    : { seed, pieces, at: now };
}

/**
 * Horizontal positions for weekly points, proportional to each week's start
 * so a skipped week leaves a visible gap. One point sits in the middle.
 */
export function weekPositions(
  points: readonly { start: number }[],
  width: number,
  pad: number,
): number[] {
  if (points.length === 0) return [];
  const first = points[0].start;
  const span = points[points.length - 1].start - first;
  if (span <= 0) return points.map(() => width / 2);
  return points.map((p) => pad + ((p.start - first) * (width - 2 * pad)) / span);
}
