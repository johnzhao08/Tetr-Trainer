import { lock } from "./board";
import type { Board, Piece, Tetromino } from "./board";
import { attackFor } from "./attack";
import type { Spin } from "./attack";
import { analyzeBoard, reviewPlacement } from "./coach";
import {
  cancelIncoming,
  cancelRate,
  dealGarbage,
  defaultOptions,
  garbageMultiplierAt,
  LEAGUE_GARBAGE_DELAY_MS,
  LEAGUE_PRESSURE,
  newGarbageRng,
  pendingLines,
} from "./incoming";
import type { Incoming } from "./incoming";
import { Opponent, STACK_MAX, STACK_MIN } from "./opponent";
import type { OpponentConfig } from "./opponent";
import { boardFromRows } from "./position";
import { nextRandom } from "./rng";
import { findPlacements, findSpins } from "./spins";

// Break-or-keep decisions. The question is when to cash in a charged B2B
// chain (breaking it releases Surge) and when to keep building it. The
// reports name this the central versus decision but give no sourced rule, so
// nothing here prescribes one. Each scenario constrains only the first piece:
// Break takes the B2B-breaking clear now, Keep does not break on it. After
// that both lines follow the same policy, free to release Surge whenever it
// pays. A published answer must hold under every policy variant and both
// horizons, and for the same visible height split differently between stack
// and garbage. It is scored by realized outcomes only: no credit for Surge
// that is still unreleased, and garbage still in flight is not counted as
// taken. When both lines top the opponent out, net lines decide.

export type Line = "break" | "keep";
export type DecisionFamily = "height" | "wait";

export type DecisionScenario = {
  id: string;
  family: DecisionFamily;
  title: string;
  /** Top-down rows of your board (see Position). */
  rows: string[];
  /** Pieces in play order; the first is the one you decide with. */
  queue: Tetromino[];
  /** Your B2B counter; 4 or more has Surge charged. */
  b2b: number;
  /** The match when you decide: pieces you have placed and elapsed ms. */
  match: { pieces: number; ms: number };
  /** Garbage already on its way to you; delay counts from the decision. */
  incoming: { lines: number; delayMs: number }[];
  opponent: Omit<OpponentConfig, "surge" | "receives">;
};

export type LineResult = {
  /** Lines that reached the opponent after cancelling (Surge included). */
  sent: number;
  /** Incoming lines your clears cancelled before they landed. */
  cancelled: number;
  /** Garbage that landed on your board. */
  received: number;
  /** Garbage still on its way when scoring ended; not counted as taken. */
  pending: number;
  /** Surge lines released by a chain break. */
  surge: number;
  /** The opponent topped out. */
  ko: boolean;
  /** You topped out. */
  died: boolean;
  /** Whether the first piece broke the chain. */
  brokeFirst: boolean;
  /** When each opponent attack becomes ready to land on you, ms from the decision. */
  arrivals: number[];
  /** Milliseconds into the decision when scoring ended. */
  endedMs: number;
  /** Your chain at the end: Surge still held, realized only if later released. */
  b2b: number;
  myHeight: number;
  oppHeight: number;
  oppB2b: number;
};

export type Policy = {
  /** Lines of attack a coach penalty point costs. */
  penalty: number;
  /** Lines of attack a row of stack height costs. */
  height: number;
  /** Added to any chain-breaking placement; negative is reluctant to break. */
  breakBias: number;
  /** Random value up to this added to each placement. */
  noise: number;
  seed: number;
  /** Shifts the opponent's seed so its attack schedule differs. */
  opponentShift: number;
};

export type Comparison = {
  break: LineResult;
  keep: LineResult;
  answer: Line;
  /** Realized gap (positive favors Break); a knockout or death dominates. */
  gap: number;
};

/** The policy variants a published answer must survive. */
export const POLICIES: readonly Policy[] = [
  { penalty: 1.5, height: 0.3, breakBias: 0, noise: 0, seed: 1, opponentShift: 0 },
  { penalty: 1, height: 0.5, breakBias: -3, noise: 0.6, seed: 11, opponentShift: 1 },
  { penalty: 2, height: 0.2, breakBias: 3, noise: 0.6, seed: 22, opponentShift: 2 },
  { penalty: 1.5, height: 0.3, breakBias: 0, noise: 1.2, seed: 33, opponentShift: 3 },
];
/** Pieces each line plays after the decision, at 2 pieces per second. */
export const HORIZONS: readonly number[] = [6, 10];
export const DECISION_PIECES = 10;
/** How much a cancelled line counts toward the score; both must agree. */
export const CANCEL_WEIGHTS: readonly number[] = [0, 1];
export const PIECE_MS = 500;
/** Smallest realized gap, in lines, that counts as a clear difference. */
export const MIN_MARGIN = 3;
/** Scale so any knockout or death outweighs every line count. */
const TERMINAL = 1000;

