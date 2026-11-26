import { attackFor } from "./attack";
import type { Spin } from "./attack";
import { collides, emptyBoard, lock, spawn, TYPES, VISIBLE } from "./board";
import type { Board, Piece, Tetromino } from "./board";
import { analyzeBoard, reviewPlacement } from "./coach";
import {
  dealGarbage,
  LEAGUE_GARBAGE_DELAY_MS,
  newGarbageRng,
  settleAttack,
} from "./incoming";
import type { GameOptions, GarbageRng, Incoming } from "./incoming";
import { nextRandom } from "./rng";
import { findPlacements, findSpins } from "./spins";

export type BotConfig = {
  seed: number;
  /** Pieces it places per second of game time. */
  pps: number;
  /** 0 to 1: scales lookahead (hold, then a second ply) and shrinks noise. */
  skill: number;
};

export type BotState = {
  rng: number;
  /** Hole columns for the garbage it receives. */
  garbage: GarbageRng;
  board: Board;
  /** Upcoming 7-bag pieces; the first is the current piece. */
  bag: Tetromino[];
  hold: Tetromino | null;
  b2b: number;
  combo: number;
  /** Its own clock in milliseconds, advanced with the game clock. */
  clock: number;
  /** Clock time of its next placement. */
  nextAt: number;
  /** Player garbage in flight, oldest first. */
  queue: Incoming[];
  pieces: number;
  attack: number;
  /** Rows of its stack (same field names as OpponentState for the HUD). */
  height: number;
  /** A B2B break at 4 or more releases a Surge, as for the player. */
  surge: boolean;
  alive: boolean;
};

/** The match rules the bot shares with the player. */
export type BotRules = Pick<
  GameOptions,
  "garbageCap" | "garbageMessiness" | "openerPhase"
>;
const DEFAULT_RULES: BotRules = {
  garbageCap: 8,
  garbageMessiness: 0.3,
  openerPhase: 0,
};
const EPS = 1e-9;
// Heuristic weights, in "attack line" units.
const W = {
  attack: 3,
  dig: 1.2,
  clear: 0.3,
  keepB2b: 1.5,
  breakB2b: 2,
  hole: 5,
  covered: 0.5,
  bump: 0.15,
  well: 0.8,
  waste: 2,
  high: 0.6,
  danger: 2,
  coach: 1.2,
  quadReady: 1.5,
  tsdSlot: 1.5,
  second: 0.5,
  noise: 2.5,
};
/** Skill at which the bot starts to consider the hold piece. */
const HOLD_SKILL = 0.3;
/** Skill at which it looks one piece further ahead. */
const DEEP_SKILL = 0.7;
const FINALISTS = 3;
// The second ply is costly, so only the best two get it.
const DEEP_FINALISTS = 2;

type Candidate = {
  type: Tetromino;
  hold: boolean;
  piece: Piece;
  after: Board;
  lines: number;
  garbage: number;
  spin: Spin;
  allClear: boolean;
  /** Cheap score; the coach and slot terms are added for finalists. */
  score: number;
};

function refill(bag: Tetromino[], holder: { rng: number }) {
  while (bag.length < 8) {
    const next: Tetromino[] = [...TYPES];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom(holder) * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    bag.push(...next);
  }
}

/**
 * Roughness of the stack, ignoring one deep column kept open for a quad, and
 * a bonus for that well (depth 2 to 5, capped).
 */
function surface(heights: number[]): { rough: number; well: number } {
  let low = 0;
  for (let x = 1; x < heights.length; x++) if (heights[x] < heights[low]) low = x;
  const rest = heights.filter((_, x) => x !== low);
  const depth = Math.min(...rest) - heights[low];
  let rough = 0;
  for (let i = 1; i < rest.length; i++) rough += Math.abs(rest[i] - rest[i - 1]);
  if (depth < 2) {
    const all = heights.reduce((n, h, i) => (i ? n + Math.abs(h - heights[i - 1]) : n), 0);
    return { rough: all, well: 0 };
  }
  return { rough, well: Math.min(depth, 5) };
}

type Context = {
  b2b: number;
  combo: number;
  holes: number;
  /** A low stack, where a small clear gives up quad potential. */
  calm: boolean;
};

