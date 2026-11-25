import { spawn } from "./board";
import type { Board, Tetromino } from "./board";
import { Game } from "./game";
import { defaultSettings } from "./settings";
import type { Action, Settings } from "./settings";

/**
 * A game that starts from a given board and a fixed queue, and stops (paused,
 * no active piece) once `limit` pieces have locked. The vision trainer plays
 * the player's own keys through it.
 */
export class VisionGame extends Game {
  constructor(
    seed: number,
    settings: Settings,
    readonly start: Board,
    readonly pieces: readonly Tetromino[],
    readonly limit = pieces.length,
    readonly holdStart: Tetromino | null = null,
  ) {
    super(seed, settings);
    // Game runs restart before these fields exist; run it again now.
    this.restart(seed);
  }
  /** The hold key does nothing; the trainer's single-piece questions set it. */
  noHold = false;
  get finished() {
    return (
      this.state.pieces >= (this.limit ?? 0) || this.state.status === "over"
    );
  }
  override restart(seed: number) {
    super.restart(seed);
    if (!this.start) return;
    this.state.board = this.start.map((row) => [...row]);
    this.state.hold = this.holdStart;
    const [first, ...rest] = this.pieces;
    this.state.queue = [...rest, ...this.state.queue];
    this.setActive(spawn(first));
  }
  override keyDown(action: Action) {
    if (this.finished || (this.noHold && action === "hold")) return;
    super.keyDown(action);
    if (this.finished) {
      this.pause();
      this.state.active = null;
    }
  }
  override undo() {}
  override get canUndo() {
    return false;
  }
  override resume() {
    if (!this.finished) super.resume();
  }
}

/** Play `path` then a hard drop on `board` in the real engine. */
export function replay(
  board: Board,
  type: Tetromino,
  path: readonly Action[],
): VisionGame {
  const game = new VisionGame(
    1,
    { ...defaultSettings(), instantSoftDrop: false },
    board,
    [type],
  );
  for (const action of [...path, "hardDrop" as const]) {
    game.keyDown(action);
    game.keyUp(action);
  }
  return game;
}