const FRAME_MS = 1000 / 60;
const PIECE_FRAMES = (PIECE_MS * 60) / 1000;
/** Time after the last piece for sent garbage to land, while the match is live. */
const SETTLE_FRAMES = 90;
const MESSINESS = 0.3;
const FORBIDDEN = 1e6;
const OPTIONS = { ...defaultOptions(), ...LEAGUE_PRESSURE };
const OPPONENT_SHIFT = 7919;

/** Lines sent plus cancelled, minus lines taken. */
export const net = (r: LineResult, cancelWeight = 1) =>
  r.sent + cancelWeight * r.cancelled - r.received;

/** Net lines, with a knockout and a death outweighing any line count. */
export function realized(r: LineResult, cancelWeight = 1): number {
  return (r.ko ? TERMINAL : 0) - (r.died ? TERMINAL : 0) + net(r, cancelWeight);
}

type Candidate = {
  piece: Piece;
  after: Board;
  lines: number;
  garbage: number;
  spin: Spin;
};

function candidates(board: Board, type: Tetromino): Candidate[] {
  const out: Candidate[] = findSpins(board, type).map((s) => ({
    piece: s.piece,
    after: s.after,
    lines: s.lines,
    garbage: lock(board, s.piece).garbage,
    spin: s.spin,
  }));
  for (const p of findPlacements(board, type))
    out.push({
      piece: p.piece,
      after: p.after,
      lines: p.lines,
      garbage: p.lines ? lock(board, p.piece).garbage : 0,
      spin: null,
    });
  return out;
}

const breaks = (c: Candidate) => c.lines > 0 && c.lines < 4 && c.spin === null;

/**
 * The shared policy: most attack from the real table (a chain break already
 * includes its Surge), less coach penalty and height. Only the decision piece
 * is constrained: `force` takes the biggest chain-breaking clear, or forbids
 * every chain-breaking placement.
 */
function choose(
  board: Board,
  type: Tetromino,
  b2b: number,
  combo: number,
  policy: Policy,
  noise: { rng: number },
  force?: Line,
): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = -Infinity;
  for (const c of candidates(board, type)) {
    const brk = breaks(c);
    if (force === "keep" && brk) continue;
    const review = reviewPlacement(board, c.after, {
      cleared: c.lines,
      spin: c.spin !== null,
    });
    const attack = attackFor({
      lines: c.lines,
      spin: c.spin,
      b2b,
      combo,
      garbageCleared: c.garbage > 0,
      allClear: c.lines > 0 && c.after.every((r) => r.every((x) => x === null)),
    });
    let value =
      attack.total -
      policy.penalty * review.penalty -
      policy.height * analyzeBoard(c.after).maxHeight +
      nextRandom(noise) * policy.noise +
      (brk ? policy.breakBias : 0);
    if (force === "break") value = brk ? c.lines * 100 + value : -FORBIDDEN;
    if (value > bestScore) {
      best = c;
      bestScore = value;
    }
  }
  return best;
}

/**
 * Plays one line, deterministically, at the Game's 1/60 s cadence: both
 * players act on exact times, so an opponent attack keeps its own timestamp
 * (plus the 333 ms garbage delay). The Game's opener-phase cancel and
 * multiplier rules apply from the scenario's match state. Scoring ends at the
 * first terminal event (a knockout or you topping out), and garbage in flight
 * settles only while the match is still live.
 */
export function simulate(
  s: DecisionScenario,
  line: Line,
  policy: Policy = POLICIES[0],
  horizon = DECISION_PIECES,
): LineResult {
  let board = boardFromRows(s.rows);
  let b2b = s.b2b;
  let combo = -1;
  const incoming: Incoming[] = s.incoming.map((e) => ({
    lines: e.lines,
    readyAt: e.delayMs,
  }));
  const seed = s.opponent.seed + policy.opponentShift * OPPONENT_SHIFT;
  const garbage = newGarbageRng(seed);
  const noise = { rng: (policy.seed * 2654435761) >>> 0 };
  const opponent = new Opponent(seed, {
    ...s.opponent,
    surge: true,
    receives: true,
  });
  const r = { sent: 0, cancelled: 0, received: 0, surge: 0, brokeFirst: false };
  const pieces = Math.min(horizon, s.queue.length);
  const arrivals: number[] = [];
  let died = false;
  let frame = 0;
  for (; frame < pieces * PIECE_FRAMES + SETTLE_FRAMES; frame++) {
    const now = (frame + 1) * FRAME_MS;
    const scale = garbageMultiplierAt(OPTIONS, s.match.ms + now);
    const attacks = opponent.advance(FRAME_MS, scale);
    if (!opponent.state.alive) break;
    for (const lines of attacks) {
      incoming.push({ lines, readyAt: now + LEAGUE_GARBAGE_DELAY_MS });
      arrivals.push(now + LEAGUE_GARBAGE_DELAY_MS);
    }
    const i = (frame + 1) / PIECE_FRAMES;
    if (!Number.isInteger(i) || i > pieces) continue;
    const pick = choose(
      board, s.queue[i - 1], b2b, combo, policy, noise, i === 1 ? line : undefined,
    );
    if (!pick) {
      died = true;
      break;
    }
    if (i === 1) r.brokeFirst = breaks(pick);
    const attack = attackFor({
      lines: pick.lines,
      spin: pick.spin,
      b2b,
      combo,
      garbageCleared: pick.garbage > 0,
      allClear: pick.lines > 0 && pick.after.every((row) => row.every((x) => x === null)),
    });
    b2b = attack.b2b;
    combo = attack.combo;
    board = pick.after;
    r.surge += attack.surge;
    const outgoing = Math.floor(attack.total * scale);
    const rate = cancelRate(
      OPTIONS,
      s.match.pieces + i,
      pendingLines(incoming),
      outgoing,
    );
    const cancelled = pick.lines > 0 ? cancelIncoming(incoming, outgoing * rate) : 0;
    const sent = outgoing - Math.ceil(cancelled / rate);
    r.cancelled += cancelled;
    r.sent += sent;
    opponent.receive(sent);
    if (pick.lines === 0) {
      const before = pendingLines(incoming);
      const dealt = dealGarbage(
        board, incoming, garbage, now, OPTIONS.garbageCap, MESSINESS,
      );
      r.received += before - pendingLines(incoming);
      board = dealt.board;
      if (dealt.toppedOut) {
        died = true;
        break;
      }
    }
  }
  const ko = !opponent.state.alive;
  // Garbage still in flight is reported apart: it never landed, so it is
  // not counted as taken.
  const pending = ko || died ? 0 : pendingLines(incoming);
  return {
    ...r,
    pending,
    ko,
    died,
    arrivals,
    endedMs: Math.round(frame * FRAME_MS),
    b2b,
    myHeight: analyzeBoard(board).maxHeight,
    oppHeight: opponent.state.height,
    oppB2b: opponent.state.b2b,
  };
}