/** Every placement and spin of `type`, scored by the cheap heuristic. */
function candidatesFor(
  board: Board,
  type: Tetromino,
  hold: boolean,
  ctx: Context,
  holder: { rng: number },
  noise: number,
): Candidate[] {
  const out: Candidate[] = [];
  const add = (piece: Piece, after: Board, lines: number, spin: Spin) => {
    const garbage = lines > 0 ? lock(board, piece).garbage : 0;
    const allClear =
      lines > 0 && after.every((row) => row.every((cell) => cell === null));
    const attack = attackFor({
      lines,
      spin,
      b2b: ctx.b2b,
      combo: ctx.combo,
      garbageCleared: garbage > 0,
      allClear,
    });
    const shape = analyzeBoard(after);
    let score = W.attack * attack.total + W.dig * garbage + W.clear * lines;
    // A small clear on a calm board wastes a stack that could hold a quad.
    if (ctx.calm && lines > 0 && lines < 4 && spin === null && garbage === 0)
      score -= W.waste;
    if (lines > 0 && attack.b2b < 0 && ctx.b2b >= 1)
      score -= W.breakB2b + Math.min(ctx.b2b, 8) * 0.4;
    else if (attack.b2b > ctx.b2b && ctx.b2b >= 0) score += W.keepB2b;
    score -= W.hole * Math.max(0, shape.holes - ctx.holes);
    score -= W.covered * shape.coveredCells;
    const { rough, well } = surface(shape.heights);
    score -= W.bump * rough;
    score += W.well * well;
    score -= W.high * Math.max(0, shape.maxHeight - 6);
    score -= W.danger * Math.max(0, shape.maxHeight - 12);
    score += (nextRandom(holder) - 0.5) * 2 * noise;
    out.push({ type, hold, piece, after, lines, garbage, spin, allClear, score });
  };
  for (const p of findPlacements(board, type))
    add(p.piece, p.after, p.lines, null);
  if (type !== "O")
    for (const s of findSpins(board, type)) add(s.piece, s.after, s.lines, s.spin);
  return out;
}

/**
 * A greedy bot with its own board. Each placement it scores every reachable
 * landing (and spin) of the current piece and, from `HOLD_SKILL`, of the hold
 * option, by attack (B2B, combo and Surge included), digging, B2B kept or
 * broken, new holes, bumpiness and height. The best few then also pay the
 * coach penalty and earn bonuses for a ready quad well or TSD slot, and from
 * `DEEP_SKILL` for the best follow-up on the next piece. Noise that shrinks
 * with skill perturbs the first pass, so a weak bot sometimes plays badly.
 * All of it, randomness included, lives in `state` so a Game can snapshot and
 * restore it.
 */
