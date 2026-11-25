import { collides, spawn } from "./board";
import type { Board, Piece, Tetromino } from "./board";
import { findTsdSlots, reviewPlacement } from "./coach";
import type { CoachFlag, PlacementReview } from "./coach";
import { Game } from "./game";
import type { Placement } from "./game";
import { boardFromRows, validatePosition } from "./position";
import type { Position } from "./position";
import type { SessionRecord } from "./progress";
import type { Action, Settings } from "./settings";

export type Goal =
  /** A T-spin clearing exactly `lines`. Full spins only unless `full: false`. */
  | { kind: "tspin"; lines: number; full?: boolean }
  /** Any spin (optionally of one piece) clearing exactly `lines`. */
  | { kind: "spinClear"; piece?: Tetromino; lines: number; mini?: boolean }
  /** Any placement (optionally of one piece) clearing exactly `lines`, such as a quad. */
  | { kind: "clear"; piece?: Tetromino; lines: number }
  /** Clear this many garbage rows in total (after the previous step). */
  | { kind: "dig"; lines: number }
  /** Hold B2B of at least `min` when the piece limit is reached. */
  | { kind: "keepB2b"; min: number }
  /** Steps in order, each starting after the previous one's lock. */
  | { kind: "chain"; steps: Goal[] }
  /** End with a reachable TSD slot on the board. */
  | { kind: "buildSlot"; slot: "tsd" }
  /** No placement earns one of these coach flags. */
  | { kind: "noFlag"; kinds: CoachFlag["kind"][] };

export type PuzzleDef = {
  id: string;
  title: string;
  themes: string[];
  prompt: string;
  hint?: string;
  explanation: string;
  position: Position;
  goal: Goal;
  pieceLimit: number;
  timeMs?: number;
  /** Outline of the answer, shown with the hint. */
  guide?: Piece[];
  allowHold?: boolean;
  /** Set when the mirrored position is not solvable (kick asymmetry). */
  noMirror?: boolean;
};

export type PuzzleStatus = "playing" | "solved" | "failed";
export type FailReason = "pieceLimit" | "time" | "topOut" | "impossible" | "flagged";

const CLEAR_NAMES = ["", "Single", "Double", "Triple", "Quad"];

/** Short text for a goal step, for the progress list. */
export function goalLabel(goal: Goal): string {
  const lines = (n: number) => CLEAR_NAMES[n] ?? `${n} lines`;
  switch (goal.kind) {
    case "tspin":
      return `${goal.full === false ? "" : "Full "}T-spin ${lines(goal.lines)}`;
    case "spinClear": {
      const kind = goal.mini ? "mini " : "";
      return `${goal.piece ?? "Any"}-spin ${kind}${lines(goal.lines)}`;
    }
    case "clear":
      return `${goal.piece ? `${goal.piece} ` : ""}${lines(goal.lines)} clear`;
    case "dig":
      return `Clear ${goal.lines} garbage lines`;
    case "keepB2b":
      return `End with B2B ${goal.min}+`;
    case "buildSlot":
      return "End with a T-spin double slot";
    case "noFlag":
      return `No ${goal.kinds.join(" or ")} flags`;
    case "chain":
      return goal.steps.map(goalLabel).join(", then ");
  }
}

export function flattenGoal(goal: Goal): Goal[] {
  return goal.kind === "chain" ? goal.steps.flatMap(flattenGoal) : [goal];
}

// Steps judged against the final board once the piece limit is reached.
const isFinal = (g: Goal) =>
  g.kind === "keepB2b" || g.kind === "buildSlot" || g.kind === "noFlag";

/** End-of-run steps are judged on the final board, so they must come last. */
export function finalStepError(goal: Goal): string | null {
  const steps = flattenGoal(goal);
  const bad = steps.findIndex((g, i) => isFinal(g) && i < steps.length - 1);
  return bad < 0 ? null : `${steps[bad].kind} must be the last step of a goal`;
}

function spinMatches(g: Goal, p: Placement): boolean {
  if (g.kind === "tspin")
    return (
      p.type === "T" &&
      p.cleared === g.lines &&
      (g.full === false ? p.spin !== null : p.spin === "full")
    );
  if (g.kind === "clear")
    return p.cleared === g.lines && (!g.piece || p.type === g.piece);
  if (g.kind !== "spinClear" || p.spin === null) return false;
  if (g.piece && p.type !== g.piece) return false;
  if (g.mini !== undefined && (p.spin === "mini") !== g.mini) return false;
  return p.cleared === g.lines;
}