const gapOf = (b: LineResult, k: LineResult, cancelWeight: number) =>
  realized(b, cancelWeight) - realized(k, cancelWeight);

/** The played-out comparison shown to the player: base policy, longest horizon. */
export function compare(s: DecisionScenario): Comparison {
  const breakResult = simulate(s, "break");
  const keepResult = simulate(s, "keep");
  const gap = gapOf(breakResult, keepResult, 1);
  return {
    break: breakResult,
    keep: keepResult,
    answer: gap > 0 ? "break" : "keep",
    gap,
  };
}

/**
 * The scenario and the same visible height split differently between stack
 * and garbage: every legal stack height from STACK_MIN to the smaller of
 * STACK_MAX and the visible height, the rest as garbage. The opponent digs
 * garbage first and caps its stack, so the split can change what a Surge
 * does, and an answer must not hang on it.
 */
export function compositions(s: DecisionScenario): DecisionScenario[] {
  const start = s.opponent.start ?? {};
  const stack = start.stack ?? STACK_MIN;
  const visible = stack + (start.dirt ?? 0);
  const out = [s];
  for (let moved = STACK_MIN; moved <= Math.min(STACK_MAX, visible); moved++) {
    if (moved === stack) continue;
    out.push({
      ...s,
      opponent: { ...s.opponent, start: { ...start, stack: moved, dirt: visible - moved } },
    });
  }
  return out;
}

/**
 * The answer, only if every policy variant, horizon and cancel weighting
 * agrees on the same winner by at least MIN_MARGIN. The same visible height
 * split differently between stack and garbage (see `compositions`) must agree
 * on the winner too, by any gap, so a lesson never reverses with the split.
 * Otherwise null: no answer holds under plausible play, so it is not
 * published. `margin` is the smallest gap of the scenario itself.
 */
export function robustAnswer(
  s: DecisionScenario,
): { answer: Line; margin: number } | null {
  let answer: Line | null = null;
  let margin = Infinity;
  for (const variant of compositions(s))
    for (const policy of POLICIES)
      for (const horizon of HORIZONS) {
        const b = simulate(variant, "break", policy, horizon);
        const k = simulate(variant, "keep", policy, horizon);
        for (const w of CANCEL_WEIGHTS) {
          const gap = gapOf(b, k, w);
          const winner: Line = gap > 0 ? "break" : "keep";
          const needed = variant === s ? MIN_MARGIN : 1;
          if (Math.abs(gap) < needed || (answer && winner !== answer))
            return null;
          answer = winner;
          if (variant === s) margin = Math.min(margin, Math.abs(gap));
        }
      }
  return answer && { answer, margin };
}

const plural = (n: number) => `${n} line${n === 1 ? "" : "s"}`;

/** "Breaking now sent 9 and topped them out; keeping sent 6, took 2 lines." */
export function summarize(c: Comparison): string {
  const part = (verb: string, r: LineResult) =>
    `${verb} sent ${r.sent}` +
    (r.cancelled > 0 ? `, cancelled ${r.cancelled}` : "") +
    (r.ko ? " and topped them out" : "") +
    (r.received > 0 ? `, took ${plural(r.received)}` : "") +
    (r.pending > 0 ? `, ${plural(r.pending)} still incoming` : "") +
    (r.died ? " and you topped out" : "");
  return `${part("Breaking now", c.break)}; ${part("keeping", c.keep)}.`;
}
