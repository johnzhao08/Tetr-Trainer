import { Game } from "./game";
import { emptyBoard, spawn, type Piece, type Tetromino } from "./board";

// FOUR's flat-top diagram; unlike the existing drill, J caps Z in the center.
export const LST_FIRST_BAG: readonly Tetromino[] = [
  "I",
  "L",
  "Z",
  "S",
  "O",
  "J",
  "T",
];
export const FLAT_TOP_PLACEMENTS: readonly Piece[] = [
  { type: "I", x: 4, y: -1, rotation: 0 },
  { type: "L", x: 0, y: 1, rotation: 1 },
  { type: "Z", x: 4, y: 1, rotation: 0 },
  { type: "S", x: 6, y: 1, rotation: 1 },
  { type: "O", x: 8, y: 0, rotation: 0 },
  { type: "J", x: 4, y: 3, rotation: 2 },
  { type: "T", x: 2, y: 1, rotation: 2 },
];
// Source example for the second TSD, not a forced second bag in the module.
export const SECOND_TSD_PLACEMENTS: readonly Piece[] = [
  { type: "S", x: 0, y: 1, rotation: 1 },
  { type: "L", x: 8, y: 0, rotation: 0 },
  { type: "O", x: 7, y: 1, rotation: 0 },
  { type: "I", x: 5, y: 2, rotation: 1 },
  { type: "J", x: 8, y: 3, rotation: 2 },
  { type: "Z", x: 4, y: 2, rotation: 0 },
  { type: "T", x: 2, y: 2, rotation: 2 },
];
export const FLAT_TOP_ROWS = [
  "LL.IIIISOO",
  "L...ZZSSOO",
  "L..ZZJS...",
  "...JJJ....",
];
export function flatTopPreview() {
  const board = emptyBoard();
  FLAT_TOP_ROWS.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== ".") board[y][x] = c as Tetromino;
    }),
  );
  return board;
}
export class LSTGame extends Game {
  override restart(seed: number) {
    super.restart(seed);
    // Prepend a complete bag; the seeded random bags stay intact afterward.
    this.state.queue = [
      ...LST_FIRST_BAG.slice(1),
      this.state.active!.type,
      ...this.state.queue,
    ];
    this.state.active = spawn(LST_FIRST_BAG[0]);
  }
}