export type GoalProgress = {
  steps: Goal[];
  /** Leading steps already met. */
  met: number;
  solved: boolean;
  /** Placement index that completed each met step (-1 for end-of-run steps). */
  matched: number[];
  /** A noFlag step was broken. */
  flagged: boolean;
};

/** Pure goal check over the placements so far; undo just shortens `log`. */
export function evaluateGoal(
  goal: Goal,
  ctx: {
    log: readonly Placement[];
    reviews: readonly PlacementReview[];
    b2b: number;
    board: Board;
    atEnd: boolean;
  },
): GoalProgress {
  const steps = flattenGoal(goal);
  const matched: number[] = [];
  const flagged = steps.some(
    (g) =>
      g.kind === "noFlag" &&
      ctx.reviews.some((r) => r.flags.some((f) => g.kinds.includes(f.kind))),
  );
  let cursor = 0;
  let met = 0;
  for (const step of steps) {
    let at = -1;
    if (isFinal(step)) {
      const ok =
        ctx.atEnd &&
        (step.kind === "keepB2b"
          ? ctx.b2b >= step.min
          : step.kind === "buildSlot"
            ? findTsdSlots(ctx.board).length > 0
            : !flagged);
      if (!ok) break;
    } else if (step.kind === "dig") {
      let sum = 0;
      for (let i = cursor; i < ctx.log.length && at < 0; i++) {
        sum += ctx.log[i].garbageCleared;
        if (sum >= step.lines) at = i;
      }
      if (at < 0) break;
      cursor = at + 1;
    } else {
      at = ctx.log.findIndex((p, i) => i >= cursor && spinMatches(step, p));
      if (at < 0) break;
      cursor = at + 1;
    }
    matched.push(at);
    met++;
  }
  return { steps, met, solved: met === steps.length, matched, flagged };
}

/** A Game that starts from a Position instead of an empty board. */
class PuzzleGame extends Game {
  constructor(
    seed: number,
    settings: Settings,
    private readonly position?: Position,
    private readonly allowHold = true,
  ) {
    super(seed, settings);
    // Game.restart runs before these fields exist; run it again now.
    this.restart(seed);
  }

  override restart(seed: number) {
    super.restart(seed);
    const p = this.position;
    if (!p) return;
    const s = this.state;
    s.board = boardFromRows(p.rows);
    // The fixed queue goes first; the seeded bags carry on behind it.
    const [first, ...rest] = p.queue;
    s.queue = [...rest, s.active!.type, ...s.queue];
    this.setActive(spawn(first));
    s.hold = p.hold ?? null;
    s.b2b = p.b2b ?? -1;
    s.combo = p.combo ?? -1;
    for (const lines of p.incoming ?? []) this.receive(lines, 0);
    s.canHold = this.allowHold;
    if (collides(s.board, s.active!)) {
      s.active = null;
      s.status = "over";
    }
  }

  override keyDown(action: Action) {
    if (action === "hold" && !this.allowHold) return;
    super.keyDown(action);
    if (!this.allowHold) this.state.canHold = false;
  }
}

export class PuzzleSession {
  game: PuzzleGame;
  status: PuzzleStatus = "playing";
  failReason: FailReason | null = null;
  attempts = 1;
  /** reviews[i] grades placement i; always as long as game.log. */
  reviews: PlacementReview[] = [];
  // Same bookkeeping as DrillSession: undo restores the game clock to the
  // undone lock, so time spent on discarded attempts is subtracted.
  private discarded = 0;
  private lockedAt: number[] = [];
  private finishedMs = 0;

  constructor(
    readonly def: PuzzleDef,
    readonly seed: number,
    settings: Settings,
  ) {
    const errors = validatePosition(def.position);
    if (errors.length) throw new Error(`Puzzle ${def.id}: ${errors[0]}`);
    const finalError = finalStepError(def.goal);
    if (finalError) throw new Error(`Puzzle ${def.id}: ${finalError}`);
    this.game = new PuzzleGame(seed, settings, def.position, def.allowHold);
    this.game.listenToLocks(({ before, after, placement }) => {
      this.reviews[placement.index] = reviewPlacement(before, after, {
        cleared: placement.cleared,
        spin: placement.spin !== null,
      });
      this.lockedAt[placement.index] = placement.atMs - this.discarded;
    });
    this.evaluate();
  }

  get elapsedMs() {
    return this.status === "playing"
      ? this.game.elapsedMs - this.discarded
      : this.finishedMs;
  }
  get progress(): GoalProgress {
    const { game, def } = this;
    return evaluateGoal(def.goal, {
      log: game.log,
      reviews: this.reviews,
      b2b: game.state.b2b,
      board: game.state.board,
      atEnd: game.state.pieces >= def.pieceLimit,
    });
  }
  get canUndo() {
    return this.status !== "solved" && this.game.canUndo;
  }

