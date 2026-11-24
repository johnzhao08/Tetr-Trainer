import { emptyBoard, project, type Piece } from "./board";
import { landingKey, optimalPath, placements, type FinesseInput } from "./finesse";
import { Game } from "./game";
import { defaultSettings, type Action, type Settings } from "./settings";

export type FinesseMode = {
  /** Number of pieces in one attempt. */
  length: number;
  /** Show the optimal key sequence for each target. */
  hints: boolean;
  /** Count 180-degree rotation as an available press. */
  use180: boolean;
};

export type FinesseResult = {
  type: Piece["type"];
  correct: boolean;
  presses: number;
  optimal: number;
};

const COUNTED: readonly Action[] = ["left", "right", "cw", "ccw", "flip"];

// Each piece gets a target placement on an empty board. The player must drop
// it there using as few presses as the breadth-first optimum.
export class FinesseDrill extends Game {
  target: Piece | null = null;
  results: FinesseResult[] = [];
  presses = 0;
  private down = new Set<Action>();
  private targetRng = 1;

  constructor(
    seed: number,
    settings: Settings = defaultSettings(),
    readonly mode: FinesseMode = { length: 20, hints: true, use180: true },
  ) {
    super(seed, settings);
    // Game.restart runs before fields exist; run it again now they do.
    this.restart(seed);
  }

  get done() {
    return this.results.length >= (this.mode?.length ?? Infinity);
  }
  get optimal(): FinesseInput[] {
    return this.target ? optimalPath(this.target, this.mode.use180) : [];
  }
  get perfect() {
    return this.results.filter((r) => r.correct && r.presses <= r.optimal)
      .length;
  }
  get extraPresses() {
    return this.results.reduce(
      (sum, r) => sum + Math.max(0, r.presses - r.optimal),
      0,
    );
  }
  override get canUndo() {
    return false;
  }

  override restart(seed: number) {
    super.restart(seed);
    if (!this.mode) return;
    this.results = [];
    this.down = new Set();
    this.targetRng = seed >>> 0 || 1;
    this.state.canHold = false;
    this.nextTarget();
  }

  private nextTarget() {
    this.presses = 0;
    const active = this.state.active;
    if (!active || this.done) {
      this.target = null;
      return;
    }
    const options = placements(active.type, this.mode.use180);
    // xorshift keeps targets reproducible from the session seed.
    let x = this.targetRng;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.targetRng = x >>> 0;
    this.target = options[this.targetRng % options.length].landing;
  }

  override keyDown(action: Action) {
    if (this.done || action === "hold") return;
    const fresh = !this.down.has(action);
    this.down.add(action);
    const active = this.state.active;
    if (this.state.status !== "playing" || !active || !fresh) return;
    if (COUNTED.includes(action)) this.presses++;
    if (action !== "hardDrop") {
      super.keyDown(action);
      return;
    }
    const target = this.target!;
    this.results.push({
      type: active.type,
      correct: landingKey(project(this.state.board, active)) === landingKey(target),
      presses: this.presses,
      optimal: optimalPath(target, this.mode.use180).length,
    });
    super.keyDown(action);
    this.state.board = emptyBoard();
    this.state.canHold = false;
    this.nextTarget();
    if (this.done) {
      this.pause();
      this.state.active = null;
    }
  }

  override keyUp(action: Action) {
    this.down.delete(action);
    super.keyUp(action);
  }

  override clearInput() {
    super.clearInput();
    this.down?.clear();
  }

  override resume() {
    if (!this.done) super.resume();
  }
}
