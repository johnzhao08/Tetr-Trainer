import { TYPES } from "./board";
import type { Board, Tetromino } from "./board";
import { nextRandom } from "./rng";
import { findPlacements, findSpins } from "./spins";
import type { Placement, SpinMove } from "./spins";
import { generateStack } from "./stackGen";
import { boardOf, deadBoard, mirrorBoard, STRUCTURES } from "./structures";
import type { Structure } from "./structures";
import { bestSlot, creates, planSlot, runPlan, slotReady } from "./visionSearch";
import type { PlanStep } from "./visionSearch";
import { replay } from "./visionGame";
import type { GameState } from "./game";

export type VisionKind =
  | "findSlot"
  | "noSlot"
  | "whichPiece"
  | "forecast"
  | "structure";
export const VISION_KINDS: readonly VisionKind[] = [
  "findSlot",
  "noSlot",
  "whichPiece",
  "forecast",
  "structure",
];
export const VISION_PROMPT: Record<VisionKind, string> = {
  findSlot: "Where does the T go?",
  noSlot: "Is there a line-clearing T-spin?",
  whichPiece: "Which piece makes a T-slot?",
  forecast: "Will a T-slot be ready when the T arrives?",
  structure: "Which structure is this?",
};

/** Where a question's board comes from. */
export type Source =
  | "generated"
  | { structure: string; mirrored: boolean };
/** The label shown over a generated board. */
export const GENERATED_LABEL = "Generated position";
/** The four.lol page each sourced structure fixture is drawn from. */
export const SOURCE_URL: Record<string, string> = {
  tsd: "https://four.lol/srs/t-spin",
  tst: "https://four.lol/methods/tspin-triple",
  stsd: "https://four.lol/methods/stsd",
  "triple-double": "https://four.lol/methods/triple-double",
  fractal: "https://four.lol/methods/fractal",
  "imperial-cross": "https://four.lol/methods/imperial-cross",
  kaidan: "https://four.lol/methods/kaidan",
};

type Base = {
  id: string;
  seed: number;
  board: Board;
  why: string;
  source: Source;
};
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
export type StructureQ = Base & {
  kind: "structure";
  source: Exclude<Source, "generated">;
  /** Structure ids offered, in display order; exactly one cue matches. */
  options: string[];
  answer: string;
};
export type VisionQuestion =
  | FindSlotQ
  | NoSlotQ
  | WhichPieceQ
  | ForecastQ
  | StructureQ;

// ---------------------------------------------------------------- sources

type Sourced = { structure: Structure; mirrored: boolean; board: Board };
let sourcedList: Sourced[] | null = null;
/** Every sourced fixture, as drawn and mirrored, whose own cue matches it. */
export function sourcedBoards(): Sourced[] {
  sourcedList ??= STRUCTURES.flatMap((structure) => {
    const board = boardOf(structure);
    return [false, true].map((mirrored) => ({
      structure,
      mirrored,
      board: mirrored ? mirrorBoard(board) : board,
    }));
  }).filter((s) => s.structure.cue(s.board));
  return sourcedList;
}
const slotBases = () => sourcedBoards().filter((s) => slotReady(s.board));
const refOf = (s: Sourced): Exclude<Source, "generated"> => ({
  structure: s.structure.id,
  mirrored: s.mirrored,
});
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

/**
 * A board for a slot question: half the time a sourced fixture exactly as
 * drawn, otherwise a generated stack built up around one.
 */
function slotBoard(rng: Rng): { board: Board; source: Source; named: Structure | null } {
  const base = pick(rng, slotBases());
  if (nextRandom(rng) < 0.4)
    return { board: base.board, source: refOf(base), named: base.structure };
  const { board } = generateStack(rng.rng, {
    base: base.board,
    pieces: 2 + rand(rng, 9),
    keep: slotReady,
    well: rand(rng, 10),
  });
  return { board, source: "generated", named: null };
}

/**
 * A generated stack with no slot yet where some placement of a piece would
 * create one: found by trying stacks, never by editing a sourced board.
 */
function almostBoard(rng: Rng): { board: Board; type: Tetromino } | null {
  for (let i = 0; i < 8; i++) {
    const board = natural(rng);
    if (slotReady(board)) continue;
    const types = TYPES.filter((t) => creates(board, t) !== null);
    if (types.length) return { board, type: pick(rng, types) };
  }
  return null;
}

const natural = (rng: Rng): Board =>
  generateStack(rng.rng, { pieces: 10 + rand(rng, 18), well: rand(rng, 10) })
    .board;

// ------------------------------------------------------------------- why

/**
 * One line on what makes this spin. It names a structure only when `named`
 * is given: the sourced fixture whose cue matches the board.
 */