  keyDown(action: Action) {
    if (this.status !== "playing") return;
    this.game.keyDown(action);
    this.evaluate();
  }
  keyUp(action: Action) {
    this.game.keyUp(action);
  }
  tick(dt: number) {
    if (this.status !== "playing") return;
    const limit = this.def.timeMs;
    this.game.tick(
      limit === undefined ? dt : Math.min(dt, Math.max(0, limit - this.elapsedMs)),
    );
    this.evaluate();
  }
  /** Start the same position again; counts as another attempt. */
  retry() {
    this.game.restart(this.seed);
    this.discarded = 0;
    this.lockedAt = [];
    this.reviews = [];
    this.status = "playing";
    this.failReason = null;
    this.attempts++;
    this.evaluate();
  }
  undo() {
    if (!this.canUndo) return;
    this.game.undo();
    const pieces = this.game.state.pieces;
    this.reviews.length = pieces;
    this.lockedAt.length = pieces;
    this.discarded = this.game.elapsedMs - (this.lockedAt[pieces - 1] ?? 0);
    this.status = "playing";
    this.failReason = null;
  }

  private evaluate() {
    if (this.status !== "playing") return;
    const { def, game } = this;
    const finish = (status: PuzzleStatus, reason: FailReason | null = null) => {
      this.finishedMs = game.elapsedMs - this.discarded;
      this.status = status;
      this.failReason = reason;
    };
    const progress = this.progress;
    if (progress.solved) return finish("solved");
    if (game.state.status === "over") return finish("failed", "topOut");
    if (progress.flagged) return finish("failed", "flagged");
    if (game.state.pieces >= def.pieceLimit) return finish("failed", "pieceLimit");
    if (this.unreachable(progress))
      return finish("failed", "impossible");
    if (def.timeMs !== undefined && this.elapsedMs >= def.timeMs - 1e-6)
      return finish("failed", "time");
  }

  // True when the pieces left cannot cover the steps still open.
  private unreachable(progress: GoalProgress): boolean {
    const { state } = this.game;
    const left = this.def.pieceLimit - state.pieces;
    const open = progress.steps.slice(progress.met).filter((g) => !isFinal(g));
    if (open.length > left) return true;
    const needT = open.filter(
      (g) => g.kind === "tspin" || (g.kind === "spinClear" && g.piece === "T"),
    ).length;
    // Only the fixed queue is certain (it includes the active piece). Past
    // it the bags are random: each 7-bag, even a cut-off one, may hold a T.
    const fixedLeft = Math.max(0, this.def.position.queue.length - state.pieces);
    const known = [
      state.active?.type,
      state.hold,
      ...state.queue.slice(0, Math.max(0, Math.min(left, fixedLeft) - 1)),
    ];
    const possible = Math.ceil(Math.max(0, left - fixedLeft) / 7);
    return known.filter((t) => t === "T").length + possible < needT;
  }

  /** One line on what happened: the matched placements, then the verdict. */
  explainResult(): string {
    const { game, def } = this;
    const { matched, met, steps } = this.progress;
    const names = matched
      .filter((i) => i >= 0)
      .map((i) => placementLabel(game.log[i]));
    if (this.status === "solved")
      return `${names.length ? `${names.join(", then ")}: ` : ""}${def.title} complete.`;
    if (this.status === "playing") return "";
    const done = names.length ? `${names.join(", then ")}, then ` : "";
    const next = steps[met] ? goalLabel(steps[met]) : "the goal";
    switch (this.failReason) {
      case "topOut":
        return `${done}topped out before ${next}.`;
      case "time":
        return `${done}time ran out before ${next}.`;
      case "flagged":
        return "The coach flagged a placement the puzzle forbids.";
      case "impossible":
        return `${done}${next} can no longer be reached with the pieces left.`;
      default:
        return `${done}out of pieces before ${next}.`;
    }
  }

  record(id: string, endedAt: number): SessionRecord {
    const timeMs = Math.round(this.elapsedMs);
    return {
      id,
      drillId: `puzzle:${this.def.id}`,
      endedAt,
      durationMs: timeMs,
      completed: this.status === "solved",
      metrics: {
        pieces: this.game.state.pieces,
        timeMs,
        score: this.status === "solved" ? 1 : 0,
      },
    };
  }
}

function placementLabel(p: Placement): string {
  const clear = CLEAR_NAMES[p.cleared] ?? "";
  if (p.spin) {
    const name = `${p.type}-spin${p.spin === "mini" ? " Mini" : ""}`;
    return clear ? `${name} ${clear}` : name;
  }
  return clear || "Placement";
}
