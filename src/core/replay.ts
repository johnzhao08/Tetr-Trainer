// Rebuilds a saved drill run by driving a fresh DrillSession with the same
// seed and locking each piece at its recorded pose.
import type { Board, Tetromino } from "./board";
import type { DrillReview } from "./dig";
import type { DrillDef } from "./drill";
import { findDrill } from "./drillLookup";
import { DrillSession } from "./drillSession";
import type { Placement } from "./game";
import type { SessionRecord } from "./progress";
import { moveHeld, moveSpin, replayable } from "./replayFormat";
import { defaultSettings } from "./settings";

/** What the player saw just before one placement. */
export type ReplayStep = {
  /** Board before the placement. */
  board: Board;
  /** The piece in play (before any hold), the hold slot and the next pieces. */
  current: Tetromino;
  hold: Tetromino | null;
  next: Tetromino[];
  b2b: number;
  combo: number;
  placement: Placement;
  review: DrillReview;
};

export type ReplayResult = {
  steps: ReplayStep[];
  boards: Board[];
  placements: Placement[];
  reviews: DrillReview[];
};

/**
 * Null when the record has no replay, its drill is unknown or not replayable,
 * or a recorded pose cannot be reached (a corrupt or tampered replay).
 */
export function replaySession(
  record: Pick<SessionRecord, "drillId" | "replay">,
  def: DrillDef | undefined = findDrill(record.drillId)?.drill,
): ReplayResult | null {
  const { replay } = record;
  if (!replay || !def || !replayable(def)) return null;
  const session = new DrillSession(def, replay.seed, defaultSettings());
  const { game } = session;
  const steps: ReplayStep[] = [];
  let seen: Omit<ReplayStep, "placement" | "review"> | null = null;
  const grade = game.onLock;
  game.onLock = (info) => {
    grade?.(info);
    steps.push({
      ...seen!,
      board: info.before,
      placement: info.placement,
      review: session.reviews[info.placement.index],
    });
  };
  for (const move of replay.moves) {
    const { state } = game;
    if (!state.active) return null;
    seen = {
      board: state.board,
      current: state.active.type,
      hold: state.hold,
      next: state.queue.slice(0, 4),
      b2b: state.b2b,
      combo: state.combo,
    };
    // Drill rules apply to imported replays too.
    if (def.noHold && moveHeld(move)) return null;
    const [type, x, y, rotation] = move;
    if (!game.placeAt({ type, x, y, rotation }, moveHeld(move), moveSpin(move)))
      return null;
  }
  return {
    steps,
    boards: steps.map((s) => s.board),
    placements: steps.map((s) => s.placement),
    reviews: steps.map((s) => s.review),
  };
}
