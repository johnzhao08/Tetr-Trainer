import { emptyBoard, spawn, type Board, type Cell, type Tetromino } from "./board";
import { Game } from "./game";
import { defaultSettings, type Action, type Settings } from "./settings";

// A goal is met by one lock. Goals are completed in order.
export type Goal =
  | { kind: "tspin"; lines: 1 | 2 | 3 }
  | { kind: "clear"; lines: 1 | 2 | 3 | 4 }
  | { kind: "allClear" };

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
};

export function goalLabel(goal: Goal): string {
  if (goal.kind === "allClear") return "Perfect clear";
  const name = ["", "Single", "Double", "Triple", "Quad"][goal.lines];
  return goal.kind === "tspin" ? `T-spin ${name}` : name;
}

/** Top-down text rows to board cells, with the last row at y = 0. */
export function rowsToCells(rows: readonly string[]) {
  return rows.flatMap((row, i) =>
    [...row].flatMap((char, x) =>
      char === "." ? [] : [{ x, y: rows.length - 1 - i, char }],
    ),
  );
}

export class ScenarioDrill extends Game {
  goalIndex = 0;
  failure: "topOut" | "outOfPieces" | null = null;
  private progress: number[] = [];

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
    return !this.done && super.canUndo;
  }

  override restart(seed: number) {
    super.restart(seed);
    const scenario = this.scenario;
    if (!scenario) return;
    this.goalIndex = 0;
    this.failure = null;
    this.progress = [];
    if (scenario.board) this.state.board = boardFromRows(scenario.board);
    if (scenario.queue?.length) {
      const [first, ...rest] = scenario.queue;
      this.state.queue = [...rest, this.state.active!.type, ...this.state.queue];
      this.state.active = spawn(first);
    }
    this.state.canHold = scenario.allowHold !== false;
  }

  override keyDown(action: Action) {
    if (this.result) return;
    if (action === "hold" && this.scenario.allowHold === false) return;
    const pieces = this.state.pieces;
    const allClear = this.state.allClearId;
    const goalIndex = this.goalIndex;
    super.keyDown(action);
    if (this.state.pieces !== pieces) {
      this.progress.push(goalIndex);
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
    this.goalIndex = this.progress.pop() ?? 0;
    this.failure = null;
    if (failed) this.resume();
  }

  override resume() {
    if (!this.result) super.resume();
  }
}

function boardFromRows(rows: readonly string[]): Board {
  const board = emptyBoard();
  for (const { x, y, char } of rowsToCells(rows))
    board[y][x] = (char === "G" ? "X" : char) as Cell;
  return board;
}
