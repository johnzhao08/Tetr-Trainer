import { HEIGHT, WIDTH } from "./board";
import type { Board, Cell } from "./board";
import type { CheeseSpec } from "./cheese";
import type { OpponentConfig } from "./opponent";
import { nextRandom } from "./rng";

export type Incoming = {
  lines: number;
  readyAt: number;
  /** Hole column, fixed when the entry first reaches the board. */
  hole?: number;
};
export type GarbageRng = { rng: number; hole: number };

export type GameOptions = {
  /** Cells per frame at 60 fps. 0 turns gravity and auto-lock off. */
  gravity: number;
  /** Added to gravity per second once past gravityMarginMs. */
  gravityIncrease: number;
  gravityMarginMs: number;
  /** Grounded time before a piece locks by itself (gravity > 0 only). */
  lockDelayMs: number;
  /** Successful moves or rotations that restart the lock timer. */
  lockResets: number;
  /** Most garbage lines inserted by one lock. */
  garbageCap: number;
  /** Chance that the next garbage entry uses a new hole column. */
  garbageMessiness: number;
  /**
   * Pieces at the start of a game during which a defender who is behind (more
   * lines pending than the attack sent) cancels 2 pending lines per attack
   * line. 0 turns it off; the league preset is 14.
   */
  openerPhase: number;
  /** Multiplier on outgoing attack (and opponent attack) once past the margin. */
  garbageMultiplier: number;
  /** Added to the garbage multiplier per second past `garbageMarginMs`. */
  garbageIncrease: number;
  garbageMarginMs: number;
  opponent?: OpponentConfig;
  /** Cheese kept on the board and refilled after each lock. */
  cheese?: CheeseSpec;
};

export const defaultOptions = (): GameOptions => ({
  gravity: 0,
  gravityIncrease: 0,
  gravityMarginMs: 120000,
  lockDelayMs: 500,
  lockResets: 15,
  garbageCap: 8,
  garbageMessiness: 0.3,
  openerPhase: 0,
  garbageMultiplier: 1,
  garbageIncrease: 0,
  garbageMarginMs: 180000,
});

// halp1/triangle league preset: g 0.02, gincrease 0.0035, gmargin 7200 frames,
// locktime 30 frames, garbagespeed 20 frames, garbagecap 8, openerphase 14,
// garbagemultiplier 1, garbageincrease 0.008, garbagemargin 10800 frames.
export const LEAGUE_PRESSURE: Partial<GameOptions> = {
  gravity: 0.02,
  gravityIncrease: 0.0035,
  gravityMarginMs: 120000,
  lockDelayMs: 500,
  lockResets: 15,
  garbageCap: 8,
  openerPhase: 14,
  garbageMultiplier: 1,
  garbageIncrease: 0.008,
  garbageMarginMs: 180000,
};
export const LEAGUE_GARBAGE_DELAY_MS = 333;

export const newGarbageRng = (seed: number): GarbageRng => ({
  rng: (seed ^ 0x9e3779b9) >>> 0,
  hole: -1,
});

export const pendingLines = (queue: readonly Incoming[]) =>
  queue.reduce((sum, entry) => sum + entry.lines, 0);

/** Garbage multiplier at game time `ms`: flat until the margin, then ramping. */
export const garbageMultiplierAt = (o: GameOptions, ms: number) =>
  o.garbageMultiplier +
  (o.garbageIncrease * Math.max(0, ms - o.garbageMarginMs)) / 1000;

/** Spend `attack` lines on the queue, oldest first; returns lines cancelled. */
export function cancelIncoming(queue: Incoming[], attack: number): number {
  let left = attack;
  while (left > 0 && queue.length) {
    const used = Math.min(left, queue[0].lines);
    left -= used;
    queue[0].lines -= used;
    if (queue[0].lines === 0) queue.shift();
  }
  return attack - left;
}

/**
 * Insert ready entries at the bottom, at most `cap` lines. Mutates the queue
 * and rng; returns the new board, or `toppedOut` when a filled cell was pushed
 * above the top row.
 */
export function dealGarbage(
  board: Board,
  queue: Incoming[],
  garbage: GarbageRng,
  now: number,
  cap: number,
  messiness: number,
): { board: Board; toppedOut: boolean } {
  const rows: Cell[][] = [];
  // Ready entries insert in arrival order; unready ones are skipped, not
  // blocking.
  for (let i = 0; i < queue.length && rows.length < cap; ) {
    const entry = queue[i];
    if (entry.readyAt > now) {
      i++;
      continue;
    }
    if (entry.hole === undefined) {
      if (garbage.hole < 0 || nextRandom(garbage) < messiness) {
        const old = garbage.hole;
        garbage.hole =
          old < 0
            ? Math.floor(nextRandom(garbage) * WIDTH)
            : (old + 1 + Math.floor(nextRandom(garbage) * (WIDTH - 1))) % WIDTH;
      }
      entry.hole = garbage.hole;
    }
    const take = Math.min(entry.lines, cap - rows.length);
    for (let j = 0; j < take; j++)
      rows.push(
        Array.from({ length: WIDTH }, (_, x) =>
          x === entry.hole ? null : "X",
        ),
      );
    entry.lines -= take;
    if (entry.lines === 0) queue.splice(i, 1);
  }
  if (!rows.length) return { board, toppedOut: false };
  const toppedOut = board
    .slice(HEIGHT - rows.length)
    .some((row) => row.some((cell) => cell !== null));
  return { board: [...rows, ...board].slice(0, HEIGHT), toppedOut };
}
