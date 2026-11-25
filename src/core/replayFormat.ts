// Compact replay of a drill run, stored on its SessionRecord. Pure data and
// validation; replaySession (replay.ts) turns it back into boards.
import { HEIGHT, TYPES, WIDTH } from "./board";
import type { Rotation, Tetromino } from "./board";
import type { Spin } from "./attack";
import type { DrillDef } from "./drill";
import type { Placement } from "./game";

/** [type, x, y, rotation, flags]; flags: 1 held, 2 mini spin, 4 full spin. */
export type ReplayMove = [Tetromino, number, number, Rotation, number];
/** The drill is the record's own drillId; its options come from the DrillDef. */
export type Replay = { seed: number; moves: ReplayMove[] };

export const MAX_REPLAY_MOVES = 1000;
/** Only this many of the newest sessions keep their replay in storage. */
export const REPLAYS_KEPT = 30;

const HELD = 1;
const MINI = 2;
const FULL = 4;

/** Garbage that arrives on a clock cannot be rebuilt from placements alone. */
export function replayable(def: Pick<DrillDef, "options">): boolean {
  return !def.options?.opponent;
}

export function encodeReplay(
  def: Pick<DrillDef, "options">,
  seed: number,
  log: readonly Placement[],
): Replay | undefined {
  if (!replayable(def) || log.length === 0 || log.length > MAX_REPLAY_MOVES)
    return undefined;
  return {
    seed: seed >>> 0,
    moves: log.map((p): ReplayMove => [
      p.type,
      p.landing.x,
      p.landing.y,
      p.landing.rotation,
      (p.held ? HELD : 0) | (p.spin === "mini" ? MINI : p.spin === "full" ? FULL : 0),
    ]),
  };
}

export function moveHeld(move: ReplayMove): boolean {
  return (move[4] & HELD) !== 0;
}
export function moveSpin(move: ReplayMove): Spin {
  return move[4] & FULL ? "full" : move[4] & MINI ? "mini" : null;
}

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Strict parse: any bad field rejects the whole replay. */
export function parseReplay(value: unknown): Replay | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (!isInt(r.seed, 0, 0xffffffff) || !Array.isArray(r.moves)) return null;
  if (r.moves.length === 0 || r.moves.length > MAX_REPLAY_MOVES) return null;
  const moves: ReplayMove[] = [];
  for (const m of r.moves) {
    if (!Array.isArray(m) || m.length !== 5) return null;
    const [type, x, y, rotation, flags] = m;
    if (!TYPES.includes(type)) return null;
    if (!isInt(x, -3, WIDTH + 2) || !isInt(y, -3, HEIGHT)) return null;
    if (!isInt(rotation, 0, 3) || !isInt(flags, 0, 7)) return null;
    if ((flags & MINI) !== 0 && (flags & FULL) !== 0) return null;
    moves.push([type, x, y, rotation as Rotation, flags]);
  }
  return { seed: r.seed, moves };
}
