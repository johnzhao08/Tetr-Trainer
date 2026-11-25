import { TYPES } from "./board";
import type { Board, Tetromino } from "./board";
import { nextRandom } from "./rng";
import { findPlacements, findSpins } from "./spins";
import type { Placement, SpinMove } from "./spins";
import { generateStack } from "./stackGen";
import { boardOf, deadBoard, kaidanCue, mirrorBoard, STRUCTURES } from "./structures";
import { bestSlot, creates, planSlot, removals, runPlan, slotReady } from "./visionSearch";
import type { PlanStep } from "./visionSearch";
import { replay } from "./visionGame";
import type { GameState } from "./game";

export type VisionKind =
  | "findSlot"
  | "noSlot"
  | "whichPiece"
  | "forecast";
export const VISION_KINDS: readonly VisionKind[] = [
  "findSlot",
  "noSlot",
  "whichPiece",
  "forecast",
];
export const VISION_PROMPT: Record<VisionKind, string> = {
  findSlot: "Where does the T go?",
  noSlot: "Is there a line-clearing T-spin?",
  whichPiece: "Which piece makes a T-slot?",
  forecast: "Will a T-slot be ready when the T arrives?",
};

type Base = { id: string; seed: number; board: Board; why: string };
export type FindSlotQ = Base & {
  kind: "findSlot";
  /** Lines of the best full T-spin; any full T-spin clearing this many is right. */
  best: number;
  answers: SpinMove[];
};
export type NoSlotQ = Base & {
  kind: "noSlot";
  answer: boolean;
  /** No T-spin Double or better, no quad, and none buildable with one piece. */
  dead: boolean;
  example: SpinMove | null;
};
export type WhichPieceQ = Base & {
  kind: "whichPiece";
  answers: Tetromino[];
  example: { type: Tetromino; placement: Placement; slot: SpinMove };
};
export type ForecastQ = Base & {
  kind: "forecast";
  queue: Tetromino[];
  hold: Tetromino | null;
  /** Index of the T in `queue`; the pieces before it are played first. */
  tIndex: number;
  answer: boolean;
  /** A proof for a yes: the plays that leave the slot, and the slot itself. */
  plan: { steps: PlanStep[]; board: Board; slot: SpinMove } | null;
};
export type VisionQuestion =
  | FindSlotQ
  | NoSlotQ
  | WhichPieceQ
  | ForecastQ;

// ---------------------------------------------------------------- sources

let bases: Board[] | null = null;
function slotBases(): Board[] {
  bases ??= STRUCTURES.flatMap((s) => {
    const board = boardOf(s);
    return [board, mirrorBoard(board)];
  }).filter(slotReady);
  return bases;
}
type Rng = { rng: number };
const rand = (rng: Rng, n: number) => Math.floor(nextRandom(rng) * n);
const pick = <T,>(rng: Rng, list: readonly T[]) => list[rand(rng, list.length)];
function shuffled<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A known T-spin structure with 2 to 10 pieces stacked around it. */
function slotBoard(rng: Rng): Board {
  return generateStack(rng.rng, {
    base: pick(rng, slotBases()),
    pieces: 2 + rand(rng, 9),
    keep: slotReady,
    well: rand(rng, 10),
  }).board;
}

/** A board with no slot yet that one placement of `type` would create. */
function almostBoard(rng: Rng): { board: Board; type: Tetromino } | null {
  const base = pick(rng, slotBases());
  for (const r of removals(base, rng.rng).slice(0, 12)) {
    if (slotReady(r.board) || !creates(r.board, r.type)) continue;
    const extras = rand(rng, 5);
    if (extras === 0) return { board: r.board, type: r.type };
    const board = generateStack(rng.rng, {
      base: r.board,
      pieces: extras,
      keep: (b) => !slotReady(b) && creates(b, r.type) !== null,
      well: rand(rng, 10),
    }).board;
    if (!slotReady(board) && creates(board, r.type)) return { board, type: r.type };
  }
  return null;
}

const natural = (rng: Rng): Board =>
  generateStack(rng.rng, { pieces: 10 + rand(rng, 18), well: rand(rng, 10) })
    .board;

// ------------------------------------------------------------------- why

/** One line on what makes this spin. */
export function whyText(move: SpinMove, board?: Board): string {
  const shape =
    move.lines >= 3
      ? "a 2-wide notch three deep: TST"
      : move.piece.rotation === 2
        ? "a 3-wide gap under an overhang: TSD"
        : "a pocket in the wall: sideways TSD";
  const cue = board && kaidanCue(board) ? " (Kaidan stair head)" : "";
  return `${move.label}: the T drops in and turns into ${shape}${cue}.`;
}

