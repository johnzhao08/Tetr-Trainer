import { Game } from "./game";
import { spawn, type Tetromino } from "./board";
import { boardFromRows } from "./position";
import { defaultSettings, type Action, type Settings } from "./settings";

/**
 * Steps 1 and 2 start from https://four.lol/srs/t-spin, "3-Corner Rule",
 * diagram 0 (page 1 of its fumen), exactly as drawn: the three-corner T-spin
 * double. Its pages 2 and 3 show the T standing in the notch with its stem to
 * the right, then rotated to point down. Top row first.
 */
export const BASIC_T_SPIN_ROWS = ["XXXX......", "XXX...XXXX", "XXXX.XXXXX"];

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
      this.state.board = boardFromRows(BASIC_T_SPIN_ROWS);
      this.setActive(
        this.step === 2 ? spawn("T") : { type: "T", x: 4, y: 1, rotation: 1 },
      );
      this.state.canHold = false;
    } else if (this.step === 3) {
      this.state.queue = [
        ...TKI_BAG.slice(1),
        this.state.active!.type,
        ...this.state.queue,
      ];
      this.setActive(spawn(TKI_BAG[0]));
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