export class Bot {
  state: BotState;
  constructor(
    readonly config: BotConfig,
    /** Garbage cap, messiness and opener phase; the Game keeps these current. */
    public rules: BotRules = DEFAULT_RULES,
  ) {
    const rng = config.seed >>> 0;
    const state: BotState = {
      rng,
      garbage: newGarbageRng(config.seed),
      board: emptyBoard(),
      bag: [],
      hold: null,
      b2b: -1,
      combo: -1,
      clock: 0,
      nextAt: 0,
      queue: [],
      pieces: 0,
      attack: 0,
      height: 0,
      surge: true,
      alive: true,
    };
    refill(state.bag, state);
    state.nextAt = this.interval;
    this.state = state;
  }
  private get interval() {
    return 1000 / Math.max(0.1, this.config.pps);
  }
  /**
   * Queue lines the player sent at game time `at` (default: its own clock);
   * they land after the usual delay from then, not from its last frame.
   */
  receive(lines: number, at = this.state.clock) {
    const s = this.state;
    if (!s.alive || lines <= 0) return;
    s.queue.push({ lines, readyAt: at + LEAGUE_GARBAGE_DELAY_MS });
  }
  /** A top-out when the current piece cannot spawn, before it may hold. */
  private spawnBlocked() {
    const s = this.state;
    refill(s.bag, s);
    return collides(s.board, spawn(s.bag[0]));
  }
  /** Choose where the next piece goes; null when nothing fits (top out). */
  decide(): Candidate | null {
    const s = this.state;
    const skill = Math.min(1, Math.max(0, this.config.skill));
    const noise = W.noise * (1 - skill);
    const shape = analyzeBoard(s.board);
    const ctx: Context = {
      b2b: s.b2b,
      combo: s.combo,
      holes: shape.holes,
      calm: shape.maxHeight < 10,
    };
    const current = s.bag[0];
    const swap = s.hold ?? s.bag[1];
    const pool = candidatesFor(s.board, current, false, ctx, s, noise);
    if (skill >= HOLD_SKILL && swap !== current)
      pool.push(...candidatesFor(s.board, swap, true, ctx, s, noise));
    if (pool.length === 0) return null;
    pool.sort((a, b) => b.score - a.score);
    let best = pool[0];
    let bestScore = -Infinity;
    const next = (c: Candidate) => {
      // The piece that follows this choice.
      const rest = s.bag.slice(1);
      return c.hold && s.hold === null ? rest[1] : rest[0];
    };
    for (const [rank, c] of pool.slice(0, FINALISTS).entries()) {
      const review = reviewPlacement(s.board, c.after, {
        cleared: c.lines,
        spin: c.spin !== null,
      });
      let total = c.score - W.coach * review.penalty;
      if (review.quadReady) total += W.quadReady;
      if (review.tsdSlots > 0) total += W.tsdSlot;
      if (skill >= DEEP_SKILL && rank < DEEP_FINALISTS && next(c)) {
        const attack = attackFor({
          lines: c.lines,
          spin: c.spin,
          b2b: s.b2b,
          combo: s.combo,
          garbageCleared: c.garbage > 0,
          allClear: c.allClear,
        });
        const follow = candidatesFor(
          c.after,
          next(c),
          false,
          { ...ctx, b2b: attack.b2b, combo: attack.combo, holes: review.after.holes },
          s,
          0,
        );
        if (follow.length) total += W.second * Math.max(...follow.map((f) => f.score));
      }
      if (total > bestScore) {
        bestScore = total;
        best = c;
      }
    }
    return best;
  }
  private place(out: number[], scale: number) {
    const s = this.state;
    if (this.spawnBlocked()) {
      s.alive = false;
      return;
    }
    const choice = this.decide();
    if (!choice) {
      s.alive = false;
      return;
    }
    const current = s.bag.shift()!;
    if (choice.hold) {
      // Swapping with an empty hold takes the next piece out of the bag.
      if (s.hold === null) s.bag.shift();
      s.hold = current;
    }
    s.pieces++;
    s.board = choice.after;
    const attack = attackFor({
      lines: choice.lines,
      spin: choice.spin,
      b2b: s.b2b,
      combo: s.combo,
      garbageCleared: choice.garbage > 0,
      allClear: choice.allClear,
    });
    s.b2b = attack.b2b;
    s.combo = attack.combo;
    s.attack += attack.total;
    // Scaled and floored first, then it cancels its own pending garbage the
    // way the player does (opener phase included).
    const gross = Math.floor(attack.total * scale);
    const { sent } = settleAttack(
      s.queue,
      gross,
      choice.lines,
      s.pieces,
      this.rules.openerPhase,
    );
    if (sent > 0) out.push(sent);
    if (choice.lines === 0) {
      const dealt = dealGarbage(
        s.board,
        s.queue,
        s.garbage,
        s.clock,
        this.rules.garbageCap,
        this.rules.garbageMessiness,
      );
      s.board = dealt.board;
      if (dealt.toppedOut) s.alive = false;
    }
    s.height = analyzeBoard(s.board).maxHeight;
    // The next piece spawns now, so a blocked spawn is a KO at this time.
    if (s.alive && this.spawnBlocked()) s.alive = false;
  }
  /**
   * Attacks it sends during the next `ms` milliseconds, in order. `scale`
   * multiplies each attack (floored) like the garbage multiplier ramp.
   */
  advance(ms: number, scale = 1): number[] {
    const s = this.state;
    const out: number[] = [];
    while (ms > 0 && s.alive) {
      const step = Math.min(ms, Math.max(0, s.nextAt - s.clock));
      ms -= step;
      s.clock += step;
      if (s.clock >= s.nextAt - EPS) {
        this.place(out, scale);
        s.nextAt += this.interval;
      }
    }
    return out;
  }
}

/** The visible rows of a board as top-down text for `MiniBoard`. */
export const boardRows = (board: Board): string[] =>
  board
    .slice(0, VISIBLE)
    .reverse()
    .map((row) => row.map((cell) => cell ?? ".").join(""));

/** Lines of player garbage still in flight toward the bot. */
export const botPending = (state: BotState) =>
  state.queue.reduce((sum, p) => sum + p.lines, 0);