const verified = (board: Board, move: SpinMove) => {
  const { state } = replay(board, "T", move.path);
  return (
    state.lastEvent?.spin === "full" &&
    state.lastClear === move.lines &&
    state.pieces === 1
  );
};

// ------------------------------------------------------------- generators

/** `budgetMs` bounds proof searches; replays pass Infinity to ignore the clock. */
type Ctx = { budgetMs: number; now?: () => number };
type Build<Q> = (seed: number, rng: Rng, ctx: Ctx) => Q | null;

const findSlot: Build<FindSlotQ> = (seed, rng) => {
  const board = slotBoard(rng);
  const full = findSpins(board, "T").filter((s) => s.spin === "full");
  const best = Math.max(0, ...full.map((s) => s.lines));
  const answers = full.filter((s) => s.lines === best);
  if (best < 2 || !answers.every((s) => verified(board, s))) return null;
  return {
    kind: "findSlot", id: `findSlot-${seed}`, seed, board, best, answers,
    why: whyText(answers[0], board),
  };
};

/** Dead means no T-spin Double or better and no quad, now or after one piece. */
export const DEAD_HORIZON = 1;
const deadCache = new Map<string, boolean>();
export function isDead(board: Board): boolean {
  const key = board.map((r) => r.map((c) => (c ? 1 : 0)).join("")).join("|");
  let dead = deadCache.get(key);
  if (dead === undefined) {
    dead = deadBoard(board, { horizon: DEAD_HORIZON });
    deadCache.set(key, dead);
  }
  return dead;
}

/** What a non-dead board still offers, each backed by a real placement. */
export function noSlotWhy(board: Board, dead: boolean): string {
  if (dead) return "Dead board: no T-spin Double or better and no quad, now or after one piece.";
  const quad = TYPES.some((t) => findPlacements(board, t).some((p) => p.lines >= 4));
  if (quad) return "No line-clearing T-spin now, but a quad is ready.";
  const type = TYPES.find((t) => creates(board, t) !== null);
  return type
    ? `No line-clearing T-spin now, but a ${type} would build one.`
    : "No line-clearing T-spin now, though the board is not dead.";
}

const noSlot: Build<NoSlotQ> = (seed, rng) => {
  if (nextRandom(rng) < 0.5) {
    const board = slotBoard(rng);
    const example = bestSlot(board);
    if (!example || !verified(board, example)) return null;
    return {
      kind: "noSlot", id: `noSlot-${seed}`, seed, board, answer: true,
      dead: false, example, why: whyText(example, board),
    };
  }
  const board = nextRandom(rng) < 0.5 ? natural(rng) : almostBoard(rng)?.board;
  if (!board || findSpins(board, "T").length > 0) return null;
  const dead = isDead(board);
  return {
    kind: "noSlot", id: `noSlot-${seed}`, seed, board, answer: false, dead,
    example: null,
    why: noSlotWhy(board, dead),
  };
};

const whichPiece: Build<WhichPieceQ> = (seed, rng) => {
  const almost = almostBoard(rng);
  if (!almost) return null;
  const { board } = almost;
  const answers = TYPES.filter((t) => creates(board, t) !== null);
  if (answers.length === 0 || answers.length > 4) return null;
  const type = answers.includes(almost.type) ? almost.type : answers[0];
  const placement = creates(board, type)!;
  const slot = bestSlot(placement.after)!;
  const placed = replay(board, type, placement.path);
  if (
    placed.state.board.map((r) => r.join()).join("|") !==
      placement.after.map((r) => r.join()).join("|") ||
    !verified(placement.after, slot)
  )
    return null;
  return {
    kind: "whichPiece", id: `whichPiece-${seed}`, seed, board, answers,
    example: { type, placement, slot },
    why: `${type} here leaves ${slot.label}: ${whyText(slot).split(": ")[1]}`,
  };
};

/** Time allowed to prove that no plan exists before the question is dropped. */
export const PROOF_BUDGET_MS = 400;

/**
 * `want` yes: a plan the real engine replays, else undefined (drop it).
 * `want` no: null only if a complete search finds no plan in time; any plan
 * or a timeout is undefined, because a miss alone would not prove a no.
 */
