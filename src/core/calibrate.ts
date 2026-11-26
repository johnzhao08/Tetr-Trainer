import type { BotConfig } from "./bot";
import type { DrillDef } from "./drill";
import { estimateRank, RANK_BENCHMARKS } from "./curriculum";
import { FREEPLAY_ID, recentAverage } from "./progress";
import type { Progress } from "./progress";

/** Freeplay games averaged to measure the player. */
export const CALIBRATION_GAMES = 10;
/** Used when there is no saved freeplay game yet. */
export const DEFAULT_PPS = 1;
/** The bot plays a touch faster than the player, so it stays just within reach. */
export const PPS_MARGIN = 1.05;
const MIN_PPS = 0.5;
const MAX_PPS = 4;
const MIN_SKILL = 0.1;

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/**
 * Where a bot should sit for this player. PPS is the recent freeplay average
 * (1.0 without saves) times PPS_MARGIN. Skill places the recent APP between
 * the rank benchmarks (the nearest rank from `estimateRank`, shifted by how
 * far APP sits toward its neighbour) on a 0 to 1 scale, plus half a rank so
 * the bot is slightly better than the player. Without APP it plays like the
 * lowest rank.
 */
export function calibrateBot(progress: Progress, seed = 1): BotConfig {
  const pps =
    recentAverage(progress, FREEPLAY_ID, "pps", CALIBRATION_GAMES) ??
    DEFAULT_PPS;
  const app = recentAverage(progress, FREEPLAY_ID, "app", CALIBRATION_GAMES);
  let skill = MIN_SKILL;
  if (app !== null && app > 0 && pps > 0) {
    const top = RANK_BENCHMARKS.length - 1;
    const rank = estimateRank({ pps, app });
    const i = RANK_BENCHMARKS.findIndex((b) => b.rank === rank);
    const row = RANK_BENCHMARKS[i];
    const up = app >= row.app;
    const other = RANK_BENCHMARKS[clamp(i + (up ? 1 : -1), 0, top)];
    const shift =
      other === row
        ? 0
        : clamp((app - row.app) / (other.app - row.app), 0, 1) * (up ? 0.5 : -0.5);
    skill = clamp((i + shift + 0.5) / top, MIN_SKILL, 1);
  }
  return {
    seed,
    pps: clamp(pps * PPS_MARGIN, MIN_PPS, MAX_PPS),
    skill,
  };
}

/** The drill with its bot calibrated to the player; other drills pass through. */
export const calibrateDrill = (def: DrillDef, progress: Progress): DrillDef =>
  def.calibrated
    ? { ...def, options: { ...def.options, bot: calibrateBot(progress) } }
    : def;
