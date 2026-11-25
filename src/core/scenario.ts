import { collides, spawn, type Tetromino } from "./board";
import { GarbageSource, hasGarbage, type GarbageSpec } from "./garbage";
import { Game } from "./game";
import { boardFromRows, rowsToCells } from "./position";
import { defaultSettings, type Action, type Settings } from "./settings";

export { rowsToCells };

// A goal is met by one lock. Goals are completed in order.
export type Goal =
  | { kind: "tspin"; lines: 1 | 2 | 3 }
  | { kind: "clear"; lines: 1 | 2 | 3 | 4 }
  | { kind: "allClear" }
  /** Clear this many garbage lines in total (not in one lock). */
  | { kind: "dig"; lines: number };

export type Scenario = {
  /** Starting board as top-down rows; letters are pieces, X is garbage. */
  board?: readonly string[];
  /** Pieces dealt before the random 7-bags start. */
  queue?: readonly Tetromino[];
  /**
   * Shape to build, as top-down rows from the floor up: piece letters are
   * where that piece goes, G is "fill freely", * is the T-spin slot.
   * It is advice; success only depends on the goals.
   */
  guide?: readonly string[];
  goals: readonly Goal[];
  /** Fail once this many pieces have locked without finishing. */
  pieceLimit?: number;
  allowHold?: boolean;
  allowUndo?: boolean;
  /** Cheese garbage kept under the stack and refilled as it is cleared. */
  garbage?: GarbageSpec;
};

export function goalLabel(goal: Goal): string {
  if (goal.kind === "allClear") return "Perfect clear";
  if (goal.kind === "dig") return `Clear ${goal.lines} garbage lines`;
  const name = ["", "Single", "Double", "Triple", "Quad"][goal.lines];
  return goal.kind === "tspin" ? `T-spin ${name}` : name;
}

export class ScenarioDrill extends Game {
  goalIndex = 0;
  failure: "topOut" | "outOfPieces" | null = null;
  garbageCleared = 0;
  private garbage: GarbageSource | null = null;
  private progress: { goalIndex: number; garbageCleared: number }[] = [];

  constructor(
    seed: number,
    settings: Settings = defaultSettings(),
    readonly scenario: Scenario = { goals: [] },
  ) {
    super(seed, settings);
    // Game.restart runs before fields exist; run it again now they do.
    this.restart(seed);
  }

  get done() {
    return this.goalIndex >= (this.scenario?.goals.length ?? Infinity);
  }
  get result(): "success" | "failed" | null {
    if (this.done) return "success";
    return this.failure ? "failed" : null;
  }
  override get canUndo() {
    // Undo stays available after running out of pieces or topping out.
    return this.scenario.allowUndo !== false && !this.done && super.canUndo;
  }

  override restart(seed: number) {
    super.restart(seed);
    const scenario = this.scenario;
    if (!scenario) return;
    this.goalIndex = 0;
    this.failure = null;
    this.progress = [];
    this.garbageCleared = 0;
    if (scenario.board) this.state.board = boardFromRows(scenario.board);
    this.garbage = scenario.garbage
      ? new GarbageSource(seed ^ 0x9e3779b9, scenario.garbage)
      : null;
    this.refillGarbage();
    if (scenario.queue?.length) {
      const [first, ...rest] = scenario.queue;
      this.state.queue = [...rest, this.state.active!.type, ...this.state.queue];
      this.setActive(spawn(first));
    }
    this.state.canHold = scenario.allowHold !== false;
  }

  override keyDown(action: Action) {
    if (this.result) return;
    if (action === "hold" && this.scenario.allowHold === false) return;
    const pieces = this.state.pieces;
    const allClear = this.state.allClearId;
    const before = { goalIndex: this.goalIndex, garbageCleared: this.garbageCleared };
    const garbageRows = this.state.board.filter(hasGarbage).length;
    super.keyDown(action);
    if (this.state.pieces !== pieces) {
      this.progress.push(before);
      this.garbageCleared +=
        garbageRows - this.state.board.filter(hasGarbage).length;
      this.refillGarbage();
      this.judge(this.state.allClearId !== allClear && this.state.allClearId !== null);
    }
    if (this.state.status === "over") this.failure = "topOut";
    if (this.result) {
      this.pause();
      this.state.active = null;
    } else if (this.scenario.allowHold === false) this.state.canHold = false;
  }

  private judge(allClear: boolean) {
    const goal = this.scenario.goals[this.goalIndex];
    const event = this.state.lastEvent;
    const fresh = event?.id === this.state.pieces;
    const cleared = this.state.lastClear;
    const met =
      goal.kind === "allClear"
        ? allClear
        : goal.kind === "dig"
          ? this.garbageCleared >= goal.lines
          : goal.kind === "tspin"
          ? fresh && event.spin === "full" && cleared === goal.lines
          : cleared === goal.lines;
    if (met) this.goalIndex++;
    const limit = this.scenario.pieceLimit;
    if (!this.done && limit !== undefined && this.state.pieces >= limit)
      this.failure = "outOfPieces";
  }

  override undo() {
    if (!this.canUndo) return;
    const failed = this.failure !== null;
    super.undo();
    const previous = this.progress.pop();
    this.goalIndex = previous?.goalIndex ?? 0;
    this.garbageCleared = previous?.garbageCleared ?? 0;
    this.failure = null;
    if (failed) this.resume();
  }

  /** Push garbage up from the bottom until the spec's row count is shown. */
  private refillGarbage() {
    const source = this.garbage;
    if (!source) return;
    const board = this.state.board;
    while (board.filter(hasGarbage).length < source.spec.rows) {
      const row = source.row();
      if (!row) break;
      board.pop();
      board.unshift(row);
    }
    // Rising garbage can push the active piece into the stack.
    if (this.state.active && collides(board, this.state.active)) {
      this.state.status = "over";
      this.state.active = null;
    }
  }

  override resume() {
    if (!this.result) super.resume();
  }
}
