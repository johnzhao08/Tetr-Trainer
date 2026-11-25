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
  /** Holes per row (default 1). A second hole always sits in another column. */
  holes?: 1 | 2;
  /**
   * Rows that share their hole columns before the holes move, drawn from
   * [min, max]. Replaces `messiness`: this is clean garbage in blocks.
   */
  runLength?: readonly [number, number];
  /** Shorthand for runLength [3, 6]. */
  clean?: boolean;
};
export const CLEAN_RUN = [3, 6] as const;
/** Lives in GameState so undo and rewind restore it exactly. */
export type CheeseState = {
  rng: number;
  hole: number;
  /** Second hole column; -1 unless the spec has two holes. */
  hole2: number;
  /** Rows left in the current run (only used with runLength). */
  run: number;
  dealt: number;
};

export const newCheeseState = (seed: number): CheeseState => ({
  rng: (seed ^ 0x7f4a7c15) >>> 0,
  hole: -1,
  hole2: -1,
  run: 0,
  dealt: 0,
});

const otherColumn = (state: CheeseState, from: number) =>
  (from + 1 + Math.floor(nextRandom(state) * (WIDTH - 1))) % WIDTH;

// Same rules as GarbageSource: a messy row always moves the hole to a
// different column. The default spec draws exactly what it always has.
function nextRow(state: CheeseState, spec: CheeseSpec): Cell[] {
  const run = spec.runLength ?? (spec.clean ? CLEAN_RUN : undefined);
  const two = spec.holes === 2;
  let move = false;
  if (state.hole < 0) {
    state.hole = Math.floor(nextRandom(state) * WIDTH);
    move = true;
  } else if (run) {
    if (state.run <= 0) {
      state.hole = otherColumn(state, state.hole);
      move = true;
    }
  } else if (nextRandom(state) < spec.messiness) {
    state.hole = otherColumn(state, state.hole);
    move = true;
  }
  if (move && run) {
    const [min, max] = run;
    state.run = min + Math.floor(nextRandom(state) * (max - min + 1));
  }
  if (move && two) state.hole2 = otherColumn(state, state.hole);
  if (run) state.run--;
  state.dealt++;
  return Array.from({ length: WIDTH }, (_, x) =>
    x === state.hole || (two && x === state.hole2) ? null : "X",
  );
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
    board = [nextRow(state, spec), ...board.slice(0, HEIGHT - 1)];
    rows++;
  }
  return { board, toppedOut };
}
