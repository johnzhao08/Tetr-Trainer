import { lock } from "./board";
import type { Board, Piece, Tetromino } from "./board";
import { attackFor } from "./attack";
import type { Spin } from "./attack";
import { analyzeBoard, reviewPlacement } from "./coach";
import { cancelIncoming, dealGarbage, newGarbageRng } from "./incoming";
import type { Incoming } from "./incoming";
import { Opponent } from "./opponent";
import type { OpponentConfig } from "./opponent";
import { boardFromRows } from "./position";
import { findPlacements, findSpins } from "./spins";

// Break-or-keep decisions. The question is when to cash in a charged B2B
// chain (breaking it releases Surge) and when to keep building it. The
// reports name this the central versus decision but give no sourced rule, so
// nothing here prescribes one: each scenario plays both lines forward against
// the same scripted opponent and the answer is whichever line scores higher.

export type Line = "break" | "keep";
export type DecisionKind = "spike" | "cancel" | "calm";

export type DecisionScenario = {
  id: string;
  kind: DecisionKind;
  title: string;
  /** Top-down rows of your board (see Position). */
  rows: string[];
  /** Pieces in play order; the first is the one you decide with. */
  queue: Tetromino[];
  /** Your B2B counter; 4 or more has Surge charged. */
  b2b: number;
  /** Garbage already on its way to you; delay counts from the decision. */
  incoming: { lines: number; delayMs: number }[];
  opponent: Omit<OpponentConfig, "surge" | "receives">;
};

export type LineResult = {
  /** Lines you sent after cancelling (Surge included). */
  sent: number;
  /** Garbage rows that landed on you. */
  received: number;
  /** The opponent topped out. */
  ko: boolean;
  /** You topped out. */
  died: boolean;
  /** Your B2B at the end; kept chain is Surge you can still release. */
  b2b: number;
  /** Surge you banked: your final B2B once it reaches the Surge threshold. */
  banked: number;
  myHeight: number;
  oppHeight: number;
  score: number;
};

export type Comparison = {
  break: LineResult;
  keep: LineResult;
  answer: Line;
  /** Score gap between the lines; always positive in a published scenario. */
  margin: number;
};

/** Pieces each line plays, at 2 pieces per second. */
export const DECISION_PIECES = 8;
export const PIECE_MS = 500;
export const KO_SCORE = 50;
export const DEATH_SCORE = 50;
export const SURGE_FROM = 4;
/** Smallest score gap a published scenario may have, so the lesson is clear. */
export const MIN_MARGIN = 6;

const TRAVEL_MS = 333;
/** Extra time after the last piece for sent garbage to land. */
const SETTLE_MS = 1500;
const GARBAGE_CAP = 8;
const MESSINESS = 0.3;
// Greedy policy weights: coach penalty and stack height cost this many lines.
const PENALTY_WEIGHT = 1.5;
const HEIGHT_WEIGHT = 0.3;
const FORBIDDEN = 1e6;

/** score = 50 KO - 50 death + sent - received + banked Surge. */
export function scoreLine(r: Omit<LineResult, "score">): number {
  return (
    (r.ko ? KO_SCORE : 0) -
    (r.died ? DEATH_SCORE : 0) +
    r.sent -
    r.received +
    r.banked
  );
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
 * The fixed policy for both lines: the placement with the most attack (from
 * the real attack table), less coach penalty and height, and never one that
 * breaks a live B2B chain. `force: "break"` instead takes the biggest clear
 * that breaks it, for the first piece of the Break line.
 */
function choose(
  board: Board,
  type: Tetromino,
  b2b: number,
  combo: number,
  force?: "break",
): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = -Infinity;
  for (const c of candidates(board, type)) {
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
      PENALTY_WEIGHT * review.penalty -
      HEIGHT_WEIGHT * analyzeBoard(c.after).maxHeight;
    if (force === "break") value = breaks(c) ? c.lines * 100 + value : -FORBIDDEN;
    else if (b2b >= 0 && breaks(c)) value -= FORBIDDEN / 2;
    if (value > bestScore) {
      best = c;
      bestScore = value;
    }
  }
  return best;
}