function planQuestion(
  board: Board,
  queue: Tetromino[],
  hold: Tetromino | null,
  count: number,
  want: boolean,
  ctx: Ctx,
) {
  if (!want) {
    const none = planSlot(board, queue, hold, count, {
      exhaustive: true,
      budgetMs: ctx.budgetMs,
      now: ctx.now,
    });
    return none === null ? null : undefined;
  }
  const plan = planSlot(board, queue, hold, count);
  if (!plan) return undefined;
  const game = runPlan(board, queue, hold, plan.steps);
  const same = game.state.board.map((r) => r.join()).join("|") ===
    plan.board.map((r) => r.join()).join("|");
  return same && slotReady(game.state.board) && verified(plan.board, plan.slot)
    ? plan
    : undefined;
}

const forecast: Build<ForecastQ> = (seed, rng, ctx) => {
  const want = nextRandom(rng) < 0.5;
  const almost = want ? almostBoard(rng) : null;
  if (almost?.type === "T") return null;
  const board = almost?.board ?? (nextRandom(rng) < 0.5 ? natural(rng) : almostBoard(rng)?.board);
  if (!board || slotReady(board)) return null;
  // A proven no needs a complete search, so keep it to at most two pieces.
  const tIndex = 1 + rand(rng, want ? 3 : 2);
  const rest = shuffled(rng, TYPES.filter((t) => t !== "T" && (want || t !== almost?.type)));
  const queue = rest.slice(0, 4);
  queue.splice(tIndex, 0, "T");
  let hold: Tetromino | null = nextRandom(rng) < 0.4 ? rest[4] ?? null : null;
  if (almost) {
    // Hand the piece that builds the slot to the player, before the T.
    const at = rand(rng, tIndex + 1);
    if (at === tIndex) hold = almost.type;
    else queue[at] = almost.type;
  }
  // The target is the first T in the previews and none waits in hold.
  if (queue.indexOf("T") !== tIndex || hold === "T") return null;
  const plan = planQuestion(board, queue, hold, tIndex, want, ctx);
  if (plan === undefined) return null;
  return {
    kind: "forecast", id: `forecast-${seed}`, seed, board, queue: queue.slice(0, 5),
    hold, tIndex, answer: plan !== null, plan,
    why: plan
      ? `Yes: ${plan.steps.filter((s) => s.move).map((s) => s.type).join(" then ")} leaves ${plan.slot.label} for the T.`
      : "No: no way to play the pieces before the T, with hold, leaves a T-slot.",
  };
};

const BUILDERS: { [K in VisionKind]: Build<Extract<VisionQuestion, { kind: K }>> } = {
  findSlot, noSlot, whichPiece, forecast,
};

/**
 * A verified question near `seed`. Candidates that fail their answer check, or
 * whose no-proof runs out of time, are dropped and the next derived seed is
 * tried. The returned `seed` (and id) is the derived seed that produced the
 * question, so `questionById` rebuilds it exactly, whatever the clock says.
 */
export function generateQuestion<K extends VisionKind>(
  seed: number,
  kind: K,
  opts: { now?: () => number } = {},
): Extract<VisionQuestion, { kind: K }> {
  const ctx: Ctx = { budgetMs: PROOF_BUDGET_MS, now: opts.now };
  for (let attempt = 0; attempt < 60; attempt++) {
    const derived = (seed + Math.imul(attempt, 0x9e3779b1)) >>> 0;
    const q = (BUILDERS[kind] as Build<Extract<VisionQuestion, { kind: K }>>)(
      derived,
      { rng: derived },
      ctx,
    );
    if (q) return q;
  }
  throw new Error(`no ${kind} question found for seed ${seed}`);
}

/**
 * Rebuild an accepted question from its id. The proof search ran inside its
 * budget when the question was accepted, so it runs here without one.
 */
export function questionById(id: string): VisionQuestion {
  const m = /^(\w+)-(\d+)$/.exec(id);
  const kind = m && VISION_KINDS.find((k) => k === m[1]);
  if (!m || !kind) throw new Error(`bad question id ${id}`);
  const seed = Number(m[2]) >>> 0;
  const q = (BUILDERS[kind] as Build<VisionQuestion>)(
    seed,
    { rng: seed },
    { budgetMs: Infinity },
  );
  if (!q) throw new Error(`question ${id} does not replay`);
  return q;
}

// ------------------------------------------------------------------ judge

/** Did the played T make a full T-spin clearing at least the best lines? */
export function judgeFindSlot(
  q: FindSlotQ,
  state: Pick<GameState, "lastEvent" | "lastClear" | "pieces">,
): boolean {
  return (
    state.pieces === 1 &&
    state.lastEvent?.spin === "full" &&
    state.lastClear >= q.best
  );
}
export const judgeYesNo = (q: NoSlotQ | ForecastQ, yes: boolean) =>
  q.answer === yes;
export const judgePiece = (q: WhichPieceQ, type: Tetromino) =>
  q.answers.includes(type);
