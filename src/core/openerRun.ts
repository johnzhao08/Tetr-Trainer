import { spawn } from "./board";
import type { Board, Tetromino } from "./board";
import { reviewPlacement } from "./coach";
import type { Band } from "./coach";
import { Game } from "./game";
import type { Placement } from "./game";
import { trackProblem } from "./openers";
import type { OpenerDef } from "./openers";
import type { Action, Settings } from "./settings";

/** Pieces of random play after the opener is built (two bags). */
export const CONTINUATION_PIECES = 14;
export type OpenerStage = "build" | "continue" | "done" | "failed";
type LockInfo = { before: Board; after: Board; placement: Placement };

const emptyBands = (): Record<Band, number> => ({
  best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0,
});

/**
 * One opener attempt: the first bag is dealt in a fixed order, the build is
 * checked after every lock (fail-fast), then random bags are played and graded
 * by the coach with APP. Undo is off so the attempt stays honest.
 */
export class OpenerRun extends Game {
  stage: OpenerStage = "build";
  /** Why the attempt ended early, or a note for the result panel. */
  reason: string | null = null;
  buildPieces = 0;
  buildMs = 0;
  attack = 0;
  bands = emptyBands();
  private goalIndex = 0;
  private locks: LockInfo[] = [];

  constructor(
    seed: number,
    settings: Settings,
    readonly def: OpenerDef,
    readonly bag: string,
  ) {
    super(seed, settings);
    this.listenToLocks((info) => this.locks.push(info));
    // Game.restart ran before these fields existed; run it again.
    this.restart(seed);
  }

  override get canUndo() {
    return false;
  }
  override undo() {}
  get phase() {
    return this.stage;
  }
  get over() {
    return this.stage === "done" || this.stage === "failed";
  }
  /** True once the opener's goals were met, even if the continuation ended. */
  get built() {
    return this.buildPieces > 0;
  }
  /** How many of the opener's goals have been met so far. */
  get goalsMet() {
    return this.goalIndex;
  }
  get continuationPieces() {
    return Object.values(this.bands).reduce((a, b) => a + b, 0);
  }
  get app() {
    const n = this.continuationPieces;
    return n ? this.attack / n : 0;
  }

  override restart(seed: number) {
    super.restart(seed);
    if (!this.def) return;
    this.stage = "build";
    this.reason = null;
    this.buildPieces = 0;
    this.buildMs = 0;
    this.attack = 0;
    this.bands = emptyBands();
    this.goalIndex = 0;
    this.locks = [];
    const [first, ...rest] = [...this.bag, ...this.def.tail] as Tetromino[];
    this.state.queue = [...rest, this.state.active!.type, ...this.state.queue];
    this.setActive(spawn(first));
  }

  override keyDown(action: Action) {
    if (this.over) return;
    super.keyDown(action);
    this.sync();
  }
  override tick(dt: number) {
    if (this.over) return;
    super.tick(dt);
    this.sync();
  }

  private end(stage: "done" | "failed", reason: string | null) {
    this.stage = stage;
    this.reason = reason;
    this.pause();
    this.state.active = null;
  }

  private sync() {
    const locks = this.locks.splice(0);
    locks.forEach((info, i) => {
      if (!this.over) this.process(info, i === locks.length - 1);
    });
    if (!this.over && this.state.status === "over")
      this.end(this.stage === "build" ? "failed" : "done", "Topped out.");
  }

  private process({ before, after, placement }: LockInfo, last: boolean) {
    const count = placement.index + 1;
    if (this.stage === "continue") {
      const review = reviewPlacement(before, after, {
        cleared: placement.cleared,
        spin: placement.spin !== null,
      });
      this.bands[review.band]++;
      this.attack += placement.attack;
      if (count - this.buildPieces >= CONTINUATION_PIECES) this.end("done", null);
      return;
    }
    const goal = this.def.goals[this.goalIndex];
    const met =
      goal.kind === "allClear"
        ? after.every((row) => row.every((c) => c === null))
        : goal.kind === "tspin" &&
          placement.spin === "full" &&
          placement.cleared === goal.lines;
    if (met && ++this.goalIndex >= this.def.goals.length) {
      this.stage = "continue";
      this.buildPieces = count;
      this.buildMs = placement.atMs;
      return;
    }
    if (count >= this.def.pieceLimit)
      return this.end("failed", `Out of pieces: ${this.def.name} not finished in ${count}.`);
    // Fail fast: off the guide while the stack is raw, and on goals and budget always.
    if (last && this.state.status !== "over") {
      const upcoming = [this.state.active!.type, ...this.state.queue];
      const problem = trackProblem(this.def, this.state.board, this.state.hold, upcoming, {
        instantSoftDrop: this.settings.instantSoftDrop,
        placed: count,
        goalIndex: this.goalIndex,
        cleared: this.state.lines > 0,
      });
      if (problem) this.end("failed", problem);
    }
  }
}