export function whyText(move: SpinMove, named: Structure | null = null): string {
  const shape =
    move.lines >= 3
      ? "a notch three deep"
      : move.piece.rotation === 2
        ? "a 3-wide gap under an overhang"
        : "a pocket in the wall";
  const from = named ? ` This is the ${named.name} structure.` : "";
  return `${move.label}: the T drops in and turns into ${shape}.${from}`;
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

/** `maxWork` bounds proof searches by boards looked at, never by time. */
type Ctx = { maxWork: number };
type Build<Q> = (seed: number, rng: Rng, ctx: Ctx) => Q | null;

const findSlot: Build<FindSlotQ> = (seed, rng) => {
  const { board, source, named } = slotBoard(rng);
  const full = findSpins(board, "T").filter((s) => s.spin === "full");
  const best = Math.max(0, ...full.map((s) => s.lines));
  const answers = full.filter((s) => s.lines === best);
  if (best < 2 || !answers.every((s) => verified(board, s))) return null;
  return {
    kind: "findSlot", id: `findSlot-${seed}`, seed, board, best, answers, source,
    why: whyText(answers[0], named),
  };
};

/** Dead means no T-spin Double or better and no quad, now or after one piece. */
export const DEAD_HORIZON = 1;
export const isDead = (b: Board) => deadBoard(b, { horizon: DEAD_HORIZON });

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
    const { board, source, named } = slotBoard(rng);
    const example = bestSlot(board);
    if (!example || !verified(board, example)) return null;
    return {
      kind: "noSlot", id: `noSlot-${seed}`, seed, board, answer: true,
      dead: false, example, why: whyText(example, named), source,
    };
  }
  const board = nextRandom(rng) < 0.5 ? natural(rng) : almostBoard(rng)?.board;
  if (!board || findSpins(board, "T").length > 0) return null;
  const dead = isDead(board);
  return {
    kind: "noSlot", id: `noSlot-${seed}`, seed, board, answer: false, dead,
    example: null, source: "generated",
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
    example: { type, placement, slot }, source: "generated",
    why: `${type} here leaves ${slot.label}: ${whyText(slot).split(": ")[1]}`,
  };
};

/** Boards a no-proof may look at before the question is dropped. */
export const PROOF_MAX_WORK = 4000;

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
      maxWork: ctx.maxWork,
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
    hold, tIndex, answer: plan !== null, plan, source: "generated",
    why: plan
      ? `Yes: ${plan.steps.filter((s) => s.move).map((s) => s.type).join(" then ")} leaves ${plan.slot.label} for the T.`
      : "No: no way to play the pieces before the T, with hold, leaves a T-slot.",
  };
};

const structure: Build<StructureQ> = (seed, rng) => {
  const pool = sourcedBoards();
  const base = pick(rng, pool);
  const { board } = base;
  // Exactly one offered structure may match the board: the answer.
  const others = STRUCTURES.filter((s) => s.id !== base.structure.id && !s.cue(board));
  if (!base.structure.cue(board) || others.length < 3) return null;
  const options = shuffled(rng, [base.structure, ...shuffled(rng, others).slice(0, 3)]);
  const { id, name, cueText } = base.structure;
  return {
    kind: "structure", id: `structure-${seed}`, seed, board,
    source: refOf(base), options: options.map((o) => o.id), answer: id,
    why: `${name}: ${cueText} Drawn from ${SOURCE_URL[id]}.`,
  };
};

const BUILDERS: { [K in VisionKind]: Build<Extract<VisionQuestion, { kind: K }>> } = {
  findSlot, noSlot, whichPiece, forecast, structure,
};

/**
 * A verified question near `seed`. Candidates that fail their answer check, or
 * whose no-proof runs past its work limit, are dropped and the next derived
 * seed is tried. The returned `seed` (and id) is the derived seed that produced the
 * question, so `questionById` rebuilds it exactly, whatever the machine's speed.
 */
export function generateQuestion<K extends VisionKind>(
  seed: number,
  kind: K,
  opts: { maxWork?: number } = {},
): Extract<VisionQuestion, { kind: K }> {
  const ctx: Ctx = { maxWork: opts.maxWork ?? PROOF_MAX_WORK };
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
 * work limit when the question was accepted, so it runs here without one.
 */
export function questionById(id: string): VisionQuestion {
  const m = /^(\w+)-(\d+)$/.exec(id);
  const kind = m && VISION_KINDS.find((k) => k === m[1]);
  if (!m || !kind) throw new Error(`bad question id ${id}`);
  const seed = Number(m[2]) >>> 0;
  const q = (BUILDERS[kind] as Build<VisionQuestion>)(
    seed,
    { rng: seed },
    { maxWork: Infinity },
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
export const judgeStructure = (q: StructureQ, id: string) => q.answer === id;
export const judgePiece = (q: WhichPieceQ, type: Tetromino) =>
  q.answers.includes(type);
