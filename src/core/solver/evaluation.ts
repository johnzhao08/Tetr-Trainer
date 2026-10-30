import { HEIGHT, WIDTH, type Board } from "../board";
export type WellSide = "left" | "right";
export type WellMode = "auto" | WellSide;
export function heights(board: Board): number[] {
  return Array.from({ length: WIDTH }, (_, x) => {
    for (let y = HEIGHT - 1; y >= 0; y--)
      if (board[y][x] !== null) return y + 1;
    return 0;
  });
}
export function chooseWell(
  board: Board,
  previous: WellSide = "right",
): WellSide {
  const h = heights(board),
    current = previous === "right" ? 9 : 0,
    other = 9 - current;
  const gap = (x: number) => h[x === 0 ? 1 : 8] - h[x];
  // Keep an established well; only switch on clear evidence, never on a tie.
  if (gap(current) >= 2) return previous;
  return gap(other) >= 3 && h[current] - h[other] >= 3
    ? previous === "right"
      ? "left"
      : "right"
    : previous;
}
export function evaluateBoard(board: Board, side: WellSide) {
  const h = heights(board),
    well = side === "right" ? 9 : 0;
  let holes = 0,
    wellBlocks = 0,
    roughness = 0;
  for (let x = 0; x < WIDTH; x++)
    for (let y = 0; y < h[x]; y++) {
      if (board[y][x] === null) holes++;
      else if (x === well) wellBlocks++;
    }
  const stack = h.filter((_, x) => x !== well);
  for (let i = 1; i < stack.length; i++)
    roughness += Math.abs(stack[i] - stack[i - 1]);
  const height = Math.max(...h);
  const danger = Math.max(0, height - 14) ** 2 * 250;
  return {
    holes,
    wellBlocks,
    roughness,
    height,
    cost:
      holes * 2000 +
      wellBlocks * 650 +
      danger +
      stack.reduce((a, b) => a + b, 0) * 2 +
      height * 4 +
      roughness * 3,
  };
}
