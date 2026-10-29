import { Game } from "./game";
import { spawn, type Tetromino } from "./board";
import { defaultSettings, type Action, type Settings } from "./settings";

export type DrillStep = 1 | 2 | 3 | 4;
export const TKI_BAG: readonly Tetromino[] = [
  "I",
  "L",
  "Z",
  "O",
  "S",
  "J",
  "T",
];

export class TSpinDrill extends Game {
  constructor(
    seed: number,
    settings: Settings = defaultSettings(),
    readonly step: DrillStep = 1,
  ) {
    super(seed, settings);
    // Game initializes before the step property exists; apply this step afterward.
    this.restart(seed);
  }
  get target() {
    return this.step === 4 ? 3 : 1;
  }
  get result(): "success" | "retry" | null {
    if (this.state.fullTSpins >= this.target) return "success";
    if (
      this.state.status === "over" ||
      (this.step <= 2 && this.state.pieces > 0)
    )
      return "retry";
    return null;
  }
  override get canUndo() {
    return this.step >= 3 && !this.result && super.canUndo;
  }
  override restart(seed: number) {
    // The building exercise always has the same first bag and continuation.
    super.restart(this.step === 3 ? 1 : seed);
    if ((this.step ?? 1) <= 2) {
      this.state.board[0] = Array.from({ length: 10 }, (_, x) =>
        x === 4 ? null : "X",
      );
      this.state.board[2][5] = "H";
      this.state.active =
        this.step === 2 ? spawn("T") : { type: "T", x: 4, y: 1, rotation: 0 };
      this.state.canHold = false;
    } else if (this.step === 3) {
      this.state.queue = [
        ...TKI_BAG.slice(1),
        this.state.active!.type,
        ...this.state.queue,
      ];
      this.state.active = spawn(TKI_BAG[0]);
    }
  }
  override keyDown(action: Action) {
    if (this.result || (this.step <= 2 && action === "hold")) return;
    super.keyDown(action);
    if (this.result) {
      this.pause();
      this.state.active = null;
    }
  }
  override resume() {
    if (!this.result) super.resume();
  }
  override undo() {
    if (this.canUndo) super.undo();
  }
}
