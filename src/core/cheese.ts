import { HEIGHT, WIDTH } from "./board";
import type { Board, Cell } from "./board";
import { hasGarbage } from "./garbage";
import { nextRandom } from "./rng";

export type CheeseSpec = {
  /** Garbage rows kept on the board while any remain to be dealt. */
  rows: number;
  /** Total garbage lines dealt over the whole drill. */
  total: number;
  /** Chance (0-1) that a row's hole moves away from the row below. */
  messiness: number;
};
/** Lives in GameState so undo and rewind restore it exactly. */
export type CheeseState = { rng: number; hole: number; dealt: number };

export const newCheeseState = (seed: number): CheeseState => ({
  rng: (seed ^ 0x7f4a7c15) >>> 0,
  hole: -1,
  dealt: 0,
});

// Same rules as GarbageSource: one hole per row, and a messy row always moves
// the hole to a different column.
function nextRow(state: CheeseState, messiness: number): Cell[] {
  if (state.hole < 0) state.hole = Math.floor(nextRandom(state) * WIDTH);
  else if (nextRandom(state) < messiness)
    state.hole =
      (state.hole + 1 + Math.floor(nextRandom(state) * (WIDTH - 1))) % WIDTH;
  state.dealt++;
  return Array.from({ length: WIDTH }, (_, x) => (x === state.hole ? null : "X"));
}

/** Push rows in at the bottom until `spec.rows` show or the total is dealt. */
export function refillCheese(
  board: Board,
  state: CheeseState,
  spec: CheeseSpec,
): { board: Board; toppedOut: boolean } {
  let rows = board.filter(hasGarbage).length;
  let toppedOut = false;
  while (rows < spec.rows && state.dealt < spec.total) {
    if (board[HEIGHT - 1].some((cell) => cell !== null)) toppedOut = true;
    board = [nextRow(state, spec.messiness), ...board.slice(0, HEIGHT - 1)];
    rows++;
  }
  return { board, toppedOut };
}