/**
 * Plays one line for DECISION_PIECES pieces, deterministically: same board,
 * queue and seeded opponent, no hold, no undo. Break plays the biggest
 * B2B-breaking clear first (releasing Surge); Keep never breaks the chain.
 */
export function simulate(s: DecisionScenario, line: Line): LineResult {
  let board = boardFromRows(s.rows);
  let b2b = s.b2b;
  let combo = -1;
  const incoming: Incoming[] = s.incoming.map((e) => ({
    lines: e.lines,
    readyAt: e.delayMs,
  }));
  const garbage = newGarbageRng(s.opponent.seed);
  const opponent = new Opponent(s.opponent.seed, {
    ...s.opponent,
    surge: true,
    receives: true,
  });
  let sent = 0;
  let received = 0;
  let died = false;
  for (let i = 0; i < Math.min(DECISION_PIECES, s.queue.length); i++) {
    const now = (i + 1) * PIECE_MS;
    for (const lines of opponent.advance(PIECE_MS))
      incoming.push({ lines, readyAt: now + TRAVEL_MS });
    if (!opponent.state.alive) break;
    const type = s.queue[i];
    const pick =
      (i === 0 && line === "break" ? choose(board, type, b2b, combo, "break") : null) ??
      choose(board, type, b2b, combo);
    if (!pick) {
      died = true;
      break;
    }
    const attack = attackFor({
      lines: pick.lines,
      spin: pick.spin,
      b2b,
      combo,
      garbageCleared: pick.garbage > 0,
      allClear: pick.lines > 0 && pick.after.every((r) => r.every((x) => x === null)),
    });
    b2b = attack.b2b;
    combo = attack.combo;
    board = pick.after;
    const cancelled = pick.lines > 0 ? cancelIncoming(incoming, attack.total) : 0;
    opponent.receive(attack.total - cancelled);
    sent += attack.total - cancelled;
    if (pick.lines === 0) {
      const before = incoming.reduce((n, e) => n + e.lines, 0);
      const dealt = dealGarbage(board, incoming, garbage, now, GARBAGE_CAP, MESSINESS);
      received += before - incoming.reduce((n, e) => n + e.lines, 0);
      board = dealt.board;
      if (dealt.toppedOut) {
        died = true;
        break;
      }
    }
  }
  // Garbage still in flight toward the opponent gets time to land.
  if (opponent.state.alive) opponent.advance(SETTLE_MS);
  const result = {
    sent,
    received,
    ko: !opponent.state.alive,
    died,
    b2b,
    banked: b2b >= SURGE_FROM ? b2b : 0,
    myHeight: analyzeBoard(board).maxHeight,
    oppHeight: opponent.state.height,
  };
  return { ...result, score: scoreLine(result) };
}

export function compare(s: DecisionScenario): Comparison {
  const breakResult = simulate(s, "break");
  const keepResult = simulate(s, "keep");
  const gap = breakResult.score - keepResult.score;
  return {
    break: breakResult,
    keep: keepResult,
    answer: gap > 0 ? "break" : "keep",
    margin: Math.abs(gap),
  };
}

const plural = (n: number) => `${n} line${n === 1 ? "" : "s"}`;

/** "Breaking now sent 9 and topped them out; keeping sent 6." */
export function summarize(c: Comparison): string {
  const part = (verb: string, r: LineResult) =>
    `${verb} sent ${r.sent}` +
    (r.ko ? " and topped them out" : "") +
    (r.received > 0 ? `, took ${plural(r.received)}` : "") +
    (r.died ? " and you topped out" : "");
  return `${part("Breaking now", c.break)}; ${part("keeping", c.keep)}.`;
}
